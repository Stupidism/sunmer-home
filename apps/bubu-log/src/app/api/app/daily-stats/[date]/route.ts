import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'
import { parseDailyStatDate } from '@/lib/daily-stats/compute'
import { endOfDayChina, startOfDayChina } from '@/lib/dayjs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()
    const { date: dateStr } = await params

    const parsedDate = parseDailyStatDate(dateStr)
    if (!parsedDate) {
      return NextResponse.json({ error: '无效的日期格式' }, { status: 400 })
    }

    const dayStart = startOfDayChina(parsedDate)
    const dayEnd = endOfDayChina(parsedDate)

    const stat = await payload.find({
      collection: 'daily-stats',
      where: {
        and: [
          {
            babyId: {
              equals: baby.id,
            },
          },
          {
            date: {
              greater_than_equal: dayStart.toISOString(),
            },
          },
          {
            date: {
              less_than_equal: dayEnd.toISOString(),
            },
          },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    if (stat.totalDocs === 0) {
      return NextResponse.json({ error: '未找到该日期的统计数据' }, { status: 404 })
    }

    return NextResponse.json(stat.docs[0])
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch daily stat:', error)
    return NextResponse.json({ error: 'Failed to fetch daily stat' }, { status: 500 })
  }
}
