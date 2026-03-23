import type { CollectionConfig } from 'payload'

export const UserMealTemplates: CollectionConfig = {
  slug: 'user-meal-templates',
  dbName: 'user_meal_templates',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['userId', 'meatCount', 'leafyGreenCount', 'otherCount', 'updatedAt'],
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
      unique: true,
    },
    {
      name: 'meatCount',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      max: 3,
    },
    {
      name: 'leafyGreenCount',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      max: 3,
    },
    {
      name: 'otherCount',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 0,
      max: 3,
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
