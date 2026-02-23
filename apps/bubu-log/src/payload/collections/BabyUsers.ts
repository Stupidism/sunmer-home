import type { CollectionConfig } from 'payload'
import { isCMSAdmin } from '../access/isCMSAdmin.ts'
import { ensureTextId } from '../utils/document.ts'

export const BabyUsers: CollectionConfig = {
  slug: 'baby-users',
  dbName: 'BabyUser',
  timestamps: false,
  admin: {
    group: '业务数据',
    useAsTitle: 'id',
    defaultColumns: ['baby', 'user', 'isDefault', 'createdAt'],
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: isCMSAdmin,
    read: isCMSAdmin,
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  indexes: [
    {
      fields: ['baby', 'user'],
      unique: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (!data) {
          return data
        }

        const nextData = ensureTextId({ ...data } as Record<string, unknown>)
        // Backward compatibility for callers still sending babyId/userId.
        if (!nextData.baby && nextData.babyId) {
          nextData.baby = nextData.babyId
        }
        if (!nextData.user && nextData.userId) {
          nextData.user = nextData.userId
        }
        delete nextData.babyId
        delete nextData.userId

        if (operation === 'create' && !nextData.createdAt) {
          nextData.createdAt = new Date().toISOString()
        }
        return nextData
      },
    ],
  },
  fields: [
    {
      name: 'id',
      label: 'ID',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'baby',
      label: '宝宝 ID',
      type: 'relationship',
      relationTo: 'babies',
      required: true,
    },
    {
      name: 'user',
      label: '用户 ID',
      type: 'relationship',
      relationTo: 'app-users',
      required: true,
    },
    {
      name: 'isDefault',
      label: '默认宝宝',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'createdAt',
      label: '创建时间',
      type: 'date',
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
