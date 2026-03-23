const dishCategories = ['MEAT', 'LEAFY_GREEN', 'OTHER'] as const
type DishCategory = (typeof dishCategories)[number]

const mealTypes = ['LUNCH', 'DINNER'] as const
type MealType = (typeof mealTypes)[number]

const planStatuses = ['DRAFT', 'CONFIRMED'] as const
type PlanStatus = (typeof planStatuses)[number]

const defaultCookingMethods = ['炒', '蒸', '炖', '凉拌', '汤', '烤', '煎', '炸'] as const
type CookingMethod = (typeof defaultCookingMethods)[number]

type DishRecord = {
  id: number
  ownerUserId: number | null
  name: string
  category: DishCategory
  mainIngredient: string
  tags: string[]
  isActive: boolean
}

type MealTemplate = {
  meatCount: number
  leafyGreenCount: number
  otherCount: number
}

type GeneratedDish = {
  dishId: number
  name: string
  category: DishCategory
  mainIngredient: string
}

type GeneratedSlot = {
  dayOfWeek: number
  mealType: MealType
  dishes: GeneratedDish[]
}

type GeneratedPlan = {
  weekStartDate: string
  slots: GeneratedSlot[]
  warnings: string[]
}

type DishPreferenceMap = Record<number, number>

export { dishCategories, mealTypes, planStatuses, defaultCookingMethods }
export type {
  DishCategory,
  MealType,
  PlanStatus,
  CookingMethod,
  DishRecord,
  MealTemplate,
  GeneratedDish,
  GeneratedSlot,
  GeneratedPlan,
  DishPreferenceMap,
}
