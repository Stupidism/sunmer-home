import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import { getActiveDishes, getUserPreferences } from '@/lib/services/data-access'
import { findReplaceCandidates } from '@/lib/services/replace-dish'
import type { DishCategory, GeneratedSlot } from '@/lib/types'

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const {
    slotIndex,
    dishIndex,
    category,
    slots,
    mode = 'random',
    excludedDishIds,
  } = body as {
    slotIndex: number
    dishIndex: number
    category: DishCategory
    slots: GeneratedSlot[]
    mode?: 'random' | 'candidates'
    excludedDishIds?: number[]
  }

  if (slotIndex == null || dishIndex == null || !category || !slots) {
    return NextResponse.json(
      { error: '缺少参数: slotIndex, dishIndex, category, slots' },
      { status: 400 },
    )
  }

  const validExcludedDishIds = Array.isArray(excludedDishIds)
    ? excludedDishIds.filter((id) => typeof id === 'number' && Number.isFinite(id))
    : []

  const [pool, preferences] = await Promise.all([
    getActiveDishes(userId),
    getUserPreferences(userId),
  ])

  const result = findReplaceCandidates(
    slotIndex,
    dishIndex,
    category,
    slots,
    pool,
    preferences,
    mode,
    validExcludedDishIds,
  )

  audit({ type: 'PLAN_REPLACE_DISH', userId, slotIndex })

  return NextResponse.json(result)
}
