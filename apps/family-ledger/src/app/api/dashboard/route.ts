import { NextResponse } from 'next/server'
import { dashboardAccess } from '@/lib/access'
import { runtimeConfiguration } from '@/server/config'
import { getSessionUser } from '@/server/auth'
import { readPublishedSnapshot } from '@/server/repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSessionUser()
  const access = dashboardAccess(session, runtimeConfiguration())
  if (!access.allowed) {
    return NextResponse.json({ error: access.code }, { status: access.status })
  }
  try {
    const snapshot = await readPublishedSnapshot()
    return NextResponse.json(snapshot, { headers: { 'cache-control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'ledger-unavailable' }, { status: 503 })
  }
}
