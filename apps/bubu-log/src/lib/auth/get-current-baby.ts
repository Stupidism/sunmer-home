import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload/client'
import { toDate } from '@/lib/payload/utils'
import {
  BABY_ID_HEADER_KEY,
  BABY_ID_QUERY_KEY,
  normalizeBabyId,
} from '@/lib/baby-scope'

export type CurrentBaby = {
  id: string
  name: string
  fullName: string | null
  avatarUrl: string | null
  birthDate: Date | null
  gender: 'BOY' | 'GIRL' | 'OTHER' | null
  isDefault: boolean
}

export type CurrentUser = {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

export type AuthContext = {
  user: CurrentUser
  baby: CurrentBaby
  babies: CurrentBaby[]
}

type SessionUser = {
  id?: string
  name?: string | null
  email?: string | null
  image?: string | null
}

type BabyDoc = {
  id: string
  name?: string | null
  fullName?: string | null
  avatarUrl?: string | null
  birthDate?: string | Date | null
  gender?: 'BOY' | 'GIRL' | 'OTHER' | null
}

type BabyUserDoc = {
  id: string
  baby: string | BabyDoc
  isDefault?: boolean | null
}

export type AuthFailureCode =
  | 'UNAUTHORIZED'
  | 'NO_BABY_BINDING'
  | 'BABY_FORBIDDEN'
  | 'BABY_NOT_FOUND'

export class AuthFailure extends Error {
  readonly status: number
  readonly code: AuthFailureCode

  constructor(status: number, code: AuthFailureCode, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'AuthFailure'
  }
}

function getSessionUser(session: unknown): SessionUser | null {
  if (!session || typeof session !== 'object') {
    return null
  }

  const user = (session as { user?: SessionUser }).user
  if (!user || typeof user !== 'object') {
    return null
  }

  return user
}

function getRequestedBabyIdFromURL(url: URL): string | null {
  return normalizeBabyId(url.searchParams.get(BABY_ID_QUERY_KEY))
}

function requestToURL(request: NextRequest | Request): URL {
  if ('nextUrl' in request && request.nextUrl instanceof URL) {
    return request.nextUrl
  }

  return new URL(request.url)
}

export function getRequestedBabyId(request: NextRequest | Request): string | null {
  const queryValue = getRequestedBabyIdFromURL(requestToURL(request))

  if (queryValue) {
    return queryValue
  }

  return normalizeBabyId(request.headers.get(BABY_ID_HEADER_KEY))
}

function toCurrentBaby(doc: BabyDoc, isDefault: boolean): CurrentBaby | null {
  const id = normalizeBabyId(String(doc.id || ''))
  if (!id) {
    return null
  }

  return {
    id,
    name: String(doc.name || ''),
    fullName: doc.fullName ? String(doc.fullName) : null,
    avatarUrl: doc.avatarUrl ?? null,
    birthDate: toDate(doc.birthDate),
    gender: doc.gender ?? null,
    isDefault,
  }
}

async function resolveBabiesFromBindings(bindings: BabyUserDoc[]): Promise<CurrentBaby[]> {
  const payload = await getPayloadClient()
  const unresolvedIds = new Set<string>()

  for (const binding of bindings) {
    if (typeof binding.baby === 'string') {
      const normalized = normalizeBabyId(binding.baby)
      if (normalized) {
        unresolvedIds.add(normalized)
      }
    }
  }

  const unresolvedDocsById = new Map<string, BabyDoc>()
  if (unresolvedIds.size > 0) {
    const unresolvedResult = await payload.find({
      collection: 'babies',
      where: {
        id: {
          in: Array.from(unresolvedIds),
        },
      },
      limit: unresolvedIds.size,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    for (const doc of unresolvedResult.docs as BabyDoc[]) {
      const id = normalizeBabyId(String(doc.id || ''))
      if (id) {
        unresolvedDocsById.set(id, doc)
      }
    }
  }

  const seen = new Set<string>()
  const babies: CurrentBaby[] = []

  for (const binding of bindings) {
    const relation = binding.baby
    const source =
      typeof relation === 'object' && relation
        ? relation
        : unresolvedDocsById.get(String(relation))

    if (!source) {
      continue
    }

    const baby = toCurrentBaby(source, Boolean(binding.isDefault))
    if (!baby || seen.has(baby.id)) {
      continue
    }

    seen.add(baby.id)
    babies.push(baby)
  }

  return babies
}

type ResolveAuthResult =
  | { ok: true; context: AuthContext }
  | { ok: false; failure: AuthFailure }

async function resolveAuthContext(babyId: string | null | undefined): Promise<ResolveAuthResult> {
  let session
  try {
    session = await auth()
  } catch (error) {
    console.error('Session error:', error)
    return {
      ok: false,
      failure: new AuthFailure(401, 'UNAUTHORIZED', 'Unauthorized'),
    }
  }

  const user = getSessionUser(session)
  const userId = normalizeBabyId(user?.id)

  if (!userId) {
    return {
      ok: false,
      failure: new AuthFailure(401, 'UNAUTHORIZED', 'Unauthorized'),
    }
  }

  const payload = await getPayloadClient()
  const bindingResult = await payload.find({
    collection: 'baby-users',
    where: {
      user: {
        equals: userId,
      },
    },
    limit: 200,
    pagination: false,
    depth: 1,
    sort: '-isDefault,createdAt',
    overrideAccess: true,
  })

  const bindings = bindingResult.docs as BabyUserDoc[]
  if (bindings.length === 0) {
    return {
      ok: false,
      failure: new AuthFailure(403, 'NO_BABY_BINDING', 'No baby binding for current user'),
    }
  }

  const babies = await resolveBabiesFromBindings(bindings)
  if (babies.length === 0) {
    return {
      ok: false,
      failure: new AuthFailure(404, 'BABY_NOT_FOUND', 'Baby not found'),
    }
  }

  const requestedBabyId = normalizeBabyId(babyId)
  const scopedBaby = requestedBabyId
    ? babies.find((item) => item.id === requestedBabyId) || null
    : babies.find((item) => item.isDefault) || babies[0]

  if (!scopedBaby) {
    return {
      ok: false,
      failure: new AuthFailure(403, 'BABY_FORBIDDEN', 'Forbidden baby scope'),
    }
  }

  return {
    ok: true,
    context: {
      user: {
        id: userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
      },
      baby: scopedBaby,
      babies,
    },
  }
}

export async function getCurrentBaby(options?: {
  babyId?: string | null
}): Promise<AuthContext | null> {
  const result = await resolveAuthContext(options?.babyId)
  if (!result.ok) {
    return null
  }

  return result.context
}

export async function requireAuth(options?: {
  babyId?: string | null
}): Promise<AuthContext> {
  const result = await resolveAuthContext(options?.babyId)
  if (!result.ok) {
    throw result.failure
  }

  return result.context
}

export async function requireUser(): Promise<CurrentUser> {
  let session
  try {
    session = await auth()
  } catch (error) {
    console.error('Session error:', error)
    throw new AuthFailure(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  const user = getSessionUser(session)
  const userId = normalizeBabyId(user?.id)
  if (!userId) {
    throw new AuthFailure(401, 'UNAUTHORIZED', 'Unauthorized')
  }

  return {
    id: userId,
    name: user?.name ?? null,
    email: user?.email ?? null,
    image: user?.image ?? null,
  }
}

export function asAuthFailure(error: unknown): AuthFailure | null {
  if (error instanceof AuthFailure) {
    return error
  }

  return null
}

export function authFailureResponse(error: unknown): NextResponse | null {
  const failure = asAuthFailure(error)
  if (!failure) {
    return null
  }

  return NextResponse.json(
    {
      error: failure.message,
      code: failure.code,
    },
    { status: failure.status }
  )
}
