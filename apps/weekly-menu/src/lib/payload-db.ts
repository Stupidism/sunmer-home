import { Pool } from 'pg'

let payloadPool: Pool | null = null
let plannerUsersEnsured = false

function normalizePGSSLMode(url: string): string {
  if (!url) {
    return url
  }

  if (url.includes('sslmode=require')) {
    return url.replace(/sslmode=require/g, 'sslmode=verify-full')
  }

  return url
}

function getPayloadDatabaseURL(): string {
  return normalizePGSSLMode(
    process.env.PAYLOAD_DATABASE_URL ||
      process.env.DATABASE_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      ''
  )
}

function getPayloadDatabaseSource(): 'PAYLOAD_DATABASE_URL' | 'DATABASE_URL' | 'DATABASE_URL_UNPOOLED' | 'MISSING' {
  if (process.env.PAYLOAD_DATABASE_URL) {
    return 'PAYLOAD_DATABASE_URL'
  }
  if (process.env.DATABASE_URL) {
    return 'DATABASE_URL'
  }
  if (process.env.DATABASE_URL_UNPOOLED) {
    return 'DATABASE_URL_UNPOOLED'
  }
  return 'MISSING'
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

export function getPayloadPool(): Pool {
  if (payloadPool) {
    return payloadPool
  }

  const connectionString = getPayloadDatabaseURL()
  if (!connectionString) {
    throw new Error('Missing payload database config')
  }

  payloadPool = new Pool({ connectionString })
  return payloadPool
}

export async function ensurePlannerUsersTable(): Promise<void> {
  if (plannerUsersEnsured) {
    return
  }

  const pool = getPayloadPool()

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planner_users (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT,
        username TEXT,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'USER',
        name TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await pool.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS user_id TEXT')
    await pool.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS username TEXT')
    await pool.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS password TEXT')
    await pool.query("ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER'")
    await pool.query("ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''")
    await pool.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    await pool.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')

    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS planner_users_username_unique ON planner_users (username) WHERE username IS NOT NULL'
    )
    await pool.query('CREATE INDEX IF NOT EXISTS planner_users_role_idx ON planner_users (role)')

    plannerUsersEnsured = true
  } catch (error) {
    const details = getErrorDetails(error)
    console.error('[weekly-menu][auth-diagnostic] ensure_planner_users_table_failed', {
      dbSource: getPayloadDatabaseSource(),
      errorCode: details.code,
      errorMessage: details.message,
    })
    throw error
  }
}
