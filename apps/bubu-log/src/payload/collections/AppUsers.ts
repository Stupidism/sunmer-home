import bcrypt from 'bcryptjs'
import { ValidationError, type CollectionConfig } from 'payload'
import { isCMSAdmin } from '../access/isCMSAdmin.ts'
import { ensureTextId, touchTimestamps } from '../utils/document.ts'

const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/
const BCRYPT_HASH_REGEX = /^\$2[aby]\$/

export const AppUsers: CollectionConfig = {
  slug: 'app-users',
  dbName: 'User',
  timestamps: false,
  admin: {
    useAsTitle: 'username',
    group: '业务数据',
    defaultColumns: ['username', 'name', 'role', 'email', 'createdAt'],
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
      async ({ data, operation, req }) => {
        if (!data) {
          return data
        }

        const nextData = ensureTextId({ ...data } as Record<string, unknown>)
        touchTimestamps(nextData, operation)

        const username = typeof nextData.username === 'string' ? nextData.username.trim() : ''
        if (username) {
          nextData.username = username
        }

        const email = typeof nextData.email === 'string' ? nextData.email.trim() : ''
        if (email) {
          nextData.email = email.toLowerCase()
        }

        const rawPasswordInput =
          typeof nextData.passwordInput === 'string' ? nextData.passwordInput.trim() : ''
        const rawPassword = typeof nextData.password === 'string' ? nextData.password.trim() : ''
        const passwordToSave = rawPasswordInput || rawPassword

        if (passwordToSave) {
          if (passwordToSave.length < 8 || passwordToSave.length > 72) {
            throw new ValidationError({
              collection: 'app-users',
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
            collection: 'app-users',
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
      name: 'id',
      label: 'ID',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'username',
      label: '用户名',
      type: 'text',
      required: true,
      unique: true,
      validate: (value: string | null | undefined) => {
        if (!value) {
          return '用户名不能为空'
        }
        if (value.length < 3 || value.length > 32) {
          return '用户名长度应在 3 到 32 位之间'
        }
        if (!USERNAME_REGEX.test(value)) {
          return '用户名仅支持字母、数字、点、下划线、横线'
        }
        return true
      },
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
      name: 'name',
      label: '姓名',
      type: 'text',
    },
    {
      name: 'email',
      label: '邮箱',
      type: 'email',
      unique: true,
    },
    {
      name: 'image',
      label: '头像 URL',
      type: 'text',
    },
    {
      name: 'emailVerified',
      label: '邮箱验证时间',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'role',
      label: '角色',
      type: 'select',
      defaultValue: 'OTHER',
      required: true,
      options: [
        { label: '管理员', value: 'ADMIN' },
        { label: '爸爸', value: 'DAD' },
        { label: '妈妈', value: 'MOM' },
        { label: '月嫂', value: 'NANNY' },
        { label: '祖辈', value: 'GRANDPARENT' },
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
