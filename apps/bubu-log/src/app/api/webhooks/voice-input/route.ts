import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { requireAuth } from '@/lib/auth/get-current-baby'
import { getPayloadClient } from '@/lib/payload/client'
import { processVoiceInput } from '@/lib/voice-input/process'
import { verifyVoiceWebhookToken } from '@/lib/voice-input/webhook-token'

function extractApiKey(request: NextRequest): string | null {
  return request.headers.get('x-api-key')?.trim() || null
}

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

type ResolvedIdentity = {
  babyId: string
  userId: string | null
}

type AuthMode = 'signed-token' | 'session' | 'api-key'

function logWebhookNonSuccess(input: {
  status: number
  code: string
  text: string
  babyId?: string | null
  userId?: string | null
  details?: string
}) {
  console.warn('[voice-webhook][non-success]', {
    status: input.status,
    code: input.code,
    text: input.text,
    babyId: input.babyId ?? null,
    userId: input.userId ?? null,
    details: input.details ?? null,
  })
}

function parseRequestedBabyId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// POST: Parse voice input and create activity
// Auth modes (priority):
// 1) Signed user token (Authorization: Bearer <token>)
// 2) Session cookie (same as /api/app/voice-input)
// 3) Global API key (x-api-key / Bearer == VOICE_WEBHOOK_API_KEY)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const text = typeof body.text === 'string' ? body.text : ''
    const localTime = typeof body.localTime === 'string' ? body.localTime : null
    const requestedBabyId = parseRequestedBabyId(body.babyId)

    const apiKeyFromHeader = extractApiKey(request)
    const bearerToken = extractBearerToken(request)
    const configuredApiKey = process.env.VOICE_WEBHOOK_API_KEY?.trim() || null

    let identity: ResolvedIdentity | null = null
    let authMode: AuthMode | null = null

    // Mode 1: signed user token
    if (bearerToken) {
      const payload = verifyVoiceWebhookToken(bearerToken)
      if (payload) {
        identity = {
          babyId: payload.babyId,
          userId: payload.userId,
        }
        authMode = 'signed-token'
      }
    }

    // Mode 2: current session
    if (!identity && !apiKeyFromHeader && !bearerToken) {
      try {
        const { baby, user } = await requireAuth()
        identity = {
          babyId: baby.id,
          userId: user.id,
        }
        authMode = 'session'
      } catch {
        // Continue to API-key mode check
      }
    }

    // Mode 3: global API key (backward compatibility)
    if (!identity && configuredApiKey) {
      const incomingApiKey = apiKeyFromHeader || bearerToken
      if (incomingApiKey && secureCompare(incomingApiKey, configuredApiKey)) {
        const targetBabyId = requestedBabyId || process.env.VOICE_WEBHOOK_DEFAULT_BABY_ID || null

        if (!targetBabyId) {
          logWebhookNonSuccess({
            status: 400,
            code: 'MISSING_BABY_ID',
            text,
            details: 'missing body.babyId and VOICE_WEBHOOK_DEFAULT_BABY_ID',
          })
          return NextResponse.json(
            {
              error: 'Missing babyId. Provide body.babyId or VOICE_WEBHOOK_DEFAULT_BABY_ID',
              code: 'MISSING_BABY_ID',
            },
            { status: 400 },
          )
        }

        const auditUserId = process.env.VOICE_WEBHOOK_AUDIT_USER_ID ?? null
        if (auditUserId) {
          const payload = await getPayloadClient()
          const userResult = await payload.find({
            collection: 'app-users',
            where: {
              id: {
                equals: auditUserId,
              },
            },
            limit: 1,
            pagination: false,
            depth: 0,
            overrideAccess: true,
          })

          if (!userResult.docs.length) {
            logWebhookNonSuccess({
              status: 500,
              code: 'INVALID_AUDIT_USER_ID',
              text,
              babyId: targetBabyId,
              userId: auditUserId,
              details: `invalid VOICE_WEBHOOK_AUDIT_USER_ID: ${auditUserId}`,
            })
            return NextResponse.json(
              {
                error: `Invalid VOICE_WEBHOOK_AUDIT_USER_ID: ${auditUserId}`,
                code: 'INVALID_AUDIT_USER_ID',
              },
              { status: 500 },
            )
          }
        }

        identity = {
          babyId: targetBabyId,
          userId: auditUserId,
        }
        authMode = 'api-key'
      }
    }

    if (!identity) {
      logWebhookNonSuccess({
        status: 401,
        code: 'UNAUTHORIZED',
        text,
        details: 'missing valid signed token/session/api key',
      })
      return NextResponse.json(
        {
          error: 'Unauthorized',
          code: 'UNAUTHORIZED',
          message: 'Use signed Bearer token, session cookie, or configured API key',
        },
        { status: 401 },
      )
    }

    const payload = await getPayloadClient()
    if (authMode === 'signed-token') {
      if (!identity.userId) {
        logWebhookNonSuccess({
          status: 401,
          code: 'INVALID_SIGNED_TOKEN',
          text,
          babyId: identity.babyId,
          details: 'signed token missing userId',
        })
        return NextResponse.json(
          {
            error: 'Invalid signed token',
            code: 'INVALID_SIGNED_TOKEN',
          },
          { status: 401 },
        )
      }

      const signedTokenTargetBabyId = requestedBabyId || identity.babyId
      if (!signedTokenTargetBabyId) {
        logWebhookNonSuccess({
          status: 400,
          code: 'MISSING_BABY_ID',
          text,
          userId: identity.userId,
          details: 'signed token request missing baby scope',
        })
        return NextResponse.json(
          {
            error: 'Missing babyId for signed token request',
            code: 'MISSING_BABY_ID',
          },
          { status: 400 },
        )
      }

      const bindingResult = await payload.find({
        collection: 'baby-users',
        where: {
          and: [
            {
              user: {
                equals: identity.userId,
              },
            },
            {
              baby: {
                equals: signedTokenTargetBabyId,
              },
            },
          ],
        },
        limit: 1,
        pagination: false,
        depth: 0,
        overrideAccess: true,
      })

      if (!bindingResult.docs.length) {
        logWebhookNonSuccess({
          status: 403,
          code: 'SIGNED_TOKEN_ACCESS_REVOKED',
          text,
          babyId: signedTokenTargetBabyId,
          userId: identity.userId,
          details: 'baby-user binding not found',
        })
        return NextResponse.json(
          {
            error: 'Signed token access revoked',
            code: 'SIGNED_TOKEN_ACCESS_REVOKED',
          },
          { status: 403 },
        )
      }

      identity = {
        ...identity,
        babyId: signedTokenTargetBabyId,
      }
    }

    const babyResult = await payload.find({
      collection: 'babies',
      where: {
        id: {
          equals: identity.babyId,
        },
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const baby = babyResult.docs[0]

    if (!baby) {
      logWebhookNonSuccess({
        status: 404,
        code: 'BABY_NOT_FOUND',
        text,
        babyId: identity.babyId,
        userId: identity.userId,
        details: `baby not found: ${identity.babyId}`,
      })
      return NextResponse.json(
        {
          error: `Baby not found: ${identity.babyId}`,
          code: 'BABY_NOT_FOUND',
        },
        { status: 404 },
      )
    }

    const result = await processVoiceInput({
      text,
      localTime,
      babyId: baby.id,
      userId: identity.userId,
      confirmationBaseUrl: process.env.VOICE_WEBHOOK_PUBLIC_BASE_URL?.trim() || request.nextUrl.origin,
    })

    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error('Voice webhook processing failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logWebhookNonSuccess({
      status: 500,
      code: 'PROCESSING_ERROR',
      text: '',
      details: errorMessage,
    })

    return NextResponse.json(
      {
        error: '处理语音输入失败',
        details: errorMessage,
        code: 'PROCESSING_ERROR',
      },
      { status: 500 },
    )
  }
}
