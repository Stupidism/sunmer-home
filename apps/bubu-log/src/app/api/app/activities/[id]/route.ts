import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { ActivityType, ActivityTypeLabels } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'
import { createAuditLog } from '@/lib/payload/audit'
import type { ActivityDoc } from '@/lib/payload/models'

const POINT_EVENT_TYPES = ['DIAPER', 'SUPPLEMENT', 'SPIT_UP', 'ROLL_OVER', 'PULL_TO_SIT']

interface RouteParams {
  params: Promise<{ id: string }>
}

async function findActivityByIdForBaby(id: string, babyId: string): Promise<ActivityDoc | null> {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'activities',
    where: {
      and: [
        {
          id: {
            equals: id,
          },
        },
        {
          babyId: {
            equals: babyId,
          },
        },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  return (result.docs[0] as ActivityDoc | undefined) ?? null
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const { id } = await params

    const activity = await findActivityByIdForBaby(id, baby.id)

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    return NextResponse.json(activity)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch activity:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const { id } = await params

    const payload = await getPayloadClient()

    const originalActivity = await findActivityByIdForBaby(id, baby.id)

    if (!originalActivity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

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
      count,
      notes,
    } = body

    const updateData: Record<string, unknown> = {}

    const activityType = type ?? originalActivity.type
    const isPointEvent = POINT_EVENT_TYPES.includes(activityType)

    if (type !== undefined) {
      updateData.type = type
    }

    if (startTime !== undefined) {
      const parsed = new Date(startTime)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: '无效的开始时间' }, { status: 400 })
      }

      updateData.startTime = parsed.toISOString()

      if (isPointEvent) {
        updateData.endTime = parsed.toISOString()
      }
    }

    if (endTime !== undefined && !isPointEvent) {
      if (endTime === null) {
        updateData.endTime = null
      } else {
        const parsed = new Date(endTime)
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: '无效的结束时间' }, { status: 400 })
        }

        updateData.endTime = parsed.toISOString()
      }
    }

    if (hasPoop !== undefined) updateData.hasPoop = hasPoop
    if (hasPee !== undefined) updateData.hasPee = hasPee
    if (poopColor !== undefined) updateData.poopColor = poopColor
    if (poopPhotoUrl !== undefined) updateData.poopPhotoUrl = poopPhotoUrl
    if (peeAmount !== undefined) updateData.peeAmount = peeAmount
    if (burpSuccess !== undefined) updateData.burpSuccess = burpSuccess
    if (milkAmount !== undefined) updateData.milkAmount = milkAmount
    if (milkSource !== undefined) updateData.milkSource = milkSource
    if (breastFirmness !== undefined) updateData.breastFirmness = breastFirmness
    if (count !== undefined) updateData.count = count
    if (notes !== undefined) updateData.notes = notes

    const activity = await payload.update({
      collection: 'activities',
      id,
      data: updateData,
      depth: 0,
      overrideAccess: true,
    })

    const typeLabel = ActivityTypeLabels[(activity as ActivityDoc).type as ActivityType] || (activity as ActivityDoc).type

    await createAuditLog(payload, {
      action: 'UPDATE',
      resourceId: String(activity.id),
      inputMethod: 'TEXT',
      description: `修改${typeLabel}`,
      success: true,
      beforeData: originalActivity,
      afterData: activity,
      activityId: String(activity.id),
      babyId: baby.id,
      userId: user.id,
    })

    return NextResponse.json(activity)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to update activity:', error)
    return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { baby, user } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const { id } = await params

    const payload = await getPayloadClient()

    const activity = await findActivityByIdForBaby(id, baby.id)

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
    }

    const typeLabel = ActivityTypeLabels[activity.type as ActivityType] || activity.type

    await payload.delete({
      collection: 'activities',
      id,
      depth: 0,
      overrideAccess: true,
    })

    await createAuditLog(payload, {
      action: 'DELETE',
      resourceId: id,
      inputMethod: 'TEXT',
      description: `删除${typeLabel}`,
      success: true,
      beforeData: activity,
      afterData: null,
      activityId: null,
      babyId: baby.id,
      userId: user.id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to delete activity:', error)
    return NextResponse.json({ error: 'Failed to delete activity' }, { status: 500 })
  }
}
