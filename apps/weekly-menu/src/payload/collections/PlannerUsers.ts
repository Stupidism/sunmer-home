import bcrypt from 'bcryptjs'
import { ValidationError, type CollectionConfig } from 'payload'

const BCRYPT_HASH_REGEX = /^\$2[aby]\$/

const userRoleOptions = [
  {
    label: '管理员',
    value: 'ADMIN',
  },
  {
    label: '用户',
    value: 'USER',
  },
]

export const PlannerUsers: CollectionConfig = {
  slug: 'planner-users',
  labels: {
    singular: '用户',
    plural: '用户列表',
  },
  admin: {
    useAsTitle: 'username',
    defaultColumns: ['username', 'name', 'role', 'updatedAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (!data) {
          return data
        }

        const nextData = { ...data } as Record<string, unknown>

        const rawPasswordInput =
          typeof nextData.passwordInput === 'string' ? nextData.passwordInput.trim() : ''
        const rawPassword = typeof nextData.password === 'string' ? nextData.password.trim() : ''
        const passwordToSave = rawPasswordInput || rawPassword

        if (passwordToSave) {
          if (passwordToSave.length < 8 || passwordToSave.length > 72) {
            throw new ValidationError({
              collection: 'planner-users',
              errors: [{ path: 'passwordInput', message: '密码长度应在 8 到 72 位之间' }],
              req,
            })
          }

          if (BCRYPT_HASH_REGEX.test(passwordToSave)) {
            nextData.password = passwordToSave
          } else {
            nextData.password = await bcrypt.hash(passwordToSave, 12)
          }
        } else if (operation === 'create') {
          throw new ValidationError({
            collection: 'planner-users',
            errors: [{ path: 'passwordInput', message: '创建用户时必须设置密码' }],
            req,
          })
        } else {
          delete nextData.password
        }

        delete nextData.passwordInput

        return nextData
      },
    ],
  },
  fields: [
    {
      name: 'userId',
      label: 'User ID',
      type: 'text',
      required: false,
      unique: true,
      index: true,
    },
    {
      name: 'username',
      label: '用户名',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'passwordInput',
      label: '密码',
      type: 'text',
      virtual: true,
      admin: {
        description: '创建用户或重置密码时填写，留空则不修改。',
      },
    },
    {
      name: 'password',
      type: 'text',
      access: {
        read: () => false,
      },
      admin: {
        hidden: true,
      },
    },
    {
      name: 'role',
      label: '角色',
      type: 'select',
      required: true,
      defaultValue: 'USER',
      options: userRoleOptions,
      index: true,
    },
    {
      name: 'name',
      label: '姓名',
      type: 'text',
      required: true,
    },
    {
      name: 'profile',
      label: 'User Info',
      type: 'group',
      fields: [
        {
          name: 'email',
          type: 'email',
          required: false,
        },
        {
          name: 'phone',
          type: 'text',
          required: false,
        },
        {
          name: 'allergies',
          type: 'array',
          required: false,
          fields: [
            {
              name: 'item',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
          required: false,
        },
      ],
    },
  ],
}
