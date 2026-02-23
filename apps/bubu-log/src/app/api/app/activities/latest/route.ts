import { NextRequest, NextResponse } from 'next/server'
import { authFailureResponse, getRequestedBabyId, requireAuth } from '@/lib/auth/get-current-baby'
import { ActivityType } from '@/types/activity'
import { getPayloadClient } from '@/lib/payload/client'

export async function GET(request: NextRequest) {
  try {
    const { baby } = await requireAuth({ babyId: getRequestedBabyId(request) })
    const payload = await getPayloadClient()

    const searchParams = request.nextUrl.searchParams
    const types = searchParams
      .get('types')
      ?.split(',')
      .map((item) => item.trim()) as ActivityType[] | undefined

    if (!types || types.length === 0) {
      return NextResponse.json({ error: 'Types parameter is required' }, { status: 400 })
    }

    const result = await payload.find({
      collection: 'activities',
      where: {
        and: [
          {
            babyId: {
              equals: baby.id,
            },
          },
          {
            type: {
              in: types,
            },
          },
        ],
      },
      sort: '-startTime',
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json(result.docs[0] || null)
  } catch (error) {
    const authError = authFailureResponse(error)
    if (authError) {
      return authError
    }

    console.error('Failed to fetch latest activity:', error)
    return NextResponse.json({ error: 'Failed to fetch latest activity' }, { status: 500 })
  }
}
