import { NextResponse } from 'next/server'
import { getAuthenticatedUserId } from '@/lib/auth/get-user'
import { audit } from '@/lib/audit'
import { getUserTemplate, upsertUserTemplate } from '@/lib/services/data-access'

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const template = await getUserTemplate(userId)
  return NextResponse.json(template)
}

export async function PUT(request: Request) {
  const userId = await getAuthenticatedUserId()
  if (!userId) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { meatCount, leafyGreenCount, otherCount } = body as {
    meatCount?: number
    leafyGreenCount?: number
    otherCount?: number
  }

  const clamp = (v: number | undefined, fallback: number) => {
    if (v == null) return fallback
    return Math.max(0, Math.min(3, Math.round(v)))
  }

  const current = await getUserTemplate(userId)
  const updated = await upsertUserTemplate(userId, {
    meatCount: clamp(meatCount, current.meatCount),
    leafyGreenCount: clamp(leafyGreenCount, current.leafyGreenCount),
    otherCount: clamp(otherCount, current.otherCount),
  })

  audit({ type: 'TEMPLATE_UPDATE', userId })

  return NextResponse.json(updated)
}
