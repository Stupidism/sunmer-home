import type { CollectionConfig } from 'payload'
import { isCMSAdmin } from '../access/isCMSAdmin.ts'
import { ensureTextId, touchTimestamps } from '../utils/document.ts'

export const DailyStats: CollectionConfig = {
  slug: 'daily-stats',
  dbName: 'DailyStat',
  timestamps: false,
  admin: {
    group: '业务数据',
    useAsTitle: 'id',
    defaultColumns: ['date', 'babyId', 'sleepCount', 'totalSleepMinutes', 'createdAt'],
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
      fields: ['babyId', 'date'],
      unique: true,
    },
    {
      fields: ['babyId'],
    },
    {
      fields: ['date'],
    },
  ],
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
    { name: 'id', label: 'ID', type: 'text', required: true, unique: true, admin: { readOnly: true } },
    {
      name: 'date',
      label: '统计日期',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    { name: 'babyId', label: '宝宝 ID', type: 'text', required: true },
    { name: 'sleepCount', label: '睡眠次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'totalSleepMinutes', label: '睡眠总分钟', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'breastfeedCount', label: '亲喂次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'totalBreastfeedMinutes', label: '亲喂总分钟', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'bottleCount', label: '瓶喂次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'totalMilkAmount', label: '瓶喂总奶量', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'pumpCount', label: '吸奶次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'totalPumpMilkAmount', label: '吸奶总奶量', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'diaperCount', label: '尿布次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'poopCount', label: '大便次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'peeCount', label: '小便次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'exerciseCount', label: '活动次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'totalHeadLiftMinutes', label: '抬头总分钟', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'supplementADCount', label: 'AD 次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'supplementD3Count', label: 'D3 次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'supplementProbioticsCount', label: '益生菌次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'supplementPrebioticsCount', label: '益生元次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'spitUpCount', label: '吐奶次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    { name: 'projectileSpitUpCount', label: '喷射吐奶次数', type: 'number', required: true, defaultValue: 0, min: 0, admin: { step: 1 } },
    {
      name: 'createdAt',
      label: '创建时间',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'updatedAt',
      label: '更新时间',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
}
