import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { callDeepseek, type ParsedActivity, type PairHint } from '@/lib/voice-input/process'
import { ActivityType } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'

const POINT_EVENT_TYPES = ['DIAPER', 'SUPPLEMENT', 'SPIT_UP', 'ROLL_OVER', 'PULL_TO_SIT']

type BatchAction = 'create' | 'update' | 'skip'

interface BatchParseItem {
  originalText: string
  parsed?: ParsedActivity & { startTimeISO: string; endTimeISO: string | null }
  error?: string
  pairHint?: PairHint
  merged?: boolean
  mergedWith?: number | null
  skipped?: boolean
  action?: BatchAction
  existingActivityId?: string | null
}

// Each entry has its own text and timestamp
interface BatchEntry {
  text: string
  localTime: string
}

/**
 * Phase 2: Pair-merge post-processing.
 * Matches start/end/cancel entries of the same activity type and merges them.
 */
function mergePairs(
  results: BatchParseItem[],
  existingOpenSleep: { id: string; startTime: string } | null,
): BatchParseItem[] {
  // Initialize merge metadata on every item
  for (const item of results) {
    item.pairHint = item.parsed?.pairHint ?? null
    item.merged = false
    item.mergedWith = null
    item.skipped = false
    item.action = item.error ? 'skip' : 'create'
    item.existingActivityId = null
  }

  // Collect indices of unmatched "start" items, keyed by activity type
  const openStarts = new Map<string, number[]>()

  for (let i = 0; i < results.length; i++) {
    const item = results[i]
    if (!item.parsed || item.error) continue

    const hint = item.pairHint
    const type = item.parsed.type

    if (hint === 'start') {
      // Push onto the open-start stack for this type
      if (!openStarts.has(type)) openStarts.set(type, [])
      openStarts.get(type)!.push(i)
    } else if (hint === 'cancel') {
      // Cancel the most recent unmatched start of the same type
      const stack = openStarts.get(type)
      if (stack && stack.length > 0) {
        const startIdx = stack.pop()!
        // Mark both as skipped
        results[startIdx].skipped = true
        results[startIdx].action = 'skip'
        item.skipped = true
        item.action = 'skip'
      } else {
        // No matching start – skip the cancel entry alone
        item.skipped = true
        item.action = 'skip'
      }
    } else if (hint === 'end') {
      // Try to match with the most recent unmatched start of same type
      const stack = openStarts.get(type)
      if (stack && stack.length > 0) {
        const startIdx = stack.pop()!
        const startItem = results[startIdx]

        // Merge: use startItem's startTime, endItem's endTime & attributes
        startItem.parsed = {
          ...startItem.parsed!,
          endTimeISO: item.parsed.endTimeISO ?? item.parsed.startTimeISO,
          endTime: item.parsed.endTime ?? item.parsed.startTime,
          // Overlay non-null fields from the end item
          ...(item.parsed.milkAmount != null ? { milkAmount: item.parsed.milkAmount } : {}),
          ...(item.parsed.milkSource != null ? { milkSource: item.parsed.milkSource } : {}),
          ...(item.parsed.notes != null ? { notes: item.parsed.notes } : {}),
        }
        startItem.action = 'create'
        startItem.merged = false // the start item is the surviving record

        // Mark the end item as merged-into the start
        item.merged = true
        item.mergedWith = startIdx
        item.action = 'skip'
      } else {
        // No matching start in this batch.
        // For SLEEP "end" (= "醒了"), try to match with an existing open sleep record
        if (type === ActivityType.SLEEP && existingOpenSleep) {
          item.action = 'update'
          item.existingActivityId = existingOpenSleep.id
          // The endTime for the update is this item's startTime (the time "醒了" was reported)
          item.parsed = {
            ...item.parsed,
            startTimeISO: existingOpenSleep.startTime,
            endTimeISO: item.parsed.startTimeISO,
            startTime: existingOpenSleep.startTime,
            endTime: item.parsed.startTime,
          }
        }
        // Otherwise, leave as a standalone "create" – the user can review
      }
    }
    // hint === null → standalone, keep defaults (action = 'create')
  }

  return results
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

    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })

    // Phase 1: AI parse all entries in parallel
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

    // Phase 2: Look up existing open SLEEP record (last 12h, no endTime)
    let existingOpenSleep: { id: string; startTime: string } | null = null
    const hasEndSleep = results.some(
      r => r.parsed?.type === ActivityType.SLEEP && r.pairHint !== 'start' && r.parsed?.pairHint === 'end',
    )
    // Also check raw pairHint from parsed before mergePairs sets it
    const hasEndSleepFromParsed = results.some(
      r => r.parsed?.type === ActivityType.SLEEP && r.parsed?.pairHint === 'end',
    )

    if (hasEndSleep || hasEndSleepFromParsed) {
      try {
        const payload = await getPayloadClient()
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

        const openSleepRecords = await payload.find({
          collection: 'activities',
          where: {
            and: [
              { babyId: { equals: baby.id } },
              { type: { equals: ActivityType.SLEEP } },
              { startTime: { greater_than_equal: twelveHoursAgo } },
              { endTime: { exists: false } },
            ],
          },
          sort: '-startTime',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (openSleepRecords.docs.length > 0) {
          const doc = openSleepRecords.docs[0]
          existingOpenSleep = {
            id: String(doc.id),
            startTime: typeof doc.startTime === 'string' ? doc.startTime : new Date(doc.startTime).toISOString(),
          }
        }
      } catch (err) {
        console.warn('Failed to look up open sleep record:', err)
      }
    }

    // Phase 2: Pair-merge post-processing
    const merged = mergePairs(results, existingOpenSleep)

    return NextResponse.json({ results: merged })
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

// PUT: Batch create/update confirmed activities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const items = Array.isArray(body.items) ? body.items : []

    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const created: Array<{ id: string; type: string; originalText: string }> = []
    const updated: Array<{ id: string; type: string; originalText: string }> = []
    const skipped: Array<{ originalText: string; reason: string }> = []
    const errors: Array<{ originalText: string; error: string }> = []

    for (const item of items) {
      if (!item.action) {
        errors.push({
          originalText: item.originalText || '',
          error: 'action 字段为必填项',
        })
        continue
      }
      const action: BatchAction = item.action

      // Skip items explicitly marked as skip
      if (action === 'skip') {
        skipped.push({
          originalText: item.originalText || '',
          reason: item.skipped ? '已取消' : '已合并到其他记录',
        })
        continue
      }

      try {
        if (action === 'update' && item.existingActivityId) {
          // Verify the activity belongs to the current baby before updating
          const existing = await payload.find({
            collection: 'activities',
            where: {
              and: [
                { id: { equals: item.existingActivityId } },
                { babyId: { equals: baby.id } },
              ],
            },
            limit: 1,
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })

          if (existing.docs.length === 0) {
            errors.push({
              originalText: item.originalText || '',
              error: '未找到对应的活动记录',
            })
            continue
          }

          // Update existing record (e.g., add endTime to open sleep)
          const activity = await payload.update({
            collection: 'activities',
            id: item.existingActivityId,
            data: {
              endTime: item.endTime || null,
              ...(item.notes != null ? { notes: item.notes } : {}),
            },
            depth: 0,
            overrideAccess: true,
          })

          updated.push({
            id: String(activity.id),
            type: item.type,
            originalText: item.originalText || '',
          })

          await createAuditLog(payload, {
            action: 'UPDATE',
            resourceId: String(activity.id),
            inputMethod: 'VOICE',
            inputText: item.originalText || '',
            description: `批量导入: "${item.originalText}" - 更新${item.type}(补endTime)`,
            success: true,
            beforeData: null,
            afterData: activity,
            activityId: String(activity.id),
            babyId: baby.id,
            userId: user.id,
          })
        } else {
          // Create new record
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
        }
      } catch (err) {
        errors.push({
          originalText: item.originalText || '',
          error: err instanceof Error ? err.message : '操作失败',
        })
      }
    }

    return NextResponse.json({ created, updated, skipped, errors })
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
