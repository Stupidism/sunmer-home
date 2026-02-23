import type { CollectionConfig } from 'payload'
import { isCMSAdmin } from '../access/isCMSAdmin.ts'
import { ensureTextId, touchTimestamps } from '../utils/document.ts'

export const Activities: CollectionConfig = {
  slug: 'activities',
  dbName: 'Activity',
  timestamps: false,
  admin: {
    group: '业务数据',
    useAsTitle: 'id',
    defaultColumns: ['type', 'startTime', 'endTime', 'babyId', 'createdAt'],
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
      fields: ['babyId'],
    },
    {
      fields: ['type'],
    },
    {
      fields: ['startTime'],
    },
    {
      fields: ['createdAt'],
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
    {
      name: 'id',
      label: 'ID',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'type',
      label: '活动类型',
      type: 'select',
      required: true,
      options: [
        { label: '睡眠', value: 'SLEEP' },
        { label: '换尿布', value: 'DIAPER' },
        { label: '亲喂', value: 'BREASTFEED' },
        { label: '瓶喂', value: 'BOTTLE' },
        { label: '吸奶', value: 'PUMP' },
        { label: '抬头', value: 'HEAD_LIFT' },
        { label: '被动操', value: 'PASSIVE_EXERCISE' },
        { label: '翻身', value: 'ROLL_OVER' },
        { label: '拉坐', value: 'PULL_TO_SIT' },
        { label: '排气操', value: 'GAS_EXERCISE' },
        { label: '洗澡', value: 'BATH' },
        { label: '户外晒太阳', value: 'OUTDOOR' },
        { label: '早教', value: 'EARLY_EDUCATION' },
        { label: '补剂', value: 'SUPPLEMENT' },
        { label: '吐奶', value: 'SPIT_UP' },
      ],
    },
    {
      name: 'startTime',
      label: '开始时间',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'endTime',
      label: '结束时间',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
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
    {
      name: 'babyId',
      label: '宝宝 ID',
      type: 'text',
      required: true,
    },
    {
      name: 'hasPoop',
      label: '有大便',
      type: 'checkbox',
    },
    {
      name: 'hasPee',
      label: '有小便',
      type: 'checkbox',
    },
    {
      name: 'poopColor',
      label: '大便颜色',
      type: 'select',
      options: [
        { label: '黄色', value: 'YELLOW' },
        { label: '绿色', value: 'GREEN' },
        { label: '棕色', value: 'BROWN' },
        { label: '黑色', value: 'BLACK' },
        { label: '白色', value: 'WHITE' },
        { label: '红色', value: 'RED' },
      ],
    },
    {
      name: 'poopPhotoUrl',
      label: '大便照片 URL',
      type: 'text',
    },
    {
      name: 'peeAmount',
      label: '小便量',
      type: 'select',
      options: [
        { label: '少', value: 'SMALL' },
        { label: '中', value: 'MEDIUM' },
        { label: '多', value: 'LARGE' },
      ],
    },
    {
      name: 'burpSuccess',
      label: '拍嗝成功',
      type: 'checkbox',
    },
    {
      name: 'milkAmount',
      label: '奶量(ml)',
      type: 'number',
      min: 0,
    },
    {
      name: 'milkSource',
      label: '奶源',
      type: 'select',
      options: [
        { label: '母乳', value: 'BREAST_MILK' },
        { label: '奶粉', value: 'FORMULA' },
      ],
    },
    {
      name: 'breastFirmness',
      label: '乳房硬度',
      type: 'select',
      options: [
        { label: '软', value: 'SOFT' },
        { label: '弹', value: 'ELASTIC' },
        { label: '硬', value: 'HARD' },
      ],
    },
    {
      name: 'supplementType',
      label: '补剂类型',
      type: 'select',
      options: [
        { label: 'AD', value: 'AD' },
        { label: 'D3', value: 'D3' },
      ],
    },
    {
      name: 'spitUpType',
      label: '吐奶类型',
      type: 'select',
      options: [
        { label: '普通吐奶', value: 'NORMAL' },
        { label: '喷射性吐奶', value: 'PROJECTILE' },
      ],
    },
    {
      name: 'count',
      label: '次数',
      type: 'number',
      min: 0,
      admin: {
        step: 1,
      },
    },
    {
      name: 'notes',
      label: '备注',
      type: 'textarea',
    },
  ],
}
