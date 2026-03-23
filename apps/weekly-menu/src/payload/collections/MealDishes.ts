import type { CollectionConfig } from 'payload'

const dishCategoryOptions = ['MEAT', 'LEAFY_GREEN', 'OTHER'] as const

export const MealDishes: CollectionConfig = {
  slug: 'meal-dishes',
  dbName: 'meal_dishes',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['slotId', 'dishId', 'categorySnapshot', 'mainIngredientSnapshot'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => false,
  },
  fields: [
    {
      name: 'slotId',
      type: 'number',
      required: true,
    },
    {
      name: 'dishId',
      type: 'number',
      required: true,
    },
    {
      name: 'categorySnapshot',
      type: 'select',
      required: true,
      options: dishCategoryOptions.map((value) => ({ label: value, value })),
    },
    {
      name: 'mainIngredientSnapshot',
      type: 'text',
      required: true,
    },
  ],
}
