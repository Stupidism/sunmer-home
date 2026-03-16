import type { CollectionConfig } from 'payload'

export const EmotionIntensities: CollectionConfig = {
  slug: 'emotion-intensities',
  admin: {
    useAsTitle: 'emotion',
    group: 'Content',
    defaultColumns: ['emotion', 'legacyId', 'updatedAt'],
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
      name: 'emotion',
      type: 'text',
      required: true,
    },
    {
      name: 'mild',
      type: 'text',
      required: true,
    },
    {
      name: 'moderate',
      type: 'text',
      required: true,
    },
    {
      name: 'severe',
      type: 'text',
      required: true,
    },
    {
      name: 'color',
      type: 'text',
      required: true,
    },
  ],
}
