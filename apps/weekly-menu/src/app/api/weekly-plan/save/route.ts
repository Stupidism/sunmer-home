import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import { savePlanToDb, getWeeklyPlan } from '@/lib/services/data-access'
import type { GeneratedSlot } from '@/lib/types'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { weekStartDate, slots, confirmOverwrite } = body as {
    weekStartDate: string
    slots: GeneratedSlot[]
    confirmOverwrite?: boolean
  }

  if (!weekStartDate || !slots) {
    return NextResponse.json(
      { error: '缺少参数: weekStartDate, slots' },
      { status: 400 },
    )
  }

  const existing = await getWeeklyPlan(userId, weekStartDate)
  if (existing && !confirmOverwrite) {
    return NextResponse.json(
      {
        error: '已有草稿，确认覆盖？',
        code: 'EXISTING_DRAFT',
        existingStatus: existing.status,
      },
      { status: 409 },
    )
  }

  if (existing && existing.status === 'CONFIRMED' && !confirmOverwrite) {
    return NextResponse.json(
      {
        error: '该周已确认，不可覆盖',
        code: 'CONFIRMED_LOCKED',
      },
      { status: 409 },
    )
  }

  const existingPlanId = typeof existing?.id === 'number' ? existing.id : undefined
  const plan = await savePlanToDb(userId, weekStartDate, slots, undefined, existingPlanId)

  audit({ type: 'PLAN_SAVE_DRAFT', userId, weekStartDate })

  return NextResponse.json({
    id: plan.id,
    weekStartDate,
    status: 'DRAFT',
  })
}
