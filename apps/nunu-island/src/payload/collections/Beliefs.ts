import type { CollectionConfig } from 'payload'

export const Beliefs: CollectionConfig = {
  slug: 'beliefs',
  admin: {
    useAsTitle: 'newBelief',
    group: 'Content',
    defaultColumns: ['order', 'newBelief', 'updatedAt'],
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
      unique: true,
      index: true,
      required: true,
    },
    {
      name: 'order',
      type: 'number',
      required: true,
    },
    {
      name: 'oldBelief',
      type: 'text',
      required: true,
    },
    {
      name: 'newBelief',
      type: 'text',
      required: true,
    },
    {
      name: 'color',
      type: 'text',
      required: true,
    },
    {
      name: 'bgColor',
      type: 'text',
      required: true,
    },
    {
      name: 'theory',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'methods',
      type: 'json',
      required: true,
    },
    {
      name: 'dailyApplication',
      type: 'array',
      required: true,
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
