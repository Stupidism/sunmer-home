import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { batchParseWithAI, type BatchEntry, type BatchParsedItem } from '@/lib/batch-parse/process'
import { ActivityType, type MilkSource, type PoopColor, type PeeAmount, type SpitUpType, type SupplementType } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'
import type { ActivityDoc } from '@/lib/payload/models'

// POST: Parse multiple chat messages with unified AI processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const entries = Array.isArray(body.entries) ? (body.entries as BatchEntry[]) : []

    if (entries.length === 0) {
      return NextResponse.json({ error: '请提供至少一条记录' }, { status: 400 })
    }

    if (entries.length > 50) {
      return NextResponse.json({ error: '单次最多解析50条记录' }, { status: 400 })
    }

    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    // Send all entries to AI at once for holistic parsing
    const items = await batchParseWithAI(entries)

    // For update actions on SLEEP, look up unclosed sleep records
    for (const item of items) {
      if (item.action === 'update' && item.type === ('SLEEP' as ActivityType)) {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

        const unclosedSleep = await payload.find({
          collection: 'activities',
          where: {
            and: [
              { babyId: { equals: baby.id } },
              { type: { equals: 'SLEEP' } },
              { endTime: { exists: false } },
              { startTime: { greater_than: twelveHoursAgo } },
            ],
          },
          sort: '-startTime',
          limit: 1,
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })

        if (unclosedSleep.docs.length > 0) {
          const existing = unclosedSleep.docs[0] as ActivityDoc
          // Attach the existing activity ID so frontend/PUT handler can use it
          ;(item as BatchParsedItem & { existingActivityId?: string }).existingActivityId =
            existing.id
        }
      }
    }

    return NextResponse.json({ items })
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

// Confirmed item sent by frontend
interface ConfirmedItem {
  action: 'create' | 'update' | 'skip'
  type: ActivityType
  startTime: string
  endTime?: string | null
  existingActivityId?: string | null
  milkAmount?: number | null
  milkSource?: MilkSource | null
  hasPoop?: boolean | null
  hasPee?: boolean | null
  poopColor?: PoopColor | null
  peeAmount?: PeeAmount | null
  spitUpType?: SpitUpType | null
  supplementType?: SupplementType | null
  count?: number | null
  notes?: string | null
  originalTexts?: string[]
}

// PUT: Batch create/update confirmed activities
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const items = Array.isArray(body.items) ? (body.items as ConfirmedItem[]) : []

    if (items.length === 0) {
      return NextResponse.json({ error: '请提供至少一条记录' }, { status: 400 })
    }

    // Validate: every item must have an explicit action
    for (const item of items) {
      if (!item.action || !['create', 'update', 'skip'].includes(item.action)) {
        return NextResponse.json(
          { error: '每条记录必须包含有效的 action 字段（create/update/skip）' },
          { status: 400 },
        )
      }
    }

    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const created: Array<{ id: string; type: string; originalTexts: string[] }> = []
    const updated: Array<{ id: string; type: string; originalTexts: string[] }> = []
    const skipped: Array<{ originalTexts: string[] }> = []
    const errors: Array<{ originalTexts: string[]; error: string }> = []

    for (const item of items) {
      const originalTexts = item.originalTexts || []

      if (item.action === 'skip') {
        skipped.push({ originalTexts })
        continue
      }

      if (item.action === 'update') {
        // Update an existing activity (e.g., set endTime on unclosed SLEEP)
        const activityId = item.existingActivityId
        if (!activityId) {
          errors.push({ originalTexts, error: '缺少 existingActivityId' })
          continue
        }

        try {
          // Verify the activity belongs to this baby
          const existing = await payload.findByID({
            collection: 'activities',
            id: activityId,
            depth: 0,
            overrideAccess: true,
          })

          if (!existing || (existing as ActivityDoc).babyId !== baby.id) {
            errors.push({ originalTexts, error: '活动不存在或不属于当前宝宝' })
            continue
          }

          const updateData: Record<string, unknown> = {}
          if (item.endTime) updateData.endTime = item.endTime

          const updatedActivity = await payload.update({
            collection: 'activities',
            id: activityId,
            data: updateData,
            depth: 0,
            overrideAccess: true,
          })

          updated.push({
            id: String(updatedActivity.id),
            type: item.type,
            originalTexts,
          })

          try {
            await createAuditLog(payload, {
              action: 'UPDATE',
              resourceId: activityId,
              inputMethod: 'VOICE',
              inputText: originalTexts.join(' | '),
              description: `批量导入: 更新${item.type} endTime`,
              success: true,
              beforeData: existing,
              afterData: updatedActivity,
              activityId,
              babyId: baby.id,
              userId: user.id,
            })
          } catch {
            // audit log failure should not break the main flow
          }
        } catch (err) {
          errors.push({
            originalTexts,
            error: err instanceof Error ? err.message : '更新失败',
          })
        }
        continue
      }

      // action === 'create'
      try {
        const activity = await payload.create({
          collection: 'activities',
          data: {
            type: item.type,
            startTime: item.startTime,
            endTime: item.endTime || null,
            babyId: baby.id,
            milkAmount: item.milkAmount ?? null,
            milkSource: item.milkSource ?? null,
            hasPoop: item.hasPoop ?? null,
            hasPee: item.hasPee ?? null,
            poopColor: item.poopColor ?? null,
            peeAmount: item.peeAmount ?? null,
            spitUpType: item.spitUpType ?? null,
            supplementType: item.supplementType ?? null,
            count: item.count ?? null,
            notes: item.notes ?? null,
          },
          depth: 0,
          overrideAccess: true,
        })

        created.push({
          id: String(activity.id),
          type: item.type,
          originalTexts,
        })

        try {
          await createAuditLog(payload, {
            action: 'CREATE',
            resourceId: String(activity.id),
            inputMethod: 'VOICE',
            inputText: originalTexts.join(' | '),
            description: `批量导入: 创建${item.type}`,
            success: true,
            beforeData: null,
            afterData: activity,
            activityId: String(activity.id),
            babyId: baby.id,
            userId: user.id,
          })
        } catch {
          // audit log failure should not break the main flow
        }
      } catch (err) {
        errors.push({
          originalTexts,
          error: err instanceof Error ? err.message : '创建失败',
        })
      }
    }

    return NextResponse.json({ created, updated, skipped, errors })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) return authError

    console.error('Batch create/update failed:', error)
    return NextResponse.json(
      { error: '批量创建失败', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    )
  }
}
