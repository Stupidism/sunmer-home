import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { CMSAdmins } from './src/payload/collections/CMSAdmins.ts'
import { Articles } from './src/payload/collections/Articles.ts'

const normalizePGSSLMode = (url: string) => {
  if (!url) return url
  if (url.includes('sslmode=require')) {
    return url.replace(/sslmode=require/g, 'sslmode=verify-full')
  }
  return url
}

const databaseURL =
  normalizePGSSLMode(
    process.env.PAYLOAD_DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
  )

const allowSchemaPush =
  process.env.PAYLOAD_DB_PUSH === 'true' &&
  process.env.PAYLOAD_ALLOW_DESTRUCTIVE_PUSH === 'true'

const config = buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'nunu-island-payload-dev-secret-change-me',
  db: postgresAdapter({
    pool: {
      connectionString: databaseURL,
    },
    push: allowSchemaPush,
  }),
  admin: {
    user: 'cms-admins',
    importMap: {
      autoGenerate: false,
    },
  },
  collections: [CMSAdmins, Articles],
})

export default config
