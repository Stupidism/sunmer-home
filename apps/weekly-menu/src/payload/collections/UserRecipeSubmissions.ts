import type { CollectionConfig } from 'payload'
import { getPayloadPool } from '@/lib/payload-db'
import { ensureUserRecipeSubmissionsTable } from '@/lib/user-recipes-db'

type SubmissionStatus = 'pending' | 'approved' | 'rejected'

const statusOptions = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已驳回', value: 'rejected' },
]

const categoryOptions = [
  { label: '大荤', value: 'big-meat' },
  { label: '小荤', value: 'small-meat' },
  { label: '素菜', value: 'vegetable' },
]

export const UserRecipeSubmissions: CollectionConfig = {
  slug: 'user-recipe-submissions',
  dbName: 'user_recipe_submissions',
  timestamps: false,
  labels: {
    singular: '用户上传菜谱',
    plural: '上传审核',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'status', 'user_id', 'created_at'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeOperation: [
      async () => {
        await ensureUserRecipeSubmissionsTable()
      },
    ],
    beforeChange: [
      async ({ data, originalDoc, operation }) => {
        if (!data) {
          return data
        }

        const nextData = { ...data } as Record<string, unknown>

        if (!nextData.created_at && operation === 'create') {
          nextData.created_at = new Date().toISOString()
        }
        nextData.updated_at = new Date().toISOString()

        const nextStatus = (nextData.status as SubmissionStatus | undefined) ??
          (originalDoc?.status as SubmissionStatus | undefined) ??
          'pending'
        const alreadyPublished =
          (nextData.published_to_public as boolean | undefined) ??
          (originalDoc?.published_to_public as boolean | undefined) ??
          false

        if (nextStatus !== 'approved' || alreadyPublished) {
          return nextData
        }

        const name = String(nextData.name ?? originalDoc?.name ?? '').trim()
        const category = String(nextData.category ?? originalDoc?.category ?? '').trim()
        const description = String(nextData.description ?? originalDoc?.description ?? '').trim()

        if (!name || !category) {
          return nextData
        }

        const pool = getPayloadPool()
        const existing = await pool.query<{ id: string }>(
          'SELECT id::text FROM planner_recipes WHERE name = $1 AND category = $2 LIMIT 1',
          [name, category]
        )

        if ((existing.rowCount ?? 0) === 0) {
          await pool.query(
            'INSERT INTO planner_recipes (name, category, description, updated_at, created_at) VALUES ($1, $2, $3, NOW(), NOW())',
            [name, category, description || null]
          )
        }

        nextData.published_to_public = true
        return nextData
      },
    ],
  },
  fields: [
    {
      name: 'user_id',
      label: '上传用户ID',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'name',
      label: '菜谱名称',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'category',
      label: '分类',
      type: 'select',
      required: true,
      options: categoryOptions,
      index: true,
    },
    {
      name: 'description',
      label: '说明',
      type: 'textarea',
      required: false,
    },
    {
      name: 'status',
      label: '审核状态',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: statusOptions,
      index: true,
    },
    {
      name: 'review_note',
      label: '审核备注',
      type: 'textarea',
      required: false,
    },
    {
      name: 'published_to_public',
      label: '已同步公共菜谱库',
      type: 'checkbox',
      defaultValue: false,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'created_at',
      label: '创建时间',
      type: 'date',
      required: false,
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
    {
      name: 'updated_at',
      label: '更新时间',
      type: 'date',
      required: false,
      admin: {
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
          displayFormat: 'yyyy-MM-dd HH:mm',
        },
      },
    },
  ],
}
