import type { CollectionConfig } from 'payload'

export const LifeEvents: CollectionConfig = {
  slug: 'life-events',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['date', 'title', 'type', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
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
      name: 'date',
      type: 'text',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['positive', 'negative'],
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'url',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
