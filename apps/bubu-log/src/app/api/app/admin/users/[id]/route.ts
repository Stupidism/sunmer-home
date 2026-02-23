import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { getPayloadClient } from '@/lib/payload/client'
import type { AppUserDoc, BabyDoc, BabyUserDoc } from '@/lib/payload/models'

const USER_ROLE_VALUES = ['ADMIN', 'DAD', 'MOM', 'NANNY', 'GRANDPARENT', 'OTHER'] as const

const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLE_VALUES).optional(),
    password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位').optional(),
  })
  .refine((value) => value.role !== undefined || value.password !== undefined, {
    message: '至少提供一个更新字段',
  })

interface RouteParams {
  params: Promise<{ id: string }>
}

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

async function mapUserWithBabies(user: AppUserDoc): Promise<AdminManagedUser> {
  const payload = await getPayloadClient()

  const bindingsResult = await payload.find({
    collection: 'baby-users',
    where: {
      user: {
        equals: user.id,
      },
    },
    sort: 'createdAt',
    limit: 100,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const bindings = (bindingsResult.docs as BabyUserDoc[]).map((item) => {
    const baby = item.baby
    const babyId = getRelationId(baby)
    const babyName =
      typeof baby === 'object' && baby && 'name' in baby ? String((baby as BabyDoc).name || '') : ''

    return {
      babyId,
      babyName,
      isDefault: Boolean(item.isDefault),
    }
  })

  const validBindings = bindings.filter((item): item is { babyId: string; babyName: string; isDefault: boolean } =>
    Boolean(item.babyId)
  )

  const unresolvedBabyIds = validBindings
    .filter((item) => !item.babyName)
    .map((item) => item.babyId)

  if (unresolvedBabyIds.length > 0) {
    const babiesResult = await payload.find({
      collection: 'babies',
      where: {
        id: {
          in: unresolvedBabyIds,
        },
      },
      limit: unresolvedBabyIds.length,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const babyNameMap = new Map<string, string>()
    for (const baby of babiesResult.docs as BabyDoc[]) {
      babyNameMap.set(baby.id, baby.name)
    }

    for (const binding of validBindings) {
      if (!binding.babyName) {
        binding.babyName = babyNameMap.get(binding.babyId) || ''
      }
    }
  }

  const defaultBaby = validBindings.find((item) => item.isDefault)

  return {
    id: user.id,
    username: user.username ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    role: (user.role as (typeof USER_ROLE_VALUES)[number]) || 'OTHER',
    createdAt: user.createdAt ?? null,
    babyIds: validBindings.map((item) => item.babyId),
    babyNames: validBindings.map((item) => item.babyName),
    defaultBabyId: defaultBaby?.babyId ?? null,
    defaultBabyName: defaultBaby?.babyName ?? null,
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdminUser()
    const { id } = await params

    const body = await request.json()
    const parsed = updateUserSchema.parse(body)

    if (admin.id === id && parsed.role && parsed.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '不能移除当前登录管理员自己的管理员权限' },
        { status: 400 }
      )
    }

    const payload = await getPayloadClient()

    let existingUser: AppUserDoc
    try {
      existingUser = (await payload.findByID({
        collection: 'app-users',
        id,
        depth: 0,
        overrideAccess: true,
      })) as AppUserDoc
    } catch {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}

    if (parsed.role) {
      data.role = parsed.role
    }

    if (parsed.password) {
      data.password = await bcrypt.hash(parsed.password, 12)
    }

    const updated = (await payload.update({
      collection: 'app-users',
      id: existingUser.id,
      data,
      depth: 0,
      overrideAccess: true,
    })) as AppUserDoc

    const response = await mapUserWithBabies(updated)
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? '参数错误' }, { status: 400 })
    }

    console.error('Failed to update user in admin:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
