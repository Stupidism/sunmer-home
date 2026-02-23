import type { CollectionConfig } from 'payload'
import { isCMSAdmin } from '../access/isCMSAdmin.ts'
import { ensureTextId, touchTimestamps } from '../utils/document.ts'

export const Babies: CollectionConfig = {
  slug: 'babies',
  dbName: 'Baby',
  timestamps: false,
  admin: {
    useAsTitle: 'name',
    group: '业务数据',
    defaultColumns: ['name', 'gender', 'birthDate', 'createdAt'],
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: isCMSAdmin,
    read: isCMSAdmin,
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (!data) {
          return data
        }

        const nextData = ensureTextId({ ...data } as Record<string, unknown>)
        touchTimestamps(nextData, operation)
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
      name: 'name',
      label: '宝宝小名（昵称）',
      type: 'text',
      required: true,
    },
    {
      name: 'fullName',
      label: '宝宝大名',
      type: 'text',
    },
    {
      name: 'avatarUrl',
      label: '头像 URL',
      type: 'text',
    },
    {
      name: 'birthDate',
      label: '出生日期',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'gender',
      label: '性别',
      type: 'select',
      required: true,
      defaultValue: 'OTHER',
      options: [
        { label: '男孩', value: 'BOY' },
        { label: '女孩', value: 'GIRL' },
        { label: '其他', value: 'OTHER' },
      ],
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
    {
      name: 'updatedAt',
      label: '更新时间',
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
