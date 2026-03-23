import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload/client'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import { getWeeklyPlan, confirmPlan } from '@/lib/services/data-access'

export async function POST(request: Request) {
  try {
    const toPlan = (
      doc: unknown,
    ): { id: number; status: string; weekStartDate: string | Date } | null => {
      if (!doc || typeof doc !== 'object') return null
      const record = doc as Record<string, unknown>
      const rawId = record.id
      const rawStatus = record.status
      const rawWeek = record.weekStartDate

      const id =
        typeof rawId === 'number'
          ? rawId
          : typeof rawId === 'string'
            ? Number(rawId)
            : NaN
      if (Number.isNaN(id)) return null
      if (typeof rawStatus !== 'string') return null
      if (!(typeof rawWeek === 'string' || rawWeek instanceof Date)) return null

      return { id, status: rawStatus, weekStartDate: rawWeek }
    }

    const toWeekDateString = (value: unknown) => {
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10)
      }
      return String(value ?? '')
    }

    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { planId: rawPlanId, weekStartDate } = body as {
      planId?: number | string
      weekStartDate?: string
    }
    const planId =
      rawPlanId != null
        ? typeof rawPlanId === 'number'
          ? rawPlanId
          : Number(rawPlanId)
        : undefined

    let plan: { id: number; status: string; weekStartDate: string | Date } | null = null

    // Prefer planId: primary key lookup avoids Payload/PostgreSQL date query issues
    if (planId != null && !Number.isNaN(planId)) {
      const payload = await getPayloadClient()
      const result = await payload.find({
        collection: 'weekly-plans',
        where: {
          id: { equals: planId },
          userId: { equals: userId },
        },
        limit: 1,
        pagination: false,
        overrideAccess: true,
      })
      plan = toPlan(result.docs[0])
    }

    if (!plan && weekStartDate) {
      plan = toPlan(await getWeeklyPlan(userId, weekStartDate))
    }

    if (!plan) {
      return NextResponse.json(
        { error: '未找到该周计划' },
        { status: 404 },
      )
    }

    if (plan.status === 'CONFIRMED') {
      return NextResponse.json(
        { error: '该周计划已确认' },
        { status: 400 },
      )
    }

    await confirmPlan(Number(plan.id))

    const weekForAudit = toWeekDateString(plan.weekStartDate)
    audit({ type: 'PLAN_CONFIRM', userId, planId: plan.id, weekStartDate: weekForAudit })

    const weekStartDateStr = toWeekDateString(plan.weekStartDate)

    return NextResponse.json({
      id: plan.id,
      weekStartDate: weekStartDateStr,
      status: 'CONFIRMED',
    })
  } catch {
    return NextResponse.json({ error: '确认计划时发生错误' }, { status: 500 })
  }
}
