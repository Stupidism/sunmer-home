import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { deleteAllHistoryPlans, deletePlan } from '@/lib/services/data-access'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const deleteAll = (body as { deleteAll?: boolean }).deleteAll === true

  if (deleteAll) {
    const deletedCount = await deleteAllHistoryPlans(userId)
    return NextResponse.json({ ok: true, deletedCount })
  }

  const planId = Number((body as { planId?: number }).planId)

  if (!planId || Number.isNaN(planId)) {
    return NextResponse.json({ error: '无效的计划 ID' }, { status: 400 })
  }

  const deleted = await deletePlan(userId, planId)
  if (!deleted) {
    return NextResponse.json({ error: '未找到该计划或无权删除' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
