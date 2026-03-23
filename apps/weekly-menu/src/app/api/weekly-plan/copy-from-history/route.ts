import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import {
  getWeeklyPlan,
  getFullPlanSlots,
  savePlanToDb,
} from '@/lib/services/data-access'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { sourcePlanId, targetWeekStart, confirmOverwrite } = body as {
    sourcePlanId: number
    targetWeekStart: string
    confirmOverwrite?: boolean
  }

  if (!sourcePlanId || !targetWeekStart) {
    return NextResponse.json(
      { error: '缺少参数: sourcePlanId, targetWeekStart' },
      { status: 400 },
    )
  }

  const existing = await getWeeklyPlan(userId, targetWeekStart)
  if (existing && !confirmOverwrite) {
    return NextResponse.json(
      {
        error: '目标周已有计划，确认覆盖？',
        code: 'EXISTING_PLAN',
        existingStatus: existing.status,
      },
      { status: 409 },
    )
  }

  const sourceSlots = await getFullPlanSlots(sourcePlanId)
  if (sourceSlots.length === 0) {
    return NextResponse.json(
      { error: '源计划不存在或无数据' },
      { status: 404 },
    )
  }

  const plan = await savePlanToDb(userId, targetWeekStart, sourceSlots, sourcePlanId)

  audit({
    type: 'PLAN_COPY_FROM_HISTORY',
    userId,
    sourcePlanId,
    targetWeekStart,
  })

  return NextResponse.json({
    id: plan.id,
    weekStartDate: targetWeekStart,
    status: 'DRAFT',
  })
}
