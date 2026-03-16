import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export class AuthError extends Error {
  code: 'UNAUTHORIZED' | 'FORBIDDEN'

  constructor(code: 'UNAUTHORIZED' | 'FORBIDDEN', message: string) {
    super(message)
    this.code = code
  }
}

export type SessionUser = {
  id: string
  role: 'ADMIN' | 'USER'
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth()
  const sessionUser = session?.user as { id?: string; role?: string } | undefined
  if (!sessionUser?.id) {
    return null
  }

  return {
    id: sessionUser.id,
    role: sessionUser.role === 'ADMIN' ? 'ADMIN' : 'USER',
  }
}

export async function requireLogin(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new AuthError('UNAUTHORIZED', '请先登录')
  }
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireLogin()
  if (user.role !== 'ADMIN') {
    throw new AuthError('FORBIDDEN', '仅管理员可执行此操作')
  }
  return user
}

export function authFailureResponse(error: unknown) {
  if (!(error instanceof AuthError)) {
    return null
  }

  const status = error.code === 'UNAUTHORIZED' ? 401 : 403
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
      },
      message: error.message,
    },
    { status }
  )
}
