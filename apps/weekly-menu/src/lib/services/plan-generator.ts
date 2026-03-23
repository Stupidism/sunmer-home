import type {
  DishCategory,
  DishRecord,
  MealTemplate,
  MealType,
  GeneratedDish,
  GeneratedSlot,
  GeneratedPlan,
  DishPreferenceMap,
} from '@/lib/types'

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const
const MEALS: MealType[] = ['LUNCH', 'DINNER']
const SLOT_COUNT = 14

type PrevWeekIngredients = Partial<Record<DishCategory, string>>

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function weightedRandom(
  candidates: DishRecord[],
  preferences: DishPreferenceMap,
): DishRecord {
  const weights = candidates.map((d) => preferences[d.id] ?? 3)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let rand = Math.random() * totalWeight
  for (let i = 0; i < candidates.length; i++) {
    rand -= weights[i]
    if (rand <= 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

function rotateToAvoid(ingredients: string[], avoid: string | undefined): string[] {
  if (!avoid || ingredients.length < 2) return ingredients
  const idx = ingredients.indexOf(avoid)
  if (idx === 0) {
    return [...ingredients.slice(1), ingredients[0]]
  }
  return ingredients
}

function fillCategory(
  category: DishCategory,
  count: number,
  pool: DishRecord[],
  preferences: DishPreferenceMap,
  prevIngredient: string | undefined,
): { picks: (GeneratedDish | null)[][], warnings: string[] } {
  const warnings: string[] = []
  const ingredients = shuffle(
    [...new Set(pool.map((d) => d.mainIngredient))],
  )

  const rotated = rotateToAvoid(ingredients, prevIngredient)
  const usedDishNames = new Set<string>()
  const ingredientCounts = new Map<string, number>()

  const picks: (GeneratedDish | null)[][] = Array.from(
    { length: SLOT_COUNT },
    () => [],
  )

  let rotationIdx = 0

  for (let slotIdx = 0; slotIdx < SLOT_COUNT; slotIdx++) {
    for (let i = 0; i < count; i++) {
      const targetIngredient = rotated[rotationIdx % rotated.length]
      rotationIdx++

      let candidates = pool.filter(
        (d) =>
          d.mainIngredient === targetIngredient &&
          !usedDishNames.has(d.name),
      )

      if (candidates.length === 0) {
        candidates = pool.filter(
          (d) => d.mainIngredient === targetIngredient,
        )
        if (candidates.length > 0) {
          warnings.push('部分菜名周内重复，已尽力优化')
        }
      }

      if (candidates.length === 0) {
        candidates = pool.filter(
          (d) => !usedDishNames.has(d.name),
        )
        if (candidates.length === 0) {
          candidates = [...pool]
        }
        if (candidates.length > 0) {
          warnings.push('菜品库不足，部分食材约束已放宽')
        }
      }

      if (candidates.length === 0) {
        picks[slotIdx].push(null)
        continue
      }

      const pick =
        category === 'MEAT'
          ? weightedRandom(candidates, preferences)
          : candidates[Math.floor(Math.random() * candidates.length)]

      picks[slotIdx].push({
        dishId: pick.id,
        name: pick.name,
        category: pick.category,
        mainIngredient: pick.mainIngredient,
      })

      usedDishNames.add(pick.name)
      ingredientCounts.set(
        pick.mainIngredient,
        (ingredientCounts.get(pick.mainIngredient) ?? 0) + 1,
      )
    }
  }

  return { picks, warnings: [...new Set(warnings)] }
}

export function generateWeeklyPlan(
  weekStartDate: string,
  template: MealTemplate,
  activeDishes: DishRecord[],
  preferences: DishPreferenceMap,
  prevWeekIngredients?: PrevWeekIngredients,
): GeneratedPlan {
  const allWarnings: string[] = []

  const categoryConfigs: {
    category: DishCategory
    count: number
  }[] = [
    { category: 'MEAT', count: template.meatCount },
    { category: 'LEAFY_GREEN', count: template.leafyGreenCount },
    { category: 'OTHER', count: template.otherCount },
  ]

  const slotPicks: GeneratedDish[][] = Array.from(
    { length: SLOT_COUNT },
    () => [],
  )

  for (const { category, count } of categoryConfigs) {
    if (count === 0) continue

    const pool = activeDishes.filter(
      (d) => d.category === category && d.isActive,
    )

    if (pool.length === 0) {
      allWarnings.push(`${category} 类别无可用菜品`)
      continue
    }

    const prevIngredient = prevWeekIngredients?.[category]
    const { picks, warnings } = fillCategory(
      category,
      count,
      pool,
      preferences,
      prevIngredient,
    )

    for (let i = 0; i < SLOT_COUNT; i++) {
      for (const pick of picks[i]) {
        if (pick) slotPicks[i].push(pick)
      }
    }

    allWarnings.push(...warnings)
  }

  const slots: GeneratedSlot[] = []
  let slotIdx = 0
  for (const day of DAYS) {
    for (const mealType of MEALS) {
      slots.push({
        dayOfWeek: day,
        mealType,
        dishes: slotPicks[slotIdx] ?? [],
      })
      slotIdx++
    }
  }

  return {
    weekStartDate,
    slots,
    warnings: [...new Set(allWarnings)],
  }
}
