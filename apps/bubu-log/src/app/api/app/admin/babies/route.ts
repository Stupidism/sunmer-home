import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminUser } from '@/lib/auth/require-admin'
import { getPayloadClient } from '@/lib/payload/client'
import type { BabyDoc, BabyUserDoc } from '@/lib/payload/models'

const createBabySchema = z.object({
  name: z.string().trim().min(1, '宝宝名称不能为空').max(40, '宝宝名称不能超过40个字符'),
  birthDate: z.string().trim().optional().nullable(),
})

function toBirthDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const input = value.trim()
  if (!input) {
    return null
  }

  const parsedDate = input.includes('T') ? new Date(input) : new Date(`${input}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error('出生日期格式不正确')
  }

  return parsedDate
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

export async function GET() {
  try {
    await requireAdminUser()
    const payload = await getPayloadClient()

    const babiesResult = await payload.find({
      collection: 'babies',
      sort: '-createdAt',
      limit: 500,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const babies = babiesResult.docs as BabyDoc[]

    if (babies.length === 0) {
      return NextResponse.json([])
    }

    const babyIds = babies.map((baby) => baby.id)

    const bindingsResult = await payload.find({
      collection: 'baby-users',
      where: {
        baby: {
          in: babyIds,
        },
      },
      limit: 5000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const counts = new Map<string, number>()

    for (const item of bindingsResult.docs as BabyUserDoc[]) {
      const babyId = getRelationId(item.baby)
      if (!babyId) {
        continue
      }

      counts.set(babyId, (counts.get(babyId) || 0) + 1)
    }

    return NextResponse.json(
      babies.map((baby) => ({
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate || null,
        createdAt: baby.createdAt || null,
        userCount: counts.get(baby.id) || 0,
      }))
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.error('Failed to fetch babies in admin:', error)
    return NextResponse.json({ error: 'Failed to fetch babies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminUser()

    const payload = await getPayloadClient()

    const body = await request.json()
    const parsed = createBabySchema.parse(body)
    const birthDate = toBirthDate(parsed.birthDate)

    const baby = (await payload.create({
      collection: 'babies',
      data: {
        name: parsed.name,
        birthDate: birthDate ? birthDate.toISOString() : null,
      },
      depth: 0,
      overrideAccess: true,
    } as never)) as BabyDoc

    return NextResponse.json(
      {
        id: baby.id,
        name: baby.name,
        birthDate: baby.birthDate || null,
        createdAt: baby.createdAt || null,
        userCount: 0,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? '参数错误' }, { status: 400 })
    }

    if (error instanceof Error && error.message === '出生日期格式不正确') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Failed to create baby in admin:', error)
    return NextResponse.json({ error: 'Failed to create baby' }, { status: 500 })
  }
}
