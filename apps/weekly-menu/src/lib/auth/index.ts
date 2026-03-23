import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getPayloadClient } from '@/lib/payload/client'

type PlannerUser = {
  id: string
  username: string
  password?: string | null
  name?: string | null
  role?: string | null
}

async function findUserByUsername(username: string): Promise<PlannerUser | null> {
  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'planner-users',
    where: { username: { equals: username.trim() } },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  if (result.totalDocs === 0) return null
  const doc = result.docs[0]

  return {
    id: String(doc.id),
    username: String(doc.username),
    password: doc.password,
    name: doc.name,
    role: doc.role,
  }
}

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  process.env.PAYLOAD_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'weekly-menu-dev-auth-secret' : undefined)

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: '用户名', type: 'text' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await findUserByUsername(credentials.username as string)
        if (!user?.password) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        )
        if (!isValid) return null

        return {
          id: user.id,
          name: user.name || user.username,
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
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        ;(session.user as { id?: string }).id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
