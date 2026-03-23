import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { getWeeklyPlan, getFullPlanSlots } from '@/lib/services/data-access'
import { getWeekStart } from '@/lib/utils/week'

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const url = new URL(request.url)
  const weekStartDate =
    url.searchParams.get('week') || getWeekStart(new Date())

  const plan = await getWeeklyPlan(userId, weekStartDate)
  if (!plan) {
    return NextResponse.json({ plan: null, slots: [] })
  }

  const slots = await getFullPlanSlots(plan.id as number)

  return NextResponse.json({
    plan: {
      id: plan.id,
      weekStartDate: plan.weekStartDate,
      status: plan.status,
    },
    slots,
  })
}
