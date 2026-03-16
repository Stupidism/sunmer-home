import { Client } from 'pg'

function normalizePGSSLMode(url) {
  if (!url) {
    return url
  }

  if (url.includes('sslmode=require')) {
    return url.replace(/sslmode=require/g, 'sslmode=verify-full')
  }

  return url
}

function getDatabaseURL() {
  const raw =
    process.env.PAYLOAD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''

  return normalizePGSSLMode(raw)
}

async function main() {
  const connectionString = getDatabaseURL()
  if (!connectionString) {
    throw new Error('Missing database URL: set PAYLOAD_DATABASE_URL or DATABASE_URL')
  }

  const client = new Client({ connectionString })
  await client.connect()

  await client.query(`
    CREATE TABLE IF NOT EXISTS weekly_menus (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      menu_period TEXT NOT NULL DEFAULT '',
      menu_json JSONB NOT NULL
    )
  `)

  await client.query(`
    ALTER TABLE weekly_menus
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `)

  await client.query(`
    ALTER TABLE weekly_menus
    ADD COLUMN IF NOT EXISTS menu_period TEXT NOT NULL DEFAULT ''
  `)

  await client.query(`
    CREATE INDEX IF NOT EXISTS weekly_menus_user_id_created_at_idx
    ON weekly_menus (user_id, created_at DESC)
  `)

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_recipe_submissions (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      review_note TEXT,
      published_to_public BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await client.query(
    'CREATE INDEX IF NOT EXISTS user_recipe_submissions_user_id_idx ON user_recipe_submissions (user_id)'
  )
  await client.query(
    'CREATE INDEX IF NOT EXISTS user_recipe_submissions_status_idx ON user_recipe_submissions (status)'
  )
  await client.query(
    'CREATE INDEX IF NOT EXISTS user_recipe_submissions_user_id_created_at_idx ON user_recipe_submissions (user_id, created_at DESC)'
  )

  const plannerUsersExists = await client.query(
    "SELECT to_regclass('public.planner_users') AS table_name"
  )

  if (plannerUsersExists.rows[0]?.table_name) {
    await client.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS username TEXT')
    await client.query('ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS password TEXT')
    await client.query("ALTER TABLE planner_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER'")
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS planner_users_username_unique ON planner_users (username) WHERE username IS NOT NULL'
    )
    await client.query('CREATE INDEX IF NOT EXISTS planner_users_role_idx ON planner_users (role)')
    await client.query('ALTER TABLE planner_users ALTER COLUMN user_id DROP NOT NULL')
  }

  await client.end()
  console.log('DB bootstrap complete')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
