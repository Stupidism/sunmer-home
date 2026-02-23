import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { getPayloadClient } from '@/lib/payload/client'
import type { AppUserDoc, BabyDoc, BabyUserDoc } from '@/lib/payload/models'

const USER_ROLE_VALUES = ['ADMIN', 'DAD', 'MOM', 'NANNY', 'GRANDPARENT', 'OTHER'] as const
const BABY_GENDER_VALUES = ['BOY', 'GIRL', 'OTHER'] as const

function parseBirthDate(value: string): Date {
  const input = value.trim()
  const parsedDate = input.includes('T') ? new Date(input) : new Date(`${input}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('宝宝出生日期格式不正确')
  }

  return parsedDate
}

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 位')
    .max(32, '用户名最多 32 位')
    .regex(/^[a-zA-Z0-9._-]+$/, '用户名仅支持字母、数字、点、下划线、横线'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
  name: z.string().trim().max(40, '姓名最多 40 位').optional().nullable(),
  email: z.string().trim().email('邮箱格式不正确').optional().nullable(),
  role: z.enum(USER_ROLE_VALUES).optional(),
  baby: z.object({
    name: z.string().trim().min(1, '宝宝姓名不能为空').max(40, '宝宝姓名最多 40 位'),
    avatarUrl: z.string().trim().url('宝宝照片地址格式不正确').optional().nullable(),
    birthDate: z.string().trim().min(1, '宝宝出生日期不能为空'),
    gender: z.enum(BABY_GENDER_VALUES),
  }),
})

type AdminManagedUser = {
  id: string
  username: string | null
  name: string | null
  email: string | null
  role: (typeof USER_ROLE_VALUES)[number]
  createdAt: string | null
  babyIds: string[]
  babyNames: string[]
  defaultBabyId: string | null
  defaultBabyName: string | null
}

type BabyBinding = {
  userId: string
  babyId: string
  babyName: string
  isDefault: boolean
  createdAt: string | null
}

function getRelationId(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value && 'id' in value) {
    const relationId = (value as { id?: unknown }).id
    return typeof relationId === 'string' ? relationId : null
  }

  return null
}

function toManagedUser(user: AppUserDoc, bindings: BabyBinding[]): AdminManagedUser {
  const sortedBindings = [...bindings].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER
    return aTime - bTime
  })

  const defaultBaby = sortedBindings.find((item) => item.isDefault)

  return {
    id: user.id,
    username: user.username ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    role: (user.role as (typeof USER_ROLE_VALUES)[number]) || 'OTHER',
    createdAt: user.createdAt ?? null,
    babyIds: sortedBindings.map((item) => item.babyId),
    babyNames: sortedBindings.map((item) => item.babyName),
    defaultBabyId: defaultBaby?.babyId ?? null,
    defaultBabyName: defaultBaby?.babyName ?? null,
  }
}

async function listUsersForAdmin(): Promise<AdminManagedUser[]> {
  const payload = await getPayloadClient()

  const usersResult = await payload.find({
    collection: 'app-users',
    sort: '-createdAt',
    limit: 500,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  const users = usersResult.docs as AppUserDoc[]
  if (users.length === 0) {
    return []
  }

  const userIds = users.map((user) => user.id)

  const bindingsResult = await payload.find({
    collection: 'baby-users',
    where: {
      user: {
        in: userIds,
      },
    },
    limit: 2000,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const bindingMap = new Map<string, BabyBinding[]>()
  const unresolvedBabyIds = new Set<string>()

  for (const item of bindingsResult.docs as BabyUserDoc[]) {
    const bindingUserId = getRelationId(item.user)
    if (!bindingUserId) {
      continue
    }

    const babyRelation = item.baby
    const babyId = getRelationId(babyRelation)
    const babyName =
      typeof babyRelation === 'object' && babyRelation && 'name' in babyRelation
        ? String((babyRelation as BabyDoc).name || '')
        : ''

    if (!babyId) {
      continue
    }

    if (!bindingMap.has(bindingUserId)) {
      bindingMap.set(bindingUserId, [])
    }

    bindingMap.get(bindingUserId)?.push({
      userId: bindingUserId,
      babyId,
      babyName,
      isDefault: Boolean(item.isDefault),
      createdAt: item.createdAt ?? null,
    })

    if (!babyName) {
      unresolvedBabyIds.add(babyId)
    }
  }

  if (unresolvedBabyIds.size > 0) {
    const babiesResult = await payload.find({
      collection: 'babies',
      where: {
        id: {
          in: Array.from(unresolvedBabyIds),
        },
      },
      limit: unresolvedBabyIds.size,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const babyNameMap = new Map<string, string>()
    for (const baby of babiesResult.docs as BabyDoc[]) {
      babyNameMap.set(baby.id, baby.name)
    }

    for (const bindings of bindingMap.values()) {
      for (const binding of bindings) {
        if (!binding.babyName) {
          binding.babyName = babyNameMap.get(binding.babyId) || ''
        }
      }
    }
  }

  return users.map((user) => toManagedUser(user, bindingMap.get(user.id) || []))
}

export async function GET() {
  try {
    await requireAdminUser()

    const users = await listUsersForAdmin()
    return NextResponse.json(users)
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Failed to fetch users in admin:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser()

    const payload = await getPayloadClient()

    const body = await request.json()
    const parsed = createUserSchema.parse(body)

    const trimmedName = parsed.name?.trim() || null
    const trimmedEmail = parsed.email?.trim().toLowerCase() || null
    const trimmedBabyAvatarUrl = parsed.baby.avatarUrl?.trim() || null
    const babyBirthDate = parseBirthDate(parsed.baby.birthDate)

    const hashedPassword = await bcrypt.hash(parsed.password, 12)

    let createdBabyId: string | null = null
    let createdUserId: string | null = null

    try {
      const baby = await payload.create({
        collection: 'babies',
        data: {
          name: parsed.baby.name,
          avatarUrl: trimmedBabyAvatarUrl,
          birthDate: babyBirthDate.toISOString(),
          gender: parsed.baby.gender,
        },
        depth: 0,
        overrideAccess: true,
      })

      createdBabyId = String(baby.id)

      const user = await payload.create({
        collection: 'app-users',
        data: {
          username: parsed.username,
          password: hashedPassword,
          name: trimmedName,
          email: trimmedEmail,
          role: parsed.role ?? 'OTHER',
        },
        depth: 0,
        overrideAccess: true,
      })

      createdUserId = String(user.id)

      await payload.create({
        collection: 'baby-users',
        data: {
          user: createdUserId,
          baby: createdBabyId,
          isDefault: true,
        },
        depth: 0,
        overrideAccess: true,
      })
    } catch (error) {
      if (createdUserId) {
        await payload.delete({
          collection: 'app-users',
          id: createdUserId,
          depth: 0,
          overrideAccess: true,
        }).catch(() => undefined)
      }

      if (createdBabyId) {
        await payload.delete({
          collection: 'babies',
          id: createdBabyId,
          depth: 0,
          overrideAccess: true,
        }).catch(() => undefined)
      }

      throw error
    }

    const users = await listUsersForAdmin()
    const createdUser = users.find((item) => item.id === createdUserId)

    if (!createdUser) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
    }

    return NextResponse.json(createdUser, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? '参数错误' }, { status: 400 })
    }

    if (error instanceof Error && error.message === '宝宝出生日期格式不正确') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('unique')) {
      return NextResponse.json({ error: '用户名或邮箱已被占用' }, { status: 409 })
    }

    console.error('Failed to create user in admin:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
