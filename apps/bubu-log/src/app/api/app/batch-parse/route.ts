import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { callDeepseek, type ParsedActivity } from '@/lib/voice-input/process'
import { ActivityType } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'

const POINT_EVENT_TYPES = ['DIAPER', 'SUPPLEMENT', 'SPIT_UP', 'ROLL_OVER', 'PULL_TO_SIT']

interface BatchParseItem {
  originalText: string
  parsed?: ParsedActivity & { startTimeISO: string; endTimeISO: string | null }
  error?: string
}

// Each entry has its own text and timestamp
interface BatchEntry {
  text: string
  localTime: string
}

// POST: Parse multiple lines of voice input text
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const entries = Array.isArray(body.entries) ? body.entries as BatchEntry[] : []
    const fallbackTime = typeof body.localTime === 'string' ? body.localTime : new Date().toISOString()

    if (entries.length === 0) {
      return NextResponse.json({ error: '请提供至少一条记录' }, { status: 400 })
    }

    if (entries.length > 50) {
      return NextResponse.json({ error: '单次最多解析50条记录' }, { status: 400 })
    }

    await requireAuth({ babyId: getRequestedBabyId(request) })

    // Parse all entries in parallel
    const results: BatchParseItem[] = await Promise.all(
      entries.map(async (entry): Promise<BatchParseItem> => {
        const text = (entry.text || '').trim()
        if (!text) {
          return { originalText: '', error: '空行' }
        }

        const localTime = entry.localTime || fallbackTime

        try {
          const result = await callDeepseek(text, localTime)

          if ('error' in result) {
            return { originalText: text, error: result.error }
          }

          if (!Object.values(ActivityType).includes(result.type)) {
            return { originalText: text, error: `无效的活动类型: ${result.type}` }
          }

          const startTime = result.startTime
            ? new Date(result.startTime)
            : new Date()

          const isPointEvent = POINT_EVENT_TYPES.includes(result.type)
          const endTime = isPointEvent
            ? startTime
            : (result.endTime ? new Date(result.endTime) : null)

          return {
            originalText: text,
            parsed: {
              ...result,
              startTimeISO: startTime.toISOString(),
              endTimeISO: endTime ? endTime.toISOString() : null,
            },
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '解析失败'
          return { originalText: text, error: msg }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) return authError

    console.error('Batch parse failed:', error)
    return NextResponse.json(
      { error: '批量解析失败', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}

// PUT: Batch create confirmed activities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const items = Array.isArray(body.items) ? body.items : []

    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const created: Array<{ id: string; type: string; originalText: string }> = []
    const errors: Array<{ originalText: string; error: string }> = []

    for (const item of items) {
      try {
        const activity = await payload.create({
          collection: 'activities',
          data: {
            type: item.type,
            startTime: item.startTime,
            endTime: item.endTime || null,
            babyId: baby.id,
            milkAmount: item.milkAmount || null,
            milkSource: item.milkSource || null,
            hasPoop: item.hasPoop ?? null,
            hasPee: item.hasPee ?? null,
            poopColor: item.poopColor || null,
            peeAmount: item.peeAmount || null,
            spitUpType: item.spitUpType || null,
            count: item.count || null,
            notes: item.notes || null,
          },
          depth: 0,
          overrideAccess: true,
        })

        created.push({
          id: String(activity.id),
          type: item.type,
          originalText: item.originalText || '',
        })

        await createAuditLog(payload, {
          action: 'CREATE',
          resourceId: String(activity.id),
          inputMethod: 'VOICE',
          inputText: item.originalText || '',
          description: `批量导入: "${item.originalText}" - 创建${item.type}`,
          success: true,
          beforeData: null,
          afterData: activity,
          activityId: String(activity.id),
          babyId: baby.id,
          userId: user.id,
        })
      } catch (err) {
        errors.push({
          originalText: item.originalText || '',
          error: err instanceof Error ? err.message : '创建失败',
        })
      }
    }

    return NextResponse.json({ created, errors })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) return authError

    console.error('Batch create failed:', error)
    return NextResponse.json(
      { error: '批量创建失败', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
