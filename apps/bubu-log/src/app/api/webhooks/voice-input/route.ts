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

type BabyCandidate = {
  id: string
  name: string | null
  fullName: string | null
}

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

function normalizeNameForMatch(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}

export function pickBabyIdByNameHeuristic(text: string, candidates: BabyCandidate[]): string | null {
  const normalizedText = normalizeNameForMatch(text)
  if (!normalizedText) {
    return null
  }

  let best: { id: string; score: number } | null = null
  for (const candidate of candidates) {
    const names = [candidate.name, candidate.fullName]
      .map((value) => (value ? normalizeNameForMatch(value) : ''))
      .filter((value) => value.length > 0)

    for (const name of names) {
      if (!normalizedText.includes(name)) {
        continue
      }

      const score = name.length
      if (!best || score > best.score) {
        best = { id: candidate.id, score }
      }
    }
  }

  return best?.id ?? null
}

async function fetchUserBabyCandidates(params: {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  userId: string
}): Promise<BabyCandidate[]> {
  const { payload, userId } = params
  const bindings = await payload.find({
    collection: 'baby-users',
    where: {
      user: {
        equals: userId,
      },
    },
    limit: 200,
    pagination: false,
    depth: 1,
    overrideAccess: true,
  })

  const byId = new Map<string, BabyCandidate>()
  const unresolvedIds = new Set<string>()

  for (const binding of bindings.docs as Array<{ baby?: unknown }>) {
    const relation = binding?.baby

    if (typeof relation === 'string') {
      if (relation) {
        unresolvedIds.add(relation)
      }
      continue
    }

    if (!relation || typeof relation !== 'object') {
      continue
    }

    const doc = relation as { id?: string; name?: string | null; fullName?: string | null }
    if (!doc.id) {
      continue
    }

    byId.set(doc.id, {
      id: doc.id,
      name: doc.name ?? null,
      fullName: doc.fullName ?? null,
    })
  }

  const missingIds = Array.from(unresolvedIds).filter((id) => !byId.has(id))
  if (missingIds.length > 0) {
    const babies = await payload.find({
      collection: 'babies',
      where: {
        id: {
          in: missingIds,
        },
      },
      limit: missingIds.length,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    for (const baby of babies.docs as Array<{ id: string; name?: string | null; fullName?: string | null }>) {
      byId.set(baby.id, {
        id: baby.id,
        name: baby.name ?? null,
        fullName: baby.fullName ?? null,
      })
    }
  }

  return Array.from(byId.values())
}

async function pickBabyIdByNameLLM(params: {
  text: string
  candidates: BabyCandidate[]
}): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey || params.candidates.length === 0) {
    return null
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'Select the most likely baby from candidates based on user text. Return strict JSON only: {"babyId":"id-or-null","confidence":0-1}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            text: params.text,
            candidates: params.candidates.map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              fullName: candidate.fullName,
            })),
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const rawContent = data.choices?.[0]?.message?.content
  if (!rawContent) {
    return null
  }

  try {
    const jsonText = rawContent.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(jsonText) as { babyId?: string | null; confidence?: number }
    if (!parsed.babyId || typeof parsed.confidence !== 'number' || parsed.confidence < 0.55) {
      return null
    }

    const exists = params.candidates.some((candidate) => candidate.id === parsed.babyId)
    return exists ? parsed.babyId : null
  } catch {
    return null
  }
}

async function resolveSignedTokenTargetBabyId(params: {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  userId: string
  defaultBabyId: string
  requestedBabyId: string | null
  text: string
}): Promise<string> {
  if (params.requestedBabyId) {
    return params.requestedBabyId
  }

  const inputText = params.text.trim()
  if (!inputText) {
    return params.defaultBabyId
  }

  const candidates = await fetchUserBabyCandidates({
    payload: params.payload,
    userId: params.userId,
  })

  if (candidates.length <= 1) {
    return params.defaultBabyId
  }

  const llmSelectedId = await pickBabyIdByNameLLM({
    text: inputText,
    candidates,
  })
  if (llmSelectedId) {
    return llmSelectedId
  }

  return pickBabyIdByNameHeuristic(inputText, candidates) ?? params.defaultBabyId
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

      const signedTokenTargetBabyId = await resolveSignedTokenTargetBabyId({
        payload,
        userId: identity.userId,
        defaultBabyId: identity.babyId,
        requestedBabyId,
        text,
      })

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
