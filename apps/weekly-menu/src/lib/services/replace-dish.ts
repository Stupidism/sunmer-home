import type {
  DishCategory,
  DishRecord,
  DishPreferenceMap,
  GeneratedDish,
  GeneratedSlot,
} from '@/lib/types'

type ReplaceCandidateResult = {
  candidates: GeneratedDish[]
}

export function findReplaceCandidates(
  slotIndex: number,
  dishIndex: number,
  category: DishCategory,
  allSlots: GeneratedSlot[],
  pool: DishRecord[],
  preferences: DishPreferenceMap,
  mode: 'random' | 'candidates',
  excludedDishIds: number[] = [],
): ReplaceCandidateResult {
  const excludedSet = new Set<number>(excludedDishIds)
  const prevSlot = slotIndex > 0 ? allSlots[slotIndex - 1] : null
  const nextSlot =
    slotIndex < allSlots.length - 1 ? allSlots[slotIndex + 1] : null

  const currentDish = allSlots[slotIndex]?.dishes[dishIndex]
  if (currentDish?.dishId != null) {
    excludedSet.add(currentDish.dishId)
  }

  const prevIngredients = new Set(
    prevSlot?.dishes
      .filter((d) => d.category === category)
      .map((d) => d.mainIngredient) ?? [],
  )
  const nextIngredients = new Set(
    nextSlot?.dishes
      .filter((d) => d.category === category)
      .map((d) => d.mainIngredient) ?? [],
  )

  const usedDishNames = new Set<string>()
  for (const slot of allSlots) {
    for (const dish of slot.dishes) {
      usedDishNames.add(dish.name)
    }
  }

  const ingredientFrequency = new Map<string, number>()
  for (const slot of allSlots) {
    for (const dish of slot.dishes) {
      if (dish.category === category) {
        ingredientFrequency.set(
          dish.mainIngredient,
          (ingredientFrequency.get(dish.mainIngredient) ?? 0) + 1,
        )
      }
    }
  }

  const categoryPool = pool
    .filter((d) => d.category === category && d.isActive)
    .filter((d) => !excludedSet.has(d.id))

  let candidates = categoryPool
    .filter(
      (d) =>
        !prevIngredients.has(d.mainIngredient) &&
        !nextIngredients.has(d.mainIngredient),
    )

  if (candidates.length === 0) {
    candidates = categoryPool
  }

  const scored = candidates.map((d) => {
    const freq = ingredientFrequency.get(d.mainIngredient) ?? 0
    const nameUnique = usedDishNames.has(d.name) ? 0 : 1
    const rating = preferences[d.id] ?? 3
    return { dish: d, score: -freq * 10 + nameUnique * 5 + rating }
  })

  scored.sort((a, b) => b.score - a.score)

  const result = scored.map((s) => ({
    dishId: s.dish.id,
    name: s.dish.name,
    category: s.dish.category,
    mainIngredient: s.dish.mainIngredient,
  }))

  if (mode === 'random') {
    return { candidates: result.slice(0, 1) }
  }

  return { candidates: result.slice(0, 20) }
}
