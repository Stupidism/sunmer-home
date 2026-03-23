import { getPayloadClient } from '@/lib/payload/client'
import { getNextDay } from '@/lib/utils/week'
import { Pool } from 'pg'
import type {
  DishRecord,
  MealTemplate,
  DishPreferenceMap,
  DishCategory,
  MealType,
  GeneratedSlot,
  GeneratedDish,
} from '@/lib/types'

const DEFAULT_TEMPLATE: MealTemplate = {
  meatCount: 1,
  leafyGreenCount: 1,
  otherCount: 1,
}

type GlobalWithWeeklyMenuPool = typeof globalThis & {
  __weeklyMenuPool?: Pool
}

type QueryExecutor = {
  query: (text: string, params?: (number | string | null)[]) => Promise<unknown>
}

function getDatabaseURL(): string {
  return (
    process.env.PAYLOAD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
  )
}

function getWeeklyMenuPool(): Pool {
  const globalRef = globalThis as GlobalWithWeeklyMenuPool
  if (!globalRef.__weeklyMenuPool) {
    globalRef.__weeklyMenuPool = new Pool({ connectionString: getDatabaseURL() })
  }
  return globalRef.__weeklyMenuPool
}

async function saveSlotsAndDishesRaw(
  executor: QueryExecutor,
  planId: number,
  slots: GeneratedSlot[],
): Promise<void> {
  if (slots.length === 0) return

  const slotValues = slots
    .map((_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`)
    .join(', ')
  const slotParams: (number | string)[] = [planId]
  for (const slot of slots) {
    slotParams.push(slot.dayOfWeek)
    slotParams.push(slot.mealType)
  }

  const slotInsert = (await executor.query(
    `
      INSERT INTO meal_slots (plan_id, day_of_week, meal_type)
      VALUES ${slotValues}
      RETURNING id, day_of_week, meal_type
    `,
    slotParams,
  )) as {
    rows: Array<{
      id: number
      day_of_week: number
      meal_type: MealType
    }>
  }

  const slotIdMap = new Map<string, number>()
  for (const row of slotInsert.rows) {
    slotIdMap.set(`${row.day_of_week}-${row.meal_type}`, row.id)
  }

  const dishRows: {
    slotId: number
    dishId: number
    categorySnapshot: DishCategory
    mainIngredientSnapshot: string
  }[] = []

  for (const slot of slots) {
    const slotId = slotIdMap.get(`${slot.dayOfWeek}-${slot.mealType}`)
    if (!slotId) continue

    for (const dish of slot.dishes) {
      dishRows.push({
        slotId,
        dishId: dish.dishId,
        categorySnapshot: dish.category,
        mainIngredientSnapshot: dish.mainIngredient,
      })
    }
  }

  if (dishRows.length === 0) return

  const dishValues = dishRows
    .map((_, index) => {
      const base = index * 4
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`
    })
    .join(', ')

  const dishParams: (number | string)[] = []
  for (const row of dishRows) {
    dishParams.push(row.slotId)
    dishParams.push(row.dishId)
    dishParams.push(row.categorySnapshot)
    dishParams.push(row.mainIngredientSnapshot)
  }

  await executor.query(
    `
      INSERT INTO meal_dishes (slot_id, dish_id, category_snapshot, main_ingredient_snapshot)
      VALUES ${dishValues}
    `,
    dishParams,
  )
}

async function updateExistingPlanRaw(
  planId: number,
  userId: number,
  sourcePlanId: number | undefined,
  slots: GeneratedSlot[],
): Promise<void> {
  const pool = getWeeklyMenuPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `
        UPDATE weekly_plans
        SET status = 'DRAFT',
            source_plan_id = $2,
            updated_at = now()
        WHERE id = $1
          AND user_id = $3
      `,
      [planId, sourcePlanId ?? null, userId],
    )

    await client.query(`DELETE FROM meal_slots WHERE plan_id = $1`, [planId])
    await saveSlotsAndDishesRaw(client, planId, slots)

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getUserTemplate(
  userId: number,
): Promise<MealTemplate> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'user-meal-templates',
    where: { userId: { equals: userId } },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  if (result.totalDocs === 0) return DEFAULT_TEMPLATE
  const doc = result.docs[0]
  return {
    meatCount: (doc.meatCount as number) ?? 1,
    leafyGreenCount: (doc.leafyGreenCount as number) ?? 1,
    otherCount: (doc.otherCount as number) ?? 1,
  }
}

export async function upsertUserTemplate(
  userId: number,
  template: MealTemplate,
): Promise<MealTemplate> {
  const payload = await getPayloadClient()
  const existing = await payload.find({
    collection: 'user-meal-templates',
    where: { userId: { equals: userId } },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    const doc = await payload.update({
      collection: 'user-meal-templates',
      id: existing.docs[0].id,
      data: {
        meatCount: template.meatCount,
        leafyGreenCount: template.leafyGreenCount,
        otherCount: template.otherCount,
      },
      overrideAccess: true,
    })
    return {
      meatCount: doc.meatCount as number,
      leafyGreenCount: doc.leafyGreenCount as number,
      otherCount: doc.otherCount as number,
    }
  }

  const doc = await payload.create({
    collection: 'user-meal-templates',
    data: {
      userId,
      meatCount: template.meatCount,
      leafyGreenCount: template.leafyGreenCount,
      otherCount: template.otherCount,
    },
    overrideAccess: true,
  })
  return {
    meatCount: doc.meatCount as number,
    leafyGreenCount: doc.leafyGreenCount as number,
    otherCount: doc.otherCount as number,
  }
}

export async function getActiveDishes(
  userId: number,
): Promise<DishRecord[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'dishes',
    where: {
      isActive: { equals: true },
      or: [
        { ownerUserId: { equals: null } },
        { ownerUserId: { equals: userId } },
      ],
    },
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  return result.docs.map((d) => ({
    id: d.id as number,
    ownerUserId: d.ownerUserId as number | null,
    name: d.name as string,
    category: d.category as DishCategory,
    mainIngredient: d.mainIngredient as string,
    tags: (d.tags as string[]) ?? [],
    isActive: d.isActive as boolean,
  }))
}

export async function getUserPreferences(
  userId: number,
): Promise<DishPreferenceMap> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'dish-preferences',
    where: { userId: { equals: userId } },
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })
  const map: DishPreferenceMap = {}
  for (const doc of result.docs) {
    map[doc.dishId as number] = (doc.rating as number) ?? 3
  }
  return map
}

export async function getPrevWeekLastMealIngredients(
  userId: number,
  prevWeekStartDate: string,
): Promise<Partial<Record<DishCategory, string>>> {
  const payload = await getPayloadClient()

  const planResult = await payload.find({
    collection: 'weekly-plans',
    where: {
      userId: { equals: userId },
      weekStartDate: { equals: prevWeekStartDate },
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  if (planResult.totalDocs === 0) return {}

  const planId = planResult.docs[0].id as number

  const slotsResult = await payload.find({
    collection: 'meal-slots',
    where: {
      planId: { equals: planId },
      dayOfWeek: { equals: 7 },
      mealType: { equals: 'DINNER' },
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  if (slotsResult.totalDocs === 0) return {}

  const slotId = slotsResult.docs[0].id as number

  const dishesResult = await payload.find({
    collection: 'meal-dishes',
    where: { slotId: { equals: slotId } },
    limit: 10,
    pagination: false,
    overrideAccess: true,
  })

  const result: Partial<Record<DishCategory, string>> = {}
  for (const doc of dishesResult.docs) {
    const cat = doc.categorySnapshot as DishCategory
    if (cat && !result[cat]) {
      result[cat] = doc.mainIngredientSnapshot as string
    }
  }
  return result
}

export async function getWeeklyPlan(
  userId: number,
  weekStartDate: string,
) {
  const payload = await getPayloadClient()
  // Use date range instead of equals: Payload/PostgreSQL date "equals" can fail
  // due to timezone/format mismatch (see payloadcms/payload#12413, #4222).
  const nextDay = getNextDay(weekStartDate)
  const result = await payload.find({
    collection: 'weekly-plans',
    where: {
      and: [
        { userId: { equals: userId } },
        { weekStartDate: { greater_than_equal: weekStartDate } },
        { weekStartDate: { less_than: nextDay } },
      ],
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  if (result.totalDocs === 0) return null
  return result.docs[0]
}

export async function getFullPlanSlots(
  planId: number,
): Promise<GeneratedSlot[]> {
  const payload = await getPayloadClient()

  const slotsResult = await payload.find({
    collection: 'meal-slots',
    where: { planId: { equals: planId } },
    limit: 100,
    pagination: false,
    overrideAccess: true,
    sort: 'dayOfWeek',
  })

  const slots: GeneratedSlot[] = []
  for (const slot of slotsResult.docs) {
    const dishesResult = await payload.find({
      collection: 'meal-dishes',
      where: { slotId: { equals: slot.id as number } },
      limit: 10,
      pagination: false,
      overrideAccess: true,
    })

    const dishes: GeneratedDish[] = dishesResult.docs.map((d) => ({
      dishId: d.dishId as number,
      name: '',
      category: d.categorySnapshot as DishCategory,
      mainIngredient: d.mainIngredientSnapshot as string,
    }))

    const dishIds = dishes.map((d) => d.dishId)
    if (dishIds.length > 0) {
      const dishRecords = await payload.find({
        collection: 'dishes',
        where: { id: { in: dishIds } },
        limit: 100,
        pagination: false,
        overrideAccess: true,
      })
      const nameMap = new Map(
        dishRecords.docs.map((dr) => [dr.id as number, dr.name as string]),
      )
      for (const dish of dishes) {
        dish.name = nameMap.get(dish.dishId) ?? '(已删除)'
      }
    }

    slots.push({
      dayOfWeek: slot.dayOfWeek as number,
      mealType: slot.mealType as MealType,
      dishes,
    })
  }

  slots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.mealType === 'LUNCH' ? -1 : 1
  })

  return slots
}

export async function savePlanToDb(
  userId: number,
  weekStartDate: string,
  slots: GeneratedSlot[],
  sourcePlanId?: number,
  existingPlanId?: number,
) {
  const payload = await getPayloadClient()

  if (existingPlanId) {
    try {
      await updateExistingPlanRaw(existingPlanId, userId, sourcePlanId, slots)
      return {
        id: existingPlanId,
        weekStartDate,
        status: 'DRAFT',
      }
    } catch (error) {
      console.error('Fast draft save path failed:', error)
    }
  }

  if (!existingPlanId) {
    const existing = await getWeeklyPlan(userId, weekStartDate)
    if (existing) {
      await payload.delete({
        collection: 'weekly-plans',
        id: existing.id,
        overrideAccess: true,
      })
    }
  }

  const plan = await payload.create({
    collection: 'weekly-plans',
    data: {
      userId,
      weekStartDate,
      status: 'DRAFT',
      ...(sourcePlanId ? { sourcePlanId } : {}),
    },
    overrideAccess: true,
  })

  try {
    const pool = getWeeklyMenuPool()
    await saveSlotsAndDishesRaw(pool, plan.id as number, slots)
  } catch {
    await Promise.all(
      slots.map(async (slot) => {
        const slotDoc = await payload.create({
          collection: 'meal-slots',
          data: {
            planId: plan.id as number,
            dayOfWeek: slot.dayOfWeek,
            mealType: slot.mealType,
          },
          overrideAccess: true,
        })

        await Promise.all(
          slot.dishes.map((dish) =>
            payload.create({
              collection: 'meal-dishes',
              data: {
                slotId: slotDoc.id as number,
                dishId: dish.dishId,
                categorySnapshot: dish.category,
                mainIngredientSnapshot: dish.mainIngredient,
              },
              overrideAccess: true,
            }),
          ),
        )
      }),
    )
  }

  return plan
}

export async function confirmPlan(planId: number) {
  const payload = await getPayloadClient()
  return payload.update({
    collection: 'weekly-plans',
    id: planId,
    data: { status: 'CONFIRMED' },
    overrideAccess: true,
  })
}

export async function deletePlan(userId: number, planId: number): Promise<boolean> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'weekly-plans',
    where: {
      id: { equals: planId },
      userId: { equals: userId },
    },
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const plan = result.docs[0]
  if (!plan) return false

  await payload.delete({
    collection: 'weekly-plans',
    id: planId,
    overrideAccess: true,
  })
  return true
}

export async function deleteAllHistoryPlans(userId: number): Promise<number> {
  const payload = await getPayloadClient()
  const plans = await payload.find({
    collection: 'weekly-plans',
    where: { userId: { equals: userId } },
    limit: 1000,
    pagination: false,
    overrideAccess: true,
  })

  if (plans.totalDocs === 0) return 0

  await Promise.all(
    plans.docs.map((plan) =>
      payload.delete({
        collection: 'weekly-plans',
        id: plan.id,
        overrideAccess: true,
      }),
    ),
  )

  return plans.totalDocs
}
