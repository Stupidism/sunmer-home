import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import { generateWeeklyPlan } from '@/lib/services/plan-generator'
import {
  getActiveDishes,
  getUserPreferences,
  getUserTemplate,
  getPrevWeekLastMealIngredients,
} from '@/lib/services/data-access'
import { getWeekStart, getPrevWeekStart } from '@/lib/utils/week'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const weekStartDate =
    (body.weekStartDate as string) || getWeekStart(new Date())

  const [template, dishes, preferences] = await Promise.all([
    getUserTemplate(userId),
    getActiveDishes(userId),
    getUserPreferences(userId),
  ])

  const prevWeekStart = getPrevWeekStart(weekStartDate)
  const prevIngredients = await getPrevWeekLastMealIngredients(
    userId,
    prevWeekStart,
  )

  const plan = generateWeeklyPlan(
    weekStartDate,
    template,
    dishes,
    preferences,
    prevIngredients,
  )

  audit({ type: 'PLAN_GENERATE', userId, weekStartDate })

  return NextResponse.json(plan)
}
