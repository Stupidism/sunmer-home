import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { dayjs, CHINA_TIMEZONE } from '@/lib/dayjs'
import { getPayloadClient } from '@/lib/payload/client'
import { parseDailyStatDate, upsertDailyStatsForBaby } from '@/lib/daily-stats/compute'
import type { BabyDoc } from '@/lib/payload/models'

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization')
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim()
  }
  return null
}

function secureCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Server misconfigured: CRON_SECRET is required' },
        { status: 500 },
      )
    }

    const token = extractBearerToken(request)
    if (!token || !secureCompare(token, cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const forcedDate = request.nextUrl.searchParams.get('date')
    const targetDateStr = forcedDate || dayjs().tz(CHINA_TIMEZONE).subtract(1, 'day').format('YYYY-MM-DD')
    const parsedTargetDate = parseDailyStatDate(targetDateStr)

    if (!parsedTargetDate) {
      return NextResponse.json(
        { error: 'Invalid date format, expected YYYY-MM-DD' },
        { status: 400 },
      )
    }

    const payload = await getPayloadClient()
    const babiesResult = await payload.find({
      collection: 'babies',
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const babies = babiesResult.docs as BabyDoc[]
    const failures: Array<{ babyId: string; error: string }> = []
    let successCount = 0

    for (const baby of babies) {
      try {
        await upsertDailyStatsForBaby(payload, baby.id, parsedTargetDate)
        successCount += 1
      } catch (error) {
        failures.push({
          babyId: baby.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json(
      {
        targetDate: targetDateStr,
        timezone: CHINA_TIMEZONE,
        totalBabies: babies.length,
        successCount,
        failedCount: failures.length,
        failures,
      },
      { status: failures.length > 0 ? 207 : 200 },
    )
  } catch (error) {
    console.error('Cron daily stats job failed:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
