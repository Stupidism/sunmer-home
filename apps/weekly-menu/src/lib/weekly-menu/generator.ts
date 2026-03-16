import {
  BIG_MEAT_DISH_NAMES,
  SMALL_MEAT_DISH_NAMES,
  VEGETABLE_DISH_NAMES,
} from '@/lib/weekly-menu/dishes'

export const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
export const MEAL_LABELS = ['午餐', '晚餐'] as const

type MealLabel = (typeof MEAL_LABELS)[number]
type WeekDay = (typeof WEEK_DAYS)[number]
export type DishSlot = 'bigMeat' | 'smallMeat' | 'vegetable'

export type PlannedMeal = {
  label: MealLabel
  bigMeat: string
  smallMeat: string
  vegetable: string
}

export type PlannedDay = {
  day: WeekDay
  meals: PlannedMeal[]
}

export type WeeklyPlan = PlannedDay[]

export type CustomDishPools = {
  bigMeat?: string[]
  smallMeat?: string[]
  vegetable?: string[]
}

const dishPoolBySlot: Record<DishSlot, readonly string[]> = {
  bigMeat: BIG_MEAT_DISH_NAMES,
  smallMeat: SMALL_MEAT_DISH_NAMES,
  vegetable: VEGETABLE_DISH_NAMES,
}

function buildPool(slot: DishSlot, customDishPools?: CustomDishPools): string[] {
  const basePool = [...dishPoolBySlot[slot]]
  const customPool =
    slot === 'bigMeat'
      ? customDishPools?.bigMeat
      : slot === 'smallMeat'
        ? customDishPools?.smallMeat
        : customDishPools?.vegetable

  const seen = new Set<string>()
  const merged: string[] = []

  for (const item of [...basePool, ...(customPool ?? [])]) {
    const normalized = item.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    merged.push(normalized)
  }

  return merged
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function flattenSlot(plan: WeeklyPlan | null | undefined, slot: DishSlot): string[] {
  if (!plan) {
    return []
  }

  const flattened: string[] = []
  for (const day of plan) {
    for (const meal of day.meals) {
      flattened.push(meal[slot])
    }
  }
  return flattened
}

function minDistanceFromIndexes(indexes: number[] | undefined, target: number): number {
  if (!indexes || indexes.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  let best = Number.POSITIVE_INFINITY
  for (const index of indexes) {
    best = Math.min(best, Math.abs(target - index))
  }
  return best
}

function buildSequenceWithHistory(
  pool: readonly string[],
  total: number,
  previousSequence: readonly string[]
): string[] {
  if (pool.length === 0 || total <= 0) {
    return []
  }

  const previousIndexes = new Map<string, number[]>()
  previousSequence.forEach((dish, index) => {
    const list = previousIndexes.get(dish)
    if (list) {
      list.push(index)
      return
    }
    previousIndexes.set(dish, [index])
  })

  const currentUsage = new Map<string, number>()
  const sequence: string[] = []

  for (let position = 0; position < total; position += 1) {
    const candidates = shuffle(pool)
    const previousDish = sequence[position - 1]

    candidates.sort((left, right) => {
      const leftRepeatedLastWeek = previousIndexes.has(left) ? 1 : 0
      const rightRepeatedLastWeek = previousIndexes.has(right) ? 1 : 0
      if (leftRepeatedLastWeek !== rightRepeatedLastWeek) {
        return leftRepeatedLastWeek - rightRepeatedLastWeek
      }

      const leftUsage = currentUsage.get(left) ?? 0
      const rightUsage = currentUsage.get(right) ?? 0
      if (leftUsage !== rightUsage) {
        return leftUsage - rightUsage
      }

      const leftDistance = minDistanceFromIndexes(previousIndexes.get(left), position)
      const rightDistance = minDistanceFromIndexes(previousIndexes.get(right), position)
      if (leftDistance !== rightDistance) {
        return rightDistance - leftDistance
      }

      return Math.random() - 0.5
    })

    const chosen = candidates.find((dish) => dish !== previousDish) ?? candidates[0]
    sequence.push(chosen)
    currentUsage.set(chosen, (currentUsage.get(chosen) ?? 0) + 1)
  }

  return sequence
}

export function generateWeeklyMenu(previousWeekPlan?: WeeklyPlan, customDishPools?: CustomDishPools): PlannedDay[] {
  const totalMeals = WEEK_DAYS.length * MEAL_LABELS.length
  const previousBigMeat = flattenSlot(previousWeekPlan, 'bigMeat')
  const previousSmallMeat = flattenSlot(previousWeekPlan, 'smallMeat')
  const previousVegetable = flattenSlot(previousWeekPlan, 'vegetable')

  const bigMeatSequence = buildSequenceWithHistory(buildPool('bigMeat', customDishPools), totalMeals, previousBigMeat)
  const smallMeatSequence = buildSequenceWithHistory(
    buildPool('smallMeat', customDishPools),
    totalMeals,
    previousSmallMeat
  )
  const vegetableSequence = buildSequenceWithHistory(
    buildPool('vegetable', customDishPools),
    totalMeals,
    previousVegetable
  )

  return WEEK_DAYS.map((day, dayIndex) => {
    const meals = MEAL_LABELS.map((label, mealIndex) => {
      const index = dayIndex * MEAL_LABELS.length + mealIndex
      return {
        label,
        bigMeat: bigMeatSequence[index],
        smallMeat: smallMeatSequence[index],
        vegetable: vegetableSequence[index],
      }
    })

    return { day, meals }
  })
}

function countSlotUsage(plan: PlannedDay[], slot: DishSlot): Map<string, number> {
  const usage = new Map<string, number>()

  for (const day of plan) {
    for (const meal of day.meals) {
      const dishName = meal[slot]
      usage.set(dishName, (usage.get(dishName) ?? 0) + 1)
    }
  }

  return usage
}

export function replaceDishInPlan(
  plan: PlannedDay[],
  dayIndex: number,
  mealIndex: number,
  slot: DishSlot,
  previousWeekPlan?: WeeklyPlan,
  customDishPools?: CustomDishPools
): PlannedDay[] {
  const day = plan[dayIndex]
  const meal = day?.meals[mealIndex]
  if (!meal) {
    return plan
  }

  const currentDish = meal[slot]
  const pool = buildPool(slot, customDishPools)
  const candidates = pool.filter((dish) => dish !== currentDish)
  if (candidates.length === 0) {
    return plan
  }

  const usage = countSlotUsage(plan, slot)
  const targetPosition = dayIndex * MEAL_LABELS.length + mealIndex
  const previousSequence = flattenSlot(previousWeekPlan, slot)
  const previousIndexes = new Map<string, number[]>()
  previousSequence.forEach((dish, index) => {
    const list = previousIndexes.get(dish)
    if (list) {
      list.push(index)
      return
    }
    previousIndexes.set(dish, [index])
  })

  const rankedCandidates = shuffle(candidates).sort((left, right) => {
    const leftRepeatedLastWeek = previousIndexes.has(left) ? 1 : 0
    const rightRepeatedLastWeek = previousIndexes.has(right) ? 1 : 0
    if (leftRepeatedLastWeek !== rightRepeatedLastWeek) {
      return leftRepeatedLastWeek - rightRepeatedLastWeek
    }

    const leftUsage = usage.get(left) ?? 0
    const rightUsage = usage.get(right) ?? 0
    if (leftUsage !== rightUsage) {
      return leftUsage - rightUsage
    }

    const leftDistance = minDistanceFromIndexes(previousIndexes.get(left), targetPosition)
    const rightDistance = minDistanceFromIndexes(previousIndexes.get(right), targetPosition)
    if (leftDistance !== rightDistance) {
      return rightDistance - leftDistance
    }

    return Math.random() - 0.5
  })

  const replacement = rankedCandidates[0]

  return plan.map((dayItem, dIndex) => {
    if (dIndex !== dayIndex) {
      return dayItem
    }

    return {
      ...dayItem,
      meals: dayItem.meals.map((mealItem, mIndex) =>
        mIndex === mealIndex
          ? {
              ...mealItem,
              [slot]: replacement,
            }
          : mealItem
      ),
    }
  })
}
