import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { getWeeklyPlan, getFullPlanSlots } from '@/lib/services/data-access'
import { getWeekStart } from '@/lib/utils/week'

const dayLabels = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日']

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
    return NextResponse.json({ days: [] })
  }

  const slots = await getFullPlanSlots(plan.id as number)

  const dayMap = new Map<
    number,
    { dishes: string[]; ingredients: Set<string> }
  >()

  for (const slot of slots) {
    if (!dayMap.has(slot.dayOfWeek)) {
      dayMap.set(slot.dayOfWeek, { dishes: [], ingredients: new Set() })
    }
    const entry = dayMap.get(slot.dayOfWeek)!
    for (const dish of slot.dishes) {
      entry.dishes.push(dish.name)
      entry.ingredients.add(dish.mainIngredient)
    }
  }

  const days = Array.from(dayMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, data]) => ({
      dayOfWeek,
      label: dayLabels[dayOfWeek],
      dishes: data.dishes,
      ingredients: [...data.ingredients],
    }))

  return NextResponse.json({ days })
}
