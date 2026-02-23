import { NextRequest, NextResponse } from 'next/server'
import {
  asAuthFailure,
  getCurrentBaby,
  getRequestedBabyId,
  requireAuth,
} from '@/lib/auth/get-current-baby'

type ContextBaby = {
  id: string
  name: string
  fullName: string | null
  avatarUrl: string | null
  isDefault: boolean
}

function toContextBaby(input: {
  id: string
  name: string
  fullName: string | null
  avatarUrl: string | null
  isDefault: boolean
}): ContextBaby {
  return {
    id: input.id,
    name: input.name,
    fullName: input.fullName,
    avatarUrl: input.avatarUrl,
    isDefault: input.isDefault,
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth({ babyId: getRequestedBabyId(request) })

    return NextResponse.json({
      authenticated: true,
      hasBaby: true,
      baby: toContextBaby(context.baby),
      babies: context.babies.map(toContextBaby),
      defaultBabyId: context.babies.find((item) => item.isDefault)?.id ?? context.babies[0]?.id ?? null,
    })
  } catch (error) {
    const failure = asAuthFailure(error)
    if (!failure) {
      console.error('Failed to fetch auth context:', error)
      return NextResponse.json(
        { authenticated: false, hasBaby: false, error: 'Failed to fetch auth context' },
        { status: 500 }
      )
    }

    if (failure.code === 'UNAUTHORIZED') {
      return NextResponse.json({ authenticated: false, hasBaby: false }, { status: 401 })
    }

    if (failure.code === 'NO_BABY_BINDING') {
      return NextResponse.json({
        authenticated: true,
        hasBaby: false,
        baby: null,
        babies: [],
        defaultBabyId: null,
      })
    }

    if (failure.code === 'BABY_FORBIDDEN') {
      const fallbackContext = await getCurrentBaby()
      return NextResponse.json(
        {
          authenticated: true,
          hasBaby: Boolean(fallbackContext),
          error: failure.message,
          code: failure.code,
          baby: fallbackContext ? toContextBaby(fallbackContext.baby) : null,
          babies: fallbackContext ? fallbackContext.babies.map(toContextBaby) : [],
          defaultBabyId:
            fallbackContext?.babies.find((item) => item.isDefault)?.id ?? fallbackContext?.babies[0]?.id ?? null,
        },
        { status: failure.status }
      )
    }

    return NextResponse.json(
      { authenticated: true, hasBaby: false, error: failure.message, code: failure.code },
      { status: failure.status }
    )
  }
}
