import { NextRequest, NextResponse } from 'next/server'
import { type Where } from 'payload'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { ActivityType } from '@/types/activity'
import { parseDailyStatDate } from '@/lib/daily-stats/compute'
import { endOfDayChina, startOfDayChina } from '@/lib/dayjs'
import { getPayloadClient } from '@/lib/payload/client'
import type { ActivityDoc, DailyStatDoc } from '@/lib/payload/models'

function calculateDurationInDay(startTime: Date, endTime: Date, dayStart: Date, dayEnd: Date): number {
  const effectiveStart = startTime < dayStart ? dayStart : startTime
  const effectiveEnd = endTime > dayEnd ? dayEnd : endTime

  if (effectiveStart >= effectiveEnd) {
    return 0
  }

  return Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60))
}

function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function computeDailyStats(babyId: string, dateStr: string) {
  const payload = await getPayloadClient()
  const dayStart = startOfDayChina(dateStr)
  const dayEnd = endOfDayChina(dateStr)

  const activitiesResult = await payload.find({
    collection: 'activities',
    where: {
      and: [
        {
          babyId: {
            equals: babyId,
          },
        },
        {
          or: [
            {
              and: [
                {
                  startTime: {
                    greater_than_equal: dayStart.toISOString(),
                  },
                },
                {
                  startTime: {
                    less_than_equal: dayEnd.toISOString(),
                  },
                },
              ],
            },
            {
              and: [
                {
                  endTime: {
                    greater_than_equal: dayStart.toISOString(),
                  },
                },
                {
                  endTime: {
                    less_than_equal: dayEnd.toISOString(),
                  },
                },
              ],
            },
            {
              and: [
                {
                  startTime: {
                    less_than: dayStart.toISOString(),
                  },
                },
                {
                  endTime: {
                    greater_than: dayEnd.toISOString(),
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  const activities = activitiesResult.docs as ActivityDoc[]

  const stats = {
    sleepCount: 0,
    totalSleepMinutes: 0,
    breastfeedCount: 0,
    totalBreastfeedMinutes: 0,
    bottleCount: 0,
    totalMilkAmount: 0,
    pumpCount: 0,
    totalPumpMilkAmount: 0,
    diaperCount: 0,
    poopCount: 0,
    peeCount: 0,
    exerciseCount: 0,
    totalHeadLiftMinutes: 0,
    supplementADCount: 0,
    supplementD3Count: 0,
    spitUpCount: 0,
    projectileSpitUpCount: 0,
  }

  for (const activity of activities) {
    const startTime = toDate(activity.startTime)
    const endTime = toDate(activity.endTime || null)

    if (!startTime) {
      continue
    }

    const isStartInDay = startTime >= dayStart && startTime <= dayEnd

    switch (activity.type) {
      case ActivityType.SLEEP:
        if (endTime) {
          const duration = calculateDurationInDay(startTime, endTime, dayStart, dayEnd)
          if (duration > 0) {
            stats.sleepCount += 1
            stats.totalSleepMinutes += duration
          }
        }
        break

      case ActivityType.BREASTFEED:
        if (isStartInDay) {
          stats.breastfeedCount += 1
          if (endTime) {
            stats.totalBreastfeedMinutes += calculateDurationMinutes(startTime, endTime)
          }
        }
        break

      case ActivityType.BOTTLE:
        if (isStartInDay) {
          stats.bottleCount += 1
          stats.totalMilkAmount += typeof activity.milkAmount === 'number' ? activity.milkAmount : 0
        }
        break

      case ActivityType.PUMP:
        if (isStartInDay) {
          stats.pumpCount += 1
          stats.totalPumpMilkAmount += typeof activity.milkAmount === 'number' ? activity.milkAmount : 0
        }
        break

      case ActivityType.DIAPER:
        stats.diaperCount += 1
        if (activity.hasPoop) stats.poopCount += 1
        if (activity.hasPee) stats.peeCount += 1
        break

      case ActivityType.HEAD_LIFT:
        if (isStartInDay) {
          stats.exerciseCount += 1
          if (endTime) {
            stats.totalHeadLiftMinutes += calculateDurationMinutes(startTime, endTime)
          }
        }
        break

      case ActivityType.PASSIVE_EXERCISE:
      case ActivityType.GAS_EXERCISE:
      case ActivityType.BATH:
      case ActivityType.OUTDOOR:
      case ActivityType.EARLY_EDUCATION:
        if (isStartInDay) {
          stats.exerciseCount += 1
        }
        break

      case ActivityType.SUPPLEMENT:
        if (isStartInDay) {
          if (activity.supplementType === 'AD') {
            stats.supplementADCount += 1
          } else if (activity.supplementType === 'D3') {
            stats.supplementD3Count += 1
          }
        }
        break

      case ActivityType.SPIT_UP:
        if (isStartInDay) {
          stats.spitUpCount += 1
          if (activity.spitUpType === 'PROJECTILE') {
            stats.projectileSpitUpCount += 1
          }
        }
        break

      default:
        break
    }
  }

  return stats
}

export async function GET(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const searchParams = request.nextUrl.searchParams
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    const conditions: Where[] = [
      {
        babyId: {
          equals: baby.id,
        },
      },
    ]

    if (startDateStr) {
      const parsedStartDate = parseDailyStatDate(startDateStr)
      if (parsedStartDate) {
        const startDate = startOfDayChina(parsedStartDate)
        conditions.push({
          date: {
            greater_than_equal: startDate.toISOString(),
          },
        })
      }
    }

    if (endDateStr) {
      const parsedEndDate = parseDailyStatDate(endDateStr)
      if (parsedEndDate) {
        const endDate = endOfDayChina(parsedEndDate)
        conditions.push({
          date: {
            less_than_equal: endDate.toISOString(),
          },
        })
      }
    }

    const stats = await payload.find({
      collection: 'daily-stats',
      where: {
        and: conditions,
      },
      sort: 'date',
      limit: 500,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json(stats.docs)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch daily stats:', error)
    return NextResponse.json({ error: 'Failed to fetch daily stats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const body = await request.json()
    const dateStr = body.date as string | undefined

    if (!dateStr) {
      return NextResponse.json({ error: '日期是必需的' }, { status: 400 })
    }

    const parsedDate = parseDailyStatDate(dateStr)
    if (!parsedDate) {
      return NextResponse.json({ error: '日期格式无效' }, { status: 400 })
    }
    const statDate = startOfDayChina(parsedDate)

    const stats = await computeDailyStats(baby.id, parsedDate)

    const existing = await payload.find({
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
              equals: statDate.toISOString(),
            },
          },
        ],
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    let dailyStat: DailyStatDoc

    if (existing.totalDocs > 0) {
      const updated = await payload.update({
        collection: 'daily-stats',
        id: String(existing.docs[0].id),
        data: stats,
        depth: 0,
        overrideAccess: true,
      })

      dailyStat = updated as DailyStatDoc
    } else {
      const created = await payload.create({
        collection: 'daily-stats',
        data: {
          date: statDate.toISOString(),
          babyId: baby.id,
          ...stats,
        },
        depth: 0,
        overrideAccess: true,
      })

      dailyStat = created as DailyStatDoc
    }

    return NextResponse.json(dailyStat)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to compute daily stats:', error)
    return NextResponse.json({ error: 'Failed to compute daily stats' }, { status: 500 })
  }
}
