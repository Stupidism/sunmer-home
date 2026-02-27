import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { CMSAdmins } from './src/payload/collections/CMSAdmins.ts'
import { Articles } from './src/payload/collections/Articles.ts'
import { Beliefs } from './src/payload/collections/Beliefs.ts'
import { Templates } from './src/payload/collections/Templates.ts'
import { EmotionCategories } from './src/payload/collections/EmotionCategories.ts'
import { EmotionIntensities } from './src/payload/collections/EmotionIntensities.ts'
import { EmotionBranches } from './src/payload/collections/EmotionBranches.ts'
import { EmotionTools } from './src/payload/collections/EmotionTools.ts'
import { MindfulnessScenarios } from './src/payload/collections/MindfulnessScenarios.ts'
import { MindfulnessHabits } from './src/payload/collections/MindfulnessHabits.ts'
import { LifeEvents } from './src/payload/collections/LifeEvents.ts'
import { BeliefMethodMedia } from './src/payload/collections/BeliefMethodMedia.ts'
import { TemplateRecords } from './src/payload/collections/TemplateRecords.ts'

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
  collections: [
    CMSAdmins,
    Articles,
    Beliefs,
    Templates,
    EmotionCategories,
    EmotionIntensities,
    EmotionBranches,
    EmotionTools,
    MindfulnessScenarios,
    MindfulnessHabits,
    LifeEvents,
    BeliefMethodMedia,
    TemplateRecords,
  ],
})

export default config
