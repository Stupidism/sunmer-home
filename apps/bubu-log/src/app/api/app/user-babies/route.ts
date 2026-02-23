import { NextRequest, NextResponse } from 'next/server'
import {
  authFailureResponse,
  getRequestedBabyId,
  requireUser,
} from '@/lib/auth/get-current-baby'
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

type BabyListItem = {
  id: string
  name: string
  fullName: string | null
  avatarUrl: string | null
  birthDate: string | null
  gender: 'BOY' | 'GIRL' | 'OTHER' | null
  isDefault: boolean
}

type CreateBabyRequestBody = {
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

  if (typeof value === 'string') {
    return value
  }

  return value.id || null
}

function normalizeBabyName(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (normalized.length > 30) {
    return null
  }

  return normalized
}

function normalizeBabyFullName(value: string | null | undefined): string | null | 'INVALID' {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  if (normalized.length > 60) {
    return 'INVALID'
  }

  return normalized
}

function normalizeGender(value: string | null | undefined): 'BOY' | 'GIRL' | 'OTHER' {
  if (value === 'BOY' || value === 'GIRL' || value === 'OTHER') {
    return value
  }

  return 'OTHER'
}

function parseBirthDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
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

async function listUserBabies(userId: string): Promise<BabyListItem[]> {
  const payload = await getPayloadClient()
  const bindings = await listUserBindings(userId)

  const ids = bindings
    .map((item) => relationId(item.baby))
    .filter((item): item is string => Boolean(item))

  if (ids.length === 0) {
    return []
  }

  const babyResult = await payload.find({
    collection: 'babies',
    where: {
      id: {
        in: ids,
      },
    },
    limit: ids.length,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  const babyMap = new Map(
    (babyResult.docs as BabyDoc[]).map((item) => [
      String(item.id),
      {
        id: String(item.id),
        name: String(item.name || ''),
        fullName: item.fullName ? String(item.fullName) : null,
        avatarUrl: item.avatarUrl ?? null,
        birthDate: item.birthDate ?? null,
        gender: item.gender ?? null,
      },
    ])
  )

  const seen = new Set<string>()
  const babies: BabyListItem[] = []

  for (const binding of bindings) {
    const babyId = relationId(binding.baby)
    if (!babyId || seen.has(babyId)) {
      continue
    }

    const baby = babyMap.get(babyId)
    if (!baby) {
      continue
    }

    seen.add(babyId)
    babies.push({
      ...baby,
      isDefault: Boolean(binding.isDefault),
    })
  }

  return babies
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

function findDefaultBabyId(babies: BabyListItem[]): string | null {
  return babies.find((item) => item.isDefault)?.id ?? babies[0]?.id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const babies = await listUserBabies(user.id)
    const defaultBabyId = findDefaultBabyId(babies)
    const requestedBabyId = getRequestedBabyId(request)
    const currentBabyId =
      requestedBabyId && babies.some((item) => item.id === requestedBabyId)
        ? requestedBabyId
        : defaultBabyId

    return NextResponse.json({
      data: babies,
      defaultBabyId,
      currentBabyId,
    })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch babies:', error)
    return NextResponse.json({ error: 'Failed to fetch babies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const payload = await getPayloadClient()

    const body = (await request.json()) as CreateBabyRequestBody
    const name = normalizeBabyName(body.name)
    if (!name) {
      return NextResponse.json(
        { error: '宝宝名称不能为空，且长度不能超过 30 个字符' },
        { status: 400 }
      )
    }

    const fullName = normalizeBabyFullName(body.fullName)
    if (fullName === 'INVALID') {
      return NextResponse.json(
        { error: '宝宝大名不能超过 60 个字符' },
        { status: 400 }
      )
    }

    const birthDate = parseBirthDate(body.birthDate)
    if (body.birthDate && !birthDate) {
      return NextResponse.json({ error: '出生日期格式无效' }, { status: 400 })
    }

    const existingBabies = await listUserBabies(user.id)
    const duplicated = existingBabies.some(
      (item) => item.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (duplicated) {
      return NextResponse.json({ error: '已存在同名宝宝' }, { status: 409 })
    }

    const createdBaby = (await payload.create({
      collection: 'babies',
      data: {
        name,
        fullName,
        birthDate,
        gender: normalizeGender(body.gender),
      },
      depth: 0,
      overrideAccess: true,
    })) as BabyDoc

    await payload.create({
      collection: 'baby-users',
      data: {
        baby: String(createdBaby.id),
        user: user.id,
        isDefault: false,
      },
      depth: 0,
      overrideAccess: true,
    })

    const shouldSetDefault = Boolean(body.isDefault) || existingBabies.length === 0
    if (shouldSetDefault) {
      await setDefaultBabyForUser(user.id, String(createdBaby.id))
    }

    const babies = await listUserBabies(user.id)
    const current = babies.find((item) => item.id === String(createdBaby.id)) || null

    return NextResponse.json(
      {
        data: current,
        babies,
        defaultBabyId: findDefaultBabyId(babies),
      },
      { status: 201 }
    )
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to create baby:', error)
    return NextResponse.json({ error: 'Failed to create baby' }, { status: 500 })
  }
}
