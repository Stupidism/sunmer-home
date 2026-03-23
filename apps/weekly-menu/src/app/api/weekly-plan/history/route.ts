import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { getPayloadClient } from '@/lib/payload/client'
import { getWeekStart } from '@/lib/utils/week'

export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = Math.max(1, Math.min(10, Number(url.searchParams.get('pageSize')) || 2))

  const currentWeekStart = getWeekStart(new Date())
  // 包含当前周：weekStartDate <= 当前周一，即当前周及过去周均显示
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'weekly-plans',
    where: {
      userId: { equals: userId },
      weekStartDate: { less_than_equal: currentWeekStart },
    },
    sort: '-weekStartDate',
    page,
    limit: pageSize,
    overrideAccess: true,
  })

  const items = await Promise.all(
    result.docs.map(async (plan) => {
      const slots = await payload.find({
        collection: 'meal-slots',
        where: { planId: { equals: plan.id as number } },
        limit: 100,
        pagination: false,
        overrideAccess: true,
      })

      const slotIds = slots.docs.map((s) => s.id as number)
      let dishNames: string[] = []

      if (slotIds.length > 0) {
        const mealDishes = await payload.find({
          collection: 'meal-dishes',
          where: { slotId: { in: slotIds } },
          limit: 200,
          pagination: false,
          overrideAccess: true,
        })

        const dishIds = [...new Set(mealDishes.docs.map((d) => d.dishId as number))]
        if (dishIds.length > 0) {
          const dishes = await payload.find({
            collection: 'dishes',
            where: { id: { in: dishIds.slice(0, 6) } },
            limit: 6,
            pagination: false,
            overrideAccess: true,
          })
          dishNames = dishes.docs.map((d) => d.name as string)
        }
      }

      const weekStartDate =
        typeof plan.weekStartDate === 'string'
          ? plan.weekStartDate.slice(0, 10)
          : String(plan.weekStartDate ?? '').slice(0, 10)

      return {
        id: plan.id,
        weekStartDate,
        status: plan.status,
        dishPreview: dishNames.slice(0, 6),
      }
    }),
  )

  return NextResponse.json({
    items,
    page: result.page,
    totalPages: result.totalPages,
    totalDocs: result.totalDocs,
  })
}
