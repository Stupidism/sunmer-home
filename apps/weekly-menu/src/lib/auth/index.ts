import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getPayloadPool } from '@/lib/payload-db'

type PlannerUserDoc = {
  id: string
  username?: string | null
  password?: string | null
  role?: string | null
  name?: string | null
}

async function findUserByLogin(login: string): Promise<PlannerUserDoc | null> {
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
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const user = await findUserByLogin(String(credentials.username))
        if (!user?.password) {
          return null
        }

        const isValid = await bcrypt.compare(String(credentials.password), user.password)
        if (!isValid) {
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
