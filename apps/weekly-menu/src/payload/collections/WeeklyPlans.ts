import type { CollectionConfig } from 'payload'

const planStatusOptions = ['DRAFT', 'CONFIRMED'] as const

export const WeeklyPlans: CollectionConfig = {
  slug: 'weekly-plans',
  dbName: 'weekly_plans',
  lockDocuments: false,
  admin: {
    useAsTitle: 'weekStartDate',
    defaultColumns: ['userId', 'weekStartDate', 'status', 'updatedAt'],
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
      name: 'weekStartDate',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'DRAFT',
      options: planStatusOptions.map((value) => ({ label: value, value })),
    },
    {
      name: 'sourcePlanId',
      type: 'number',
    },
  ],
}
