import type { CollectionConfig } from 'payload'

export const MindfulnessScenarios: CollectionConfig = {
  slug: 'mindfulness-scenarios',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'legacyId', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'legacyId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'icon',
      type: 'text',
      required: true,
    },
    {
      name: 'color',
      type: 'text',
      required: true,
    },
    {
      name: 'situation',
      type: 'textarea',
      required: true,
    },
    {
      name: 'cycle',
      type: 'textarea',
      required: true,
    },
    {
      name: 'steps',
      type: 'json',
      required: true,
    },
    {
      name: 'questions',
      type: 'array',
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
