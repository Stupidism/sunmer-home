import type { CollectionConfig } from 'payload'

const recipeCategoryOptions = [
  {
    label: '大荤',
    value: 'big-meat',
  },
  {
    label: '小荤',
    value: 'small-meat',
  },
  {
    label: '素菜',
    value: 'vegetable',
  },
]

export const PlannerRecipes: CollectionConfig = {
  slug: 'planner-recipes',
  labels: {
    singular: '菜谱',
    plural: '菜谱库',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'name',
      label: 'Recipe Name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'category',
      label: 'Filter',
      type: 'select',
      required: true,
      index: true,
      options: recipeCategoryOptions,
      defaultValue: 'vegetable',
    },
    {
      name: 'ingredients',
      label: 'Ingredients',
      type: 'array',
      required: false,
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      required: false,
    },
  ],
}
