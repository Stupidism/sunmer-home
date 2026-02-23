import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, requireUser } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'

type BabyDoc = {
  id: string
  name?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  birthDate?: string | null
  gender?: 'BOY' | 'GIRL' | 'OTHER' | null
}

type BabyUserDoc = {
  id: string
  baby: string | { id: string }
  isDefault?: boolean | null
}

type UpdateBabyRequestBody = {
  name?: string
  fullName?: string | null
  birthDate?: string | null
  gender?: 'BOY' | 'GIRL' | 'OTHER' | null
  isDefault?: boolean
}

function relationId(value: string | { id: string } | null | undefined): string | null {
  if (!value) {
    return null
  }
  return typeof value === 'string' ? value : value.id || null
}

function normalizeName(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 30) {
    return null
  }

  return trimmed
}

function normalizeGender(value: string | null | undefined): 'BOY' | 'GIRL' | 'OTHER' {
  if (value === 'BOY' || value === 'GIRL' || value === 'OTHER') {
    return value
  }

  return 'OTHER'
}

function parseBirthDate(value: string | null | undefined): string | null {
  if (value === undefined) {
    return null
  }
  if (value === null || value === '') {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

async function listUserBindings(userId: string): Promise<BabyUserDoc[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'baby-users',
    where: {
      user: {
        equals: userId,
      },
    },
    limit: 200,
    pagination: false,
    depth: 0,
    sort: '-isDefault,createdAt',
    overrideAccess: true,
  })

  return result.docs as BabyUserDoc[]
}

async function setDefaultBabyForUser(userId: string, targetBabyId: string) {
  const payload = await getPayloadClient()
  const bindings = await listUserBindings(userId)

  for (const binding of bindings) {
    const bindingBabyId = relationId(binding.baby)
    if (!bindingBabyId) {
      continue
    }

    const nextDefault = bindingBabyId === targetBabyId
    if (Boolean(binding.isDefault) === nextDefault) {
      continue
    }

    await payload.update({
      collection: 'baby-users',
      id: String(binding.id),
      data: {
        isDefault: nextDefault,
      },
      depth: 0,
      overrideAccess: true,
    })
  }
}

async function listUserBabyIds(userId: string): Promise<string[]> {
  const bindings = await listUserBindings(userId)
  return bindings
    .map((item) => relationId(item.baby))
    .filter((item): item is string => Boolean(item))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const payload = await getPayloadClient()
    const { id } = await params
    const targetBabyId = String(id)

    const userBabyIds = await listUserBabyIds(user.id)
    if (!userBabyIds.includes(targetBabyId)) {
      return NextResponse.json({ error: '没有权限操作该宝宝' }, { status: 403 })
    }

    const body = (await request.json()) as UpdateBabyRequestBody
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const normalizedName = normalizeName(body.name)
      if (!normalizedName) {
        return NextResponse.json(
          { error: '宝宝名称不能为空，且长度不能超过 30 个字符' },
          { status: 400 }
        )
      }

      const otherBabiesResult = await payload.find({
        collection: 'babies',
        where: {
          id: {
            in: userBabyIds.filter((item) => item !== targetBabyId),
          },
        },
        limit: 200,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })

      const duplicated = (otherBabiesResult.docs as BabyDoc[]).some(
        (item) => String(item.name || '').trim().toLowerCase() === normalizedName.toLowerCase()
      )

      if (duplicated) {
        return NextResponse.json({ error: '已存在同名宝宝' }, { status: 409 })
      }

      updateData.name = normalizedName
    }

    if (body.fullName !== undefined) {
      if (body.fullName === null || body.fullName === '') {
        updateData.fullName = null
      } else {
        const normalizedFullName = body.fullName.trim()
        if (normalizedFullName.length > 60) {
          return NextResponse.json({ error: '宝宝大名不能超过 60 个字符' }, { status: 400 })
        }
        updateData.fullName = normalizedFullName || null
      }
    }

    if (body.gender !== undefined) {
      updateData.gender = normalizeGender(body.gender)
    }

    if (body.birthDate !== undefined) {
      if (body.birthDate === null || body.birthDate === '') {
        updateData.birthDate = null
      } else {
        const parsedBirthDate = parseBirthDate(body.birthDate)
        if (!parsedBirthDate) {
          return NextResponse.json({ error: '出生日期格式无效' }, { status: 400 })
        }
        updateData.birthDate = parsedBirthDate
      }
    }

    const shouldSetDefault = body.isDefault === true
    if (Object.keys(updateData).length === 0 && !shouldSetDefault) {
      return NextResponse.json({ error: '未提供可更新字段' }, { status: 400 })
    }

    let updatedBaby: BabyDoc | null = null
    if (Object.keys(updateData).length > 0) {
      updatedBaby = (await payload.update({
        collection: 'babies',
        id: targetBabyId,
        data: updateData,
        depth: 0,
        overrideAccess: true,
      })) as BabyDoc
    } else {
      updatedBaby = (await payload.findByID({
        collection: 'babies',
        id: targetBabyId,
        depth: 0,
        overrideAccess: true,
      })) as BabyDoc
    }

    if (shouldSetDefault) {
      await setDefaultBabyForUser(user.id, targetBabyId)
    }

    const latestBindings = await listUserBindings(user.id)
    const currentBinding = latestBindings.find((item) => relationId(item.baby) === targetBabyId)

    return NextResponse.json({
      data: {
        id: String(updatedBaby.id),
        name: String(updatedBaby.name || ''),
        fullName: updatedBaby.fullName ? String(updatedBaby.fullName) : null,
        avatarUrl: updatedBaby.avatarUrl ?? null,
        birthDate: updatedBaby.birthDate ?? null,
        gender: updatedBaby.gender ?? null,
        isDefault: Boolean(currentBinding?.isDefault),
      },
    })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to update baby:', error)
    return NextResponse.json({ error: 'Failed to update baby' }, { status: 500 })
  }
}
