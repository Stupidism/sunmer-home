import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { CMSAdmins } from './src/payload/collections/CMSAdmins'
import { PlannerRecipes } from './src/payload/collections/PlannerRecipes'
import { PlannerUsers } from './src/payload/collections/PlannerUsers'
import { UserRecipeSubmissions } from './src/payload/collections/UserRecipeSubmissions'

const normalizePGSSLMode = (url: string) => {
  if (!url) {
    return url
  }

  if (url.includes('sslmode=require')) {
    return url.replace(/sslmode=require/g, 'sslmode=verify-full')
  }

  return url
}

const databaseURL =
  normalizePGSSLMode(
    process.env.PAYLOAD_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres'
  )

const allowSchemaPush =
  process.env.PAYLOAD_DB_PUSH === 'true' &&
  process.env.PAYLOAD_ALLOW_DESTRUCTIVE_PUSH === 'true'

const config = buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'weekly-menu-payload-dev-secret-change-me',
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
  collections: [CMSAdmins, PlannerUsers, PlannerRecipes, UserRecipeSubmissions],
})

export default config
