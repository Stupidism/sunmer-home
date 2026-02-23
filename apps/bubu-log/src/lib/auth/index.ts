import crypto from 'node:crypto'
import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import WeChat from './wechat-provider'
import { assertAuthEnv } from './config'
import { getPayloadClient } from '@/lib/payload/client'

type AppUserLike = {
  id: string
  username: string
  password?: string | null
  name?: string | null
  email?: string | null
  image?: string | null
}

function normalizeUsername(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')

  if (cleaned.length >= 3) {
    return cleaned.slice(0, 32)
  }

  return `user-${cleaned || crypto.randomUUID().slice(0, 6)}`.slice(0, 32)
}

async function ensureUniqueUsername(base: string): Promise<string> {
  const payload = await getPayloadClient()
  const normalizedBase = normalizeUsername(base)

  let candidate = normalizedBase
  let counter = 1

  while (counter <= 1000) {
    const existing = await payload.find({
      collection: 'app-users',
      where: {
        username: {
          equals: candidate,
        },
      },
      limit: 1,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.totalDocs === 0) {
      return candidate
    }

    counter += 1
    const suffix = `-${counter}`
    candidate = `${normalizedBase.slice(0, Math.max(3, 32 - suffix.length))}${suffix}`
  }

  return `user-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
}

async function findUserByLogin(login: string): Promise<AppUserLike | null> {
  const payload = await getPayloadClient()
  const loginName = login.trim()
  const loginEmail = login.trim().toLowerCase()

  const result = await payload.find({
    collection: 'app-users',
    where: {
      or: [
        {
          username: {
            equals: loginName,
          },
        },
        {
          email: {
            equals: loginEmail,
          },
        },
      ],
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  if (result.totalDocs === 0) {
    return null
  }

  return result.docs[0] as AppUserLike
}

async function findOrCreateOAuthAppUser(user: {
  email?: string | null
  name?: string | null
  image?: string | null
}): Promise<AppUserLike> {
  if (!user.email) {
    throw new Error('OAuth user email is required')
  }

  const payload = await getPayloadClient()
  const normalizedEmail = user.email.toLowerCase()

  const existing = await payload.find({
    collection: 'app-users',
    where: {
      email: {
        equals: normalizedEmail,
      },
    },
    limit: 1,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    const current = existing.docs[0] as AppUserLike

    const shouldUpdate =
      (user.name && user.name !== current.name) ||
      (user.image && user.image !== current.image)

    if (shouldUpdate) {
      const updated = await payload.update({
        collection: 'app-users',
        id: current.id,
        data: {
          ...(user.name ? { name: user.name } : {}),
          ...(user.image ? { image: user.image } : {}),
        },
        depth: 0,
        overrideAccess: true,
      })

      return updated as AppUserLike
    }

    return current
  }

  const usernameBase = user.email.split('@')[0] || `user-${crypto.randomUUID().slice(0, 8)}`
  const username = await ensureUniqueUsername(usernameBase)

  const created = await payload.create({
    collection: 'app-users',
    data: {
      username,
      email: normalizedEmail,
      name: user.name || username,
      image: user.image || null,
      password: `${crypto.randomUUID()}Aa1!`,
      role: 'OTHER',
    },
    depth: 0,
    overrideAccess: true,
  })

  return created as AppUserLike
}

const providers: Provider[] = [
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

      const user = await findUserByLogin(credentials.username as string)
      if (!user?.password) {
        return null
      }

      const isValid = await bcrypt.compare(credentials.password as string, user.password)
      if (!isValid) {
        return null
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      }
    },
  }),
]

assertAuthEnv()

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    })
  )
}

if (process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET) {
  providers.push(
    WeChat({
      clientId: process.env.WECHAT_APP_ID,
      clientSecret: process.env.WECHAT_APP_SECRET,
      platformType:
        process.env.WECHAT_PLATFORM_TYPE === 'OfficialAccount' ? 'OfficialAccount' : 'WebsiteApp',
    })
  )
}

const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== 'production' ? 'bubu-log-dev-auth-secret' : undefined)

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  secret: authSecret,
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  session: {
    strategy: 'jwt',
    maxAge: 100 * 365 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider === 'credentials') {
        return true
      }

      try {
        const appUser = await findOrCreateOAuthAppUser({
          email: user.email,
          name: user.name,
          image: user.image,
        })

        ;(user as { id?: string }).id = appUser.id
        user.name = appUser.name || user.name
        user.email = appUser.email || user.email
        user.image = appUser.image || user.image

        return true
      } catch (error) {
        console.error('OAuth sign-in bootstrap failed:', error)
        return false
      }
    },
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === 'credentials') {
          token.id = (user as { id?: string }).id
        } else {
          token.id = (user as { id?: string }).id || token.id
        }
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
