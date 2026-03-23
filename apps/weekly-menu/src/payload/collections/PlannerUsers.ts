import type { CollectionConfig } from 'payload'

export const PlannerUsers: CollectionConfig = {
  slug: 'planner-users',
  dbName: 'planner_users',
  admin: {
    useAsTitle: 'username',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => false,
  },
  fields: [
    {
      name: 'username',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'password',
      type: 'text',
      required: true,
      admin: { hidden: true },
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'text',
      defaultValue: 'USER',
    },
  ],
}
