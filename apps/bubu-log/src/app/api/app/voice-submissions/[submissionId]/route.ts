import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'
import { ActivityType, PoopColor, PeeAmount, type MilkSource, type SpitUpType } from '@/types/activity'

type PendingVoiceParsed = {
  type: ActivityType
  startTime: string
  endTime: string | null
  milkAmount: number | null
  milkSource: MilkSource | null
  hasPoop: boolean | null
  hasPee: boolean | null
  poopColor: PoopColor | null
  peeAmount: PeeAmount | null
  spitUpType: SpitUpType | null
  count: number | null
  notes: string | null
  confidence: number
  originalText: string | null
}

type AuditLogDoc = {
  id: string
  afterData?: unknown
  babyId?: string | null
  createdAt?: string | null
  inputText?: string | null
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function isValidDateInput(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime())
}

function parsePendingVoiceParsed(value: unknown): PendingVoiceParsed | null {
  const raw = asObject(value)
  if (!raw) {
    return null
  }

  const typeValue = raw.type
  if (typeof typeValue !== 'string' || !Object.values(ActivityType).includes(typeValue as ActivityType)) {
    return null
  }

  const startTime = asString(raw.startTime)
  if (!startTime || !isValidDateInput(startTime)) {
    return null
  }

  const endTimeRaw = raw.endTime
  const endTime =
    endTimeRaw === null
      ? null
      : typeof endTimeRaw === 'string' && isValidDateInput(endTimeRaw)
        ? endTimeRaw
        : null

  const milkSourceRaw = raw.milkSource
  const milkSource =
    typeof milkSourceRaw === 'string' &&
    (milkSourceRaw === 'BREAST_MILK' || milkSourceRaw === 'FORMULA')
      ? (milkSourceRaw as MilkSource)
      : null

  const poopColorRaw = raw.poopColor
  const poopColor =
    typeof poopColorRaw === 'string' && Object.values(PoopColor).includes(poopColorRaw as PoopColor)
      ? (poopColorRaw as PoopColor)
      : null

  const peeAmountRaw = raw.peeAmount
  const peeAmount =
    typeof peeAmountRaw === 'string' && Object.values(PeeAmount).includes(peeAmountRaw as PeeAmount)
      ? (peeAmountRaw as PeeAmount)
      : null

  const spitUpTypeRaw = raw.spitUpType
  const spitUpType =
    typeof spitUpTypeRaw === 'string' &&
    (spitUpTypeRaw === 'NORMAL' || spitUpTypeRaw === 'PROJECTILE')
      ? (spitUpTypeRaw as SpitUpType)
      : null

  const countRaw = asNumber(raw.count)
  const count = typeof countRaw === 'number' && Number.isInteger(countRaw) ? countRaw : null

  return {
    type: typeValue as ActivityType,
    startTime,
    endTime,
    milkAmount: asNumber(raw.milkAmount),
    milkSource,
    hasPoop: asBoolean(raw.hasPoop),
    hasPee: asBoolean(raw.hasPee),
    poopColor,
    peeAmount,
    spitUpType,
    count,
    notes: asString(raw.notes),
    confidence: asNumber(raw.confidence) ?? 0,
    originalText: asString(raw.originalText),
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<unknown> }) {
  try {
    const { baby } = await requireAuth()
    const routeParams = (await params) as { submissionId?: string } | null
    const submissionId = typeof routeParams?.submissionId === 'string' ? routeParams.submissionId : null

    if (!submissionId) {
      return NextResponse.json(
        {
          error: 'submissionId 无效',
          code: 'INVALID_SUBMISSION_ID',
        },
        { status: 400 },
      )
    }

    const payload = await getPayloadClient()
    const result = await payload.find({
      collection: 'audit-logs',
      where: {
        and: [
          {
            id: {
              equals: submissionId,
            },
          },
          {
            babyId: {
              equals: baby.id,
            },
          },
          {
            inputMethod: {
              equals: 'VOICE',
            },
          },
          {
            success: {
              equals: false,
            },
          },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const doc = (result.docs[0] as AuditLogDoc | undefined) ?? null
    if (!doc) {
      return NextResponse.json(
        {
          error: '待确认语音记录不存在或无权限访问',
          code: 'SUBMISSION_NOT_FOUND',
        },
        { status: 404 },
      )
    }

    const parsed = parsePendingVoiceParsed(doc.afterData)
    if (!parsed) {
      return NextResponse.json(
        {
          error: '待确认语音记录内容无效',
          code: 'SUBMISSION_INVALID',
        },
        { status: 422 },
      )
    }

    return NextResponse.json({
      success: true,
      submissionId: doc.id,
      babyId: doc.babyId ?? null,
      inputText: doc.inputText ?? null,
      createdAt: doc.createdAt ?? null,
      parsed,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.error('Failed to fetch voice submission:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch voice submission',
        code: 'SUBMISSION_FETCH_FAILED',
      },
      { status: 500 },
    )
  }
}
