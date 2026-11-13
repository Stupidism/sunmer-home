import { createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import Credentials from 'next-auth/providers/credentials'
import NextAuth from 'next-auth'
import { withTransaction } from './db/pool'

interface DatabaseUser {
  id: string
  username: string
  password_hash: string
  role: 'admin' | 'viewer'
  active: boolean
}

interface ThrottleRow {
  throttle_key: string
  failed_attempts: number
  last_attempt_at: Date
  locked_until: Date | null
}

const FAILURE_WINDOW_MS = 15 * 60 * 1000
const LOCK_DURATION_MS = 15 * 60 * 1000
const MAX_FAILURES = 5

async function authorizeCredentials(
  credentials: Partial<Record<string, unknown>>,
  _request?: Request,
): Promise<{ id: string; name: string; role: 'admin' | 'viewer' } | null> {
  const username = typeof credentials.username === 'string' ? credentials.username.trim().toLowerCase() : ''
  const password = typeof credentials.password === 'string' ? credentials.password : ''
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) ||
      Buffer.byteLength(password, 'utf8') < 1 || Buffer.byteLength(password, 'utf8') > 72) return null
  const throttleKey = createHash('sha256')
    .update(username, 'utf8')
    .digest('hex')

  try {
    return await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO family_ledger.login_throttles (throttle_key, failed_attempts, last_attempt_at, locked_until)
         VALUES ($1, 0, $2, NULL)
         ON CONFLICT (throttle_key) DO NOTHING`,
        [throttleKey, new Date(0)],
      )
      const throttleResult = await client.query<ThrottleRow>(
        'SELECT throttle_key, failed_attempts, last_attempt_at, locked_until FROM family_ledger.login_throttles WHERE throttle_key = $1 FOR UPDATE',
        [throttleKey],
      )
      const now = Date.now()
      const throttle = throttleResult.rows[0]
      if (!throttle) throw new Error('login throttle row is missing')
      if (throttle?.locked_until && throttle.locked_until.getTime() > now) return null
      const expired = now - throttle.last_attempt_at.getTime() > FAILURE_WINDOW_MS
      const userResult = await client.query<DatabaseUser>(
        'SELECT id::text, username, password_hash, role, active FROM family_ledger.users WHERE username = $1 FOR UPDATE',
        [username],
      )
      const user = userResult.rows[0]
      const valid = user?.active === true && await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        const attempts = expired ? 1 : throttle.failed_attempts + 1
        const lockedUntil = attempts >= MAX_FAILURES ? new Date(now + LOCK_DURATION_MS) : null
        await client.query(
          `INSERT INTO family_ledger.login_throttles (throttle_key, failed_attempts, last_attempt_at, locked_until)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (throttle_key) DO UPDATE SET
             failed_attempts = EXCLUDED.failed_attempts,
             last_attempt_at = EXCLUDED.last_attempt_at,
             locked_until = EXCLUDED.locked_until`,
          [throttleKey, attempts, new Date(now), lockedUntil],
        )
        return null
      }
      await client.query('DELETE FROM family_ledger.login_throttles WHERE throttle_key = $1', [throttleKey])
      return { id: user.id, name: user.username, role: user.role }
    })
  } catch {
    // Never reveal whether the failure is an unknown user, bad password, lock, or database state.
    return null
  }
}

export const authSecretConfigured = Boolean(process.env.AUTH_SECRET)

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.role = (user as { role?: 'admin' | 'viewer' }).role ?? 'viewer'
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.uid === 'string' ? token.uid : ''
        ;(session.user as { role?: 'admin' | 'viewer' }).role =
          token.role === 'admin' ? 'admin' : 'viewer'
      }
      return session
    },
  },
})

export interface SessionUser {
  id: string
  username: string
  role: 'admin' | 'viewer'
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!authSecretConfigured) return null
  const session = await auth()
  if (!session?.user?.id) return null
  const sessionUserId = session.user.id
  try {
    return await withTransaction(async (client) => {
      const result = await client.query<Pick<DatabaseUser, 'id' | 'username' | 'role' | 'active'>>(
        'SELECT id::text, username, role, active FROM family_ledger.users WHERE id = $1',
        [sessionUserId],
      )
      const user = result.rows[0]
      if (!user?.active) return null
      return { id: user.id, username: user.username, role: user.role }
    })
  } catch {
    return null
  }
}
