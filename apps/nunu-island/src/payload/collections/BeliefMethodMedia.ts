import type { CollectionConfig } from 'payload'

export const BeliefMethodMedia: CollectionConfig = {
  slug: 'belief-method-media',
  admin: {
    useAsTitle: 'caption',
    group: 'Content',
    defaultColumns: ['methodId', 'type', 'caption', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'methodId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: ['image', 'video', 'audio'],
    },
    {
      name: 'url',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      name: 'sortOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
  ],
}
