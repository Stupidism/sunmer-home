import type { CollectionConfig } from 'payload'

export const TemplateRecords: CollectionConfig = {
  slug: 'template-records',
  admin: {
    useAsTitle: 'templateTitle',
    group: 'Content',
    defaultColumns: ['templateTitle', 'templateId', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'templateId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'templateTitle',
      type: 'text',
      required: true,
    },
    {
      name: 'answers',
      type: 'json',
      required: true,
    },
  ],
}
