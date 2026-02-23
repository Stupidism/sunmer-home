import { NextRequest, NextResponse } from 'next/server'
import { type Where } from 'payload'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { ActivityType, ActivityTypeLabels } from '@/types/activity'
import { startOfDayChina, endOfDayChina } from '@/lib/dayjs'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'
import type { ActivityDoc } from '@/lib/payload/models'

const POINT_EVENT_TYPES = ['DIAPER', 'SUPPLEMENT', 'SPIT_UP', 'ROLL_OVER', 'PULL_TO_SIT']
const FEEDING_CONFLICT_TYPES = ['BREASTFEED', 'BOTTLE']
const SAME_TYPE_DURATION_TYPES = [
  'SLEEP',
  'HEAD_LIFT',
  'PASSIVE_EXERCISE',
  'GAS_EXERCISE',
  'BATH',
  'OUTDOOR',
  'EARLY_EDUCATION',
  'PUMP',
]
const SLEEP_CONFLICT_TYPES = [
  'HEAD_LIFT',
  'PASSIVE_EXERCISE',
  'ROLL_OVER',
  'PULL_TO_SIT',
  'GAS_EXERCISE',
  'BATH',
  'EARLY_EDUCATION',
]
const TIME_TOLERANCE_MS = 60 * 1000

const TYPE_LABELS: Record<string, string> = {
  SLEEP: '睡眠',
  BREASTFEED: '亲喂',
  BOTTLE: '瓶喂',
  PUMP: '吸奶',
  DIAPER: '换尿布',
  SUPPLEMENT: '补剂',
  SPIT_UP: '吐奶',
  HEAD_LIFT: '抬头',
  PASSIVE_EXERCISE: '被动操',
  ROLL_OVER: '翻身',
  PULL_TO_SIT: '拉坐',
  GAS_EXERCISE: '排气操',
  BATH: '洗澡',
  OUTDOOR: '户外',
  EARLY_EDUCATION: '早教',
}

type OverlapResult = {
  code: string
  message: string
  conflictingActivity?: ActivityDoc
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function isFutureTime(time: Date): boolean {
  const now = new Date()
  const tolerance = 2 * 60 * 1000
  return time.getTime() > now.getTime() + tolerance
}

function getOverlapEndTime(type: string, startTime: Date, endTime: Date | null): Date {
  if (endTime && endTime > startTime) {
    return endTime
  }

  if (FEEDING_CONFLICT_TYPES.includes(type)) {
    return new Date(startTime.getTime() + 30 * 60 * 1000)
  }

  if (SAME_TYPE_DURATION_TYPES.includes(type) || type === 'SLEEP') {
    return new Date(startTime.getTime() + 4 * 60 * 60 * 1000)
  }

  return new Date(startTime.getTime() + 1000)
}

async function findOverlappingActivity(args: {
  babyId: string
  types: string[]
  startTime: Date
  endTime: Date
  excludeId?: string
}): Promise<ActivityDoc | null> {
  if (args.types.length === 0) {
    return null
  }

  const payload = await getPayloadClient()

  const conditions: Where[] = [
    {
      babyId: {
        equals: args.babyId,
      },
    },
    {
      type: {
        in: args.types,
      },
    },
    {
      startTime: {
        less_than: args.endTime.toISOString(),
      },
    },
    {
      or: [
        {
          endTime: {
            greater_than: args.startTime.toISOString(),
          },
        },
        {
          endTime: {
            exists: false,
          },
        },
      ],
    },
  ]

  if (args.excludeId) {
    conditions.push({
      id: {
        not_equals: args.excludeId,
      },
    })
  }

  const result = await payload.find({
    collection: 'activities',
    where: {
      and: conditions,
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs[0] as ActivityDoc | undefined) ?? null
}

async function checkTimeOverlap(params: {
  babyId: string
  type: string
  startTime: Date
  endTime: Date | null
  excludeId?: string
}): Promise<OverlapResult | null> {
  const { babyId, type, startTime, endTime, excludeId } = params
  const isPointEvent = POINT_EVENT_TYPES.includes(type)
  const isFeedingConflictType = FEEDING_CONFLICT_TYPES.includes(type)
  const isSameTypeDuration = SAME_TYPE_DURATION_TYPES.includes(type)
  const isSleepConflictType = type === 'SLEEP' || SLEEP_CONFLICT_TYPES.includes(type)

  if (isFutureTime(startTime)) {
    return {
      code: 'FUTURE_TIME',
      message: '不能录入未来的活动',
    }
  }

  if (endTime && isFutureTime(endTime)) {
    return {
      code: 'FUTURE_TIME',
      message: '活动结束时间不能在未来',
    }
  }

  if (isPointEvent) {
    const payload = await getPayloadClient()
    const startMin = new Date(startTime.getTime() - TIME_TOLERANCE_MS)
    const startMax = new Date(startTime.getTime() + TIME_TOLERANCE_MS)

    const conditions: Where[] = [
      {
        babyId: {
          equals: babyId,
        },
      },
      {
        type: {
          equals: type,
        },
      },
      {
        startTime: {
          greater_than_equal: startMin.toISOString(),
        },
      },
      {
        startTime: {
          less_than_equal: startMax.toISOString(),
        },
      },
    ]

    if (excludeId) {
      conditions.push({
        id: {
          not_equals: excludeId,
        },
      })
    }

    const duplicate = await payload.find({
      collection: 'activities',
      where: {
        and: conditions,
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    if (duplicate.totalDocs > 0) {
      return {
        code: 'DUPLICATE_ACTIVITY',
        message: '该时间点已存在相同类型的记录',
        conflictingActivity: duplicate.docs[0] as ActivityDoc,
      }
    }
  }

  if (isFeedingConflictType) {
    const activityEnd = getOverlapEndTime(type, startTime, endTime)
    const overlapping = await findOverlappingActivity({
      babyId,
      types: FEEDING_CONFLICT_TYPES,
      startTime,
      endTime: activityEnd,
      excludeId,
    })

    if (overlapping) {
      const overlappingType = TYPE_LABELS[overlapping.type] || overlapping.type
      return {
        code: 'OVERLAP_ACTIVITY',
        message: `该时间段与已有的${overlappingType}记录重叠`,
        conflictingActivity: overlapping,
      }
    }
  }

  if (isSameTypeDuration) {
    const activityEnd = getOverlapEndTime(type, startTime, endTime)
    const overlapping = await findOverlappingActivity({
      babyId,
      types: [type],
      startTime,
      endTime: activityEnd,
      excludeId,
    })

    if (overlapping) {
      const typeLabel = TYPE_LABELS[type] || type
      return {
        code: 'DUPLICATE_ACTIVITY',
        message: `该时间段与已有的${typeLabel}记录重叠，请检查`,
        conflictingActivity: overlapping,
      }
    }
  }

  if (isSleepConflictType) {
    const activityEnd = getOverlapEndTime(type, startTime, endTime)
    const targetTypes = type === 'SLEEP' ? SLEEP_CONFLICT_TYPES : ['SLEEP']

    const overlapping = await findOverlappingActivity({
      babyId,
      types: targetTypes,
      startTime,
      endTime: activityEnd,
      excludeId,
    })

    if (overlapping) {
      const overlappingType = TYPE_LABELS[overlapping.type] || overlapping.type
      return {
        code: 'OVERLAP_ACTIVITY',
        message: `该时间段与已有的${overlappingType}记录重叠`,
        conflictingActivity: overlapping,
      }
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const type = searchParams.get('type') as ActivityType | null
    const types = searchParams.get('types')
    const date = searchParams.get('date')
    const startTimeGte = searchParams.get('startTimeGte')
    const startTimeLt = searchParams.get('startTimeLt')
    const crossStartTime = searchParams.get('crossStartTime') === 'true'
    const crossEndTime = searchParams.get('crossEndTime') === 'true'

    const conditions: Where[] = [
      {
        babyId: {
          equals: baby.id,
        },
      },
    ]

    if (type) {
      conditions.push({
        type: {
          equals: type,
        },
      })
    } else if (types) {
      const typeList = types
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      if (typeList.length > 0) {
        conditions.push({
          type: {
            in: typeList,
          },
        })
      }
    }

    if (startTimeGte || startTimeLt) {
      const startTimeGteDate = toDate(startTimeGte)
      const startTimeLtDate = toDate(startTimeLt)

      const rangeCondition: Record<string, string> = {}
      if (startTimeGteDate) {
        rangeCondition.greater_than_equal = startTimeGteDate.toISOString()
      }
      if (startTimeLtDate) {
        rangeCondition.less_than = startTimeLtDate.toISOString()
      }

      const options: Where[] = []
      if (Object.keys(rangeCondition).length > 0) {
        options.push({
          startTime: rangeCondition,
        })
      }

      if (crossStartTime && startTimeGteDate) {
        options.push({
          and: [
            {
              startTime: {
                less_than: startTimeGteDate.toISOString(),
              },
            },
            {
              or: [
                {
                  endTime: {
                    greater_than_equal: startTimeGteDate.toISOString(),
                  },
                },
                {
                  endTime: {
                    exists: false,
                  },
                },
              ],
            },
          ],
        })
      }

      if (crossEndTime && startTimeLtDate) {
        options.push({
          and: [
            {
              startTime: {
                less_than: startTimeLtDate.toISOString(),
              },
            },
            {
              or: [
                {
                  endTime: {
                    greater_than_equal: startTimeLtDate.toISOString(),
                  },
                },
                {
                  endTime: {
                    exists: false,
                  },
                },
              ],
            },
          ],
        })
      }

      if (options.length === 1) {
        conditions.push(options[0])
      } else if (options.length > 1) {
        conditions.push({
          or: options,
        })
      }
    } else if (date) {
      const startOfDay = startOfDayChina(date)
      const endOfDay = endOfDayChina(date)

      conditions.push({
        and: [
          {
            startTime: {
              less_than_equal: endOfDay.toISOString(),
            },
          },
          {
            or: [
              {
                endTime: {
                  greater_than_equal: startOfDay.toISOString(),
                },
              },
              {
                endTime: {
                  exists: false,
                },
              },
            ],
          },
        ],
      })
    }

    const activities = await payload.find({
      collection: 'activities',
      where: {
        and: conditions,
      },
      sort: '-startTime',
      limit,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json(activities.docs)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch activities:', error)
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const body = await request.json()
    const {
      type,
      startTime,
      endTime,
      hasPoop,
      hasPee,
      poopColor,
      poopPhotoUrl,
      peeAmount,
      burpSuccess,
      milkAmount,
      milkSource,
      breastFirmness,
      supplementType,
      spitUpType,
      count,
      notes,
      force,
    } = body

    const startTimeDate = new Date(startTime)
    if (Number.isNaN(startTimeDate.getTime())) {
      return NextResponse.json({ error: '无效的开始时间' }, { status: 400 })
    }

    const isPointEvent = POINT_EVENT_TYPES.includes(type)
    const endTimeDate = isPointEvent ? startTimeDate : endTime ? new Date(endTime) : null

    if (endTimeDate && Number.isNaN(endTimeDate.getTime())) {
      return NextResponse.json({ error: '无效的结束时间' }, { status: 400 })
    }

    const overlap = await checkTimeOverlap({
      babyId: baby.id,
      type,
      startTime: startTimeDate,
      endTime: endTimeDate,
    })

    if (overlap) {
      if (overlap.code === 'DUPLICATE_ACTIVITY' || !force) {
        return NextResponse.json(
          {
            error: overlap.message,
            code: overlap.code,
            conflictingActivity: overlap.conflictingActivity,
          },
          { status: 409 }
        )
      }
    }

    const activity = await payload.create({
      collection: 'activities',
      data: {
        type,
        startTime: startTimeDate.toISOString(),
        endTime: endTimeDate ? endTimeDate.toISOString() : null,
        babyId: baby.id,
        hasPoop,
        hasPee,
        poopColor,
        poopPhotoUrl,
        peeAmount,
        burpSuccess,
        milkAmount,
        milkSource,
        breastFirmness,
        supplementType,
        spitUpType,
        count,
        notes,
      },
      depth: 0,
      overrideAccess: true,
    })

    const typeLabel = ActivityTypeLabels[type as ActivityType] || type
    let description = `创建${typeLabel}`
    if (typeof milkAmount === 'number' && milkAmount > 0) {
      description += ` ${milkAmount}ml`
    }

    await createAuditLog(payload, {
      action: 'CREATE',
      resourceId: String(activity.id),
      inputMethod: 'TEXT',
      description,
      success: true,
      beforeData: null,
      afterData: activity,
      activityId: String(activity.id),
      babyId: baby.id,
      userId: user.id,
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to create activity:', error)
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const body = await request.json()
    const { ids, targetDate } = body as { ids?: string[]; targetDate?: string }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json(
        { error: 'targetDate is required in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const targetDateObj = new Date(`${targetDate}T00:00:00`)
    if (Number.isNaN(targetDateObj.getTime())) {
      return NextResponse.json({ error: '无效日期' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (targetDateObj > today) {
      return NextResponse.json({ error: '不能将活动移动到未来日期' }, { status: 400 })
    }

    const activitiesResult = await payload.find({
      collection: 'activities',
      where: {
        and: [
          {
            id: {
              in: ids,
            },
          },
          {
            babyId: {
              equals: baby.id,
            },
          },
        ],
      },
      limit: ids.length,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const activities = activitiesResult.docs as ActivityDoc[]

    if (activities.length === 0) {
      return NextResponse.json({ error: '未找到可修改的活动' }, { status: 404 })
    }

    let updatedCount = 0

    for (const activity of activities) {
      const originalStart = toDate(activity.startTime)
      if (!originalStart) {
        continue
      }

      const newStartTime = new Date(targetDateObj)
      newStartTime.setHours(
        originalStart.getHours(),
        originalStart.getMinutes(),
        originalStart.getSeconds(),
        originalStart.getMilliseconds()
      )

      let newEndTime: Date | null = null
      const originalEnd = toDate(activity.endTime || null)

      if (originalEnd) {
        newEndTime = new Date(targetDateObj)
        newEndTime.setHours(
          originalEnd.getHours(),
          originalEnd.getMinutes(),
          originalEnd.getSeconds(),
          originalEnd.getMilliseconds()
        )

        if (
          originalEnd.getHours() < originalStart.getHours() ||
          (originalEnd.getHours() === originalStart.getHours() &&
            originalEnd.getMinutes() < originalStart.getMinutes())
        ) {
          newEndTime.setDate(newEndTime.getDate() + 1)
        }
      }

      await payload.update({
        collection: 'activities',
        id: activity.id,
        data: {
          startTime: newStartTime.toISOString(),
          endTime: newEndTime ? newEndTime.toISOString() : null,
        },
        depth: 0,
        overrideAccess: true,
      })

      await createAuditLog(payload, {
        action: 'UPDATE',
        resourceId: activity.id,
        inputMethod: 'TEXT',
        description: `批量修改日期至 ${targetDate}`,
        success: true,
        beforeData: activity,
        afterData: {
          ...activity,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime ? newEndTime.toISOString() : null,
        },
        activityId: activity.id,
        babyId: baby.id,
        userId: user.id,
      })

      updatedCount += 1
    }

    return NextResponse.json({ success: true, count: updatedCount })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to batch update activity dates:', error)
    return NextResponse.json({ error: 'Failed to batch update activity dates' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const body = await request.json()
    const { ids } = body as { ids?: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    const activitiesResult = await payload.find({
      collection: 'activities',
      where: {
        and: [
          {
            id: {
              in: ids,
            },
          },
          {
            babyId: {
              equals: baby.id,
            },
          },
        ],
      },
      limit: ids.length,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    const activities = activitiesResult.docs as ActivityDoc[]

    let deletedCount = 0

    for (const activity of activities) {
      await payload.delete({
        collection: 'activities',
        id: activity.id,
        depth: 0,
        overrideAccess: true,
      })

      await createAuditLog(payload, {
        action: 'DELETE',
        resourceId: activity.id,
        inputMethod: 'TEXT',
        description: `批量删除${ActivityTypeLabels[activity.type as ActivityType] || activity.type}`,
        success: true,
        beforeData: activity,
        afterData: null,
        activityId: null,
        babyId: baby.id,
        userId: user.id,
      })

      deletedCount += 1
    }

    return NextResponse.json({ success: true, count: deletedCount })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to batch delete activities:', error)
    return NextResponse.json({ error: 'Failed to batch delete activities' }, { status: 500 })
  }
}
