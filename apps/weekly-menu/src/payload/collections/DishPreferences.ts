import type { CollectionConfig } from 'payload'

export const DishPreferences: CollectionConfig = {
  slug: 'dish-preferences',
  dbName: 'dish_preferences',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['userId', 'dishId', 'rating', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => false,
  },
  fields: [
    {
      name: 'userId',
      type: 'number',
      required: true,
    },
    {
      name: 'dishId',
      type: 'number',
      required: true,
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      defaultValue: 3,
      min: 1,
      max: 5,
    },
    {
      name: 'updatedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
  ],
}
