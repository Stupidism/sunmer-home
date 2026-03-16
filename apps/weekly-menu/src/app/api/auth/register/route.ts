import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { ensurePlannerUsersTable, getPayloadPool } from '@/lib/payload-db'

type RegisterBody = {
  username?: unknown
  password?: unknown
  name?: unknown
  userId?: unknown
}

const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
      message,
    },
    { status }
  )
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody

    const username = normalizeText(body.username)
    const password = normalizeText(body.password)
    const name = normalizeText(body.name)
    const userId = normalizeText(body.userId)

    if (!username || username.length < 3 || username.length > 32 || !USERNAME_REGEX.test(username)) {
      return errorResponse(422, 'INVALID_USERNAME', '用户名长度需为 3-32，且仅支持字母数字._-')
    }

    if (!password || password.length < 8 || password.length > 72) {
      return errorResponse(422, 'INVALID_PASSWORD', '密码长度应在 8 到 72 位之间')
    }

    if (!name) {
      return errorResponse(422, 'INVALID_NAME', '姓名不能为空')
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    await ensurePlannerUsersTable()
    const pool = getPayloadPool()

    const insertResult = await pool.query<{
      id: string
      username: string
      role: string
    }>(
      `
      INSERT INTO planner_users (user_id, username, password, role, name, updated_at, created_at)
      VALUES ($1, $2, $3, 'USER', $4, now(), now())
      RETURNING id::text, username, role
      `,
      [userId || null, username, hashedPassword, name]
    )

    const created = insertResult.rows[0]

    return NextResponse.json(
      {
        data: {
          id: created.id,
          username: created.username,
          role: created.role,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const dbError = error as { code?: string; constraint?: string }

      if (dbError.code === '23505') {
        if (dbError.constraint?.includes('username')) {
          return errorResponse(409, 'USERNAME_EXISTS', '用户名已存在')
        }
        if (dbError.constraint?.includes('user_id')) {
          return errorResponse(409, 'USER_ID_EXISTS', '用户ID已存在')
        }
      }
    }

    return errorResponse(500, 'INTERNAL_ERROR', '注册失败，请稍后重试')
  }
}
