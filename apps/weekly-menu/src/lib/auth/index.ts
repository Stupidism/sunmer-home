import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import {
  ensurePlannerUsersTable,
  getPayloadDatabaseSource,
  getPayloadPool,
  getRuntimeEnv,
} from '@/lib/payload-db'

type PlannerUserDoc = {
  id: string
  username?: string | null
  password?: string | null
  role?: string | null
  name?: string | null
}

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/

function normalizeLoginHint(rawLogin: string): string {
  const input = rawLogin.trim()
  if (!input) {
    return 'empty'
  }
  if (input.length <= 2) {
    return `${input[0]}*`
  }
  return `${input.slice(0, 2)}***(${input.length})`
}

function getErrorDetails(error: unknown): { code?: string; message?: string } {
  if (!error || typeof error !== 'object') {
    return {}
  }

  const withCode = error as { code?: unknown; message?: unknown }

  return {
    code: typeof withCode.code === 'string' ? withCode.code : undefined,
    message: typeof withCode.message === 'string' ? withCode.message : undefined,
  }
}

function logInvalidCredentials(loginHint: string, reason: 'user_not_found' | 'password_mismatch', userId?: string): void {
  console.warn('[weekly-menu][auth-diagnostic] authorize_invalid_credentials', {
    event: 'authorize_invalid_credentials',
    env: getRuntimeEnv(),
    provider: 'credentials',
    loginHint,
    reason,
    userId,
  })
}

function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH_REGEX.test(value)
}

async function verifyAndUpgradePassword(
  user: PlannerUserDoc,
  rawPasswordInput: string,
  storedPassword: string
): Promise<boolean> {
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(rawPasswordInput, storedPassword)
  }

  if (rawPasswordInput !== storedPassword) {
    return false
  }

  const nextPasswordHash = await bcrypt.hash(rawPasswordInput, 12)
  const pool = getPayloadPool()
  try {
    await pool.query(
      `
      UPDATE planner_users
      SET password = $1, updated_at = now()
      WHERE id::text = $2
      `,
      [nextPasswordHash, user.id]
    )
  } catch (error) {
    const details = getErrorDetails(error)
    console.error('[weekly-menu][auth-diagnostic] legacy_password_upgrade_failed', {
      event: 'legacy_password_upgrade_failed',
      env: getRuntimeEnv(),
      userId: user.id,
      errorCode: details.code,
      errorMessage: details.message,
    })
  }

  return true
}

async function findUserByLogin(login: string): Promise<PlannerUserDoc | null> {
  await ensurePlannerUsersTable()
  const pool = getPayloadPool()
  const keyword = login.trim()

  const result = await pool.query<{
    id: string
    username: string | null
    password: string | null
    role: string | null
    name: string | null
  }>(
    `
    SELECT id::text, username, password, role, name
    FROM planner_users
    WHERE username = $1 OR user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [keyword]
  )

  if (result.rowCount === 0) {
    return null
  }

  return result.rows[0] as PlannerUserDoc
}

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.PAYLOAD_SECRET ||
  'weekly-menu-fallback-auth-secret-change-me'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        const loginHint = normalizeLoginHint(String(credentials?.username || ''))

        if (!credentials?.username || !credentials?.password) {
          return null
        }

        let user: PlannerUserDoc | null = null
        try {
          user = await findUserByLogin(String(credentials.username))
        } catch (error) {
          const details = getErrorDetails(error)
          console.error('[weekly-menu][auth-diagnostic] authorize_lookup_failed', {
            event: 'authorize_lookup_failed',
            env: getRuntimeEnv(),
            provider: 'credentials',
            loginHint,
            dbSource: getPayloadDatabaseSource(),
            errorCode: details.code,
            errorMessage: details.message,
          })
          throw error
        }

        if (!user?.password) {
          logInvalidCredentials(loginHint, 'user_not_found')
          return null
        }

        let isValid = false
        try {
          isValid = await verifyAndUpgradePassword(
            user,
            String(credentials.password),
            String(user.password)
          )
        } catch (error) {
          const details = getErrorDetails(error)
          console.error('[weekly-menu][auth-diagnostic] authorize_password_check_failed', {
            event: 'authorize_password_check_failed',
            env: getRuntimeEnv(),
            provider: 'credentials',
            userId: user.id,
            loginHint,
            errorCode: details.code,
            errorMessage: details.message,
          })
          throw error
        }

        if (!isValid) {
          logInvalidCredentials(loginHint, 'password_mismatch', user.id)
          return null
        }

        return {
          id: user.id,
          name: user.name || user.username || null,
          role: user.role || 'USER',
        }
      },
    }),
  ],
  secret: authSecret,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id
        token.role = (user as { role?: string }).role || 'USER'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string; role?: string }).id =
          typeof token.id === 'string' ? token.id : undefined
        ;(session.user as { id?: string; role?: string }).role =
          typeof token.role === 'string' ? token.role : 'USER'
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
