import type { CollectionConfig } from 'payload'

export const CMSAdmins: CollectionConfig = {
  slug: 'cms-admins',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: false,
    },
  ],
}
