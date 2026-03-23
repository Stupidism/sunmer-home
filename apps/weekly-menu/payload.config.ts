import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { CMSAdmins } from './src/payload/collections/CMSAdmins.ts'
import { DishPreferences } from './src/payload/collections/DishPreferences.ts'
import { Dishes } from './src/payload/collections/Dishes.ts'
import { MealDishes } from './src/payload/collections/MealDishes.ts'
import { MealSlots } from './src/payload/collections/MealSlots.ts'
import { PlannerUsers } from './src/payload/collections/PlannerUsers.ts'
import { UserMealTemplates } from './src/payload/collections/UserMealTemplates.ts'
import { WeeklyPlans } from './src/payload/collections/WeeklyPlans.ts'

const normalizePGSSLMode = (url: string) => {
  if (!url) return url
  if (url.includes('sslmode=require')) {
    return url.replace(/sslmode=require/g, 'sslmode=verify-full')
  }
  return url
}

const databaseURL = normalizePGSSLMode(
  process.env.PAYLOAD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
)

const allowSchemaPush =
  process.env.PAYLOAD_DB_PUSH === 'true' &&
  process.env.PAYLOAD_ALLOW_DESTRUCTIVE_PUSH === 'true'

const CMS_ADMINS_COLLECTION = 'cms-admins' as const

const config = buildConfig({
  secret:
    process.env.PAYLOAD_SECRET ||
    process.env.AUTH_SECRET ||
    'weekly-menu-payload-dev-secret-change-me',
  db: postgresAdapter({
    pool: { connectionString: databaseURL },
    push: allowSchemaPush,
  }),
  admin: {
    user: CMS_ADMINS_COLLECTION,
    importMap: { autoGenerate: false },
  },
  collections: [
    CMSAdmins,
    PlannerUsers,
    Dishes,
    UserMealTemplates,
    WeeklyPlans,
    MealSlots,
    MealDishes,
    DishPreferences,
  ],
})

export default config
