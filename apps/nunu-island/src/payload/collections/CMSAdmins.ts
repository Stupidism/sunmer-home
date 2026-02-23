import type { Access, CollectionConfig } from 'payload'

const canCreateAdmin: Access = async ({ req }) => {
  if (req.user) return true

  const result = await req.payload.count({
    collection: 'cms-admins',
    overrideAccess: true,
  })

  return result.totalDocs === 0
}

export const CMSAdmins: CollectionConfig = {
  slug: 'cms-admins',
  admin: {
    useAsTitle: 'email',
    group: 'System',
  },
  auth: true,
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
    create: canCreateAdmin,
  },
  fields: [
    {
      name: 'displayName',
      label: 'Display Name',
      type: 'text',
    },
  ],
}
