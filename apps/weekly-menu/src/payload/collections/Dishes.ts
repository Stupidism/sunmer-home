import type { CollectionConfig } from 'payload'

export const dishesCategories = ['MEAT', 'LEAFY_GREEN', 'OTHER'] as const

export const Dishes: CollectionConfig = {
  slug: 'dishes',
  dbName: 'dishes',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'mainIngredient', 'isActive', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'ownerUserId',
      type: 'number',
      admin: {
        description: 'null 表示系统预置菜',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: dishesCategories.map((value) => ({
        value,
        label: value,
      })),
    },
    {
      name: 'mainIngredient',
      type: 'text',
      required: true,
    },
    {
      name: 'tags',
      type: 'json',
      defaultValue: [],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
