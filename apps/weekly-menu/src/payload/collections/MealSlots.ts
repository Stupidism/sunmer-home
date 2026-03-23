import type { CollectionConfig } from 'payload'

const mealTypeOptions = ['LUNCH', 'DINNER'] as const

export const MealSlots: CollectionConfig = {
  slug: 'meal-slots',
  dbName: 'meal_slots',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['planId', 'dayOfWeek', 'mealType'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => false,
  },
  fields: [
    {
      name: 'planId',
      type: 'number',
      required: true,
    },
    {
      name: 'dayOfWeek',
      type: 'number',
      required: true,
      min: 1,
      max: 7,
    },
    {
      name: 'mealType',
      type: 'select',
      required: true,
      options: mealTypeOptions.map((value) => ({ label: value, value })),
    },
  ],
}
