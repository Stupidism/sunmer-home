import { Pool } from 'pg'

export type WeeklyPlan = Array<{
  day: string
  meals: Array<{
    label: string
    bigMeat: string
    smallMeat: string
    vegetable: string
  }>
}>

export type WeeklyMenuRecord = {
  id: string
  userId: string
  createdAt: string
  menuPeriod: string
  weeklyPlan: WeeklyPlan
}

export type WeeklyMenuUpdateInput = {
  menuPeriod?: string
  weeklyPlan?: WeeklyPlan
}

const connectionString =
  process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || ''

declare global {
  var mealPlannerPool: Pool | undefined
}

function getPool(): Pool {
  if (!connectionString) {
    throw new Error('Missing PostgreSQL config: set PAYLOAD_DATABASE_URL or DATABASE_URL')
  }

  const pool = global.mealPlannerPool ?? new Pool({ connectionString })
  if (process.env.NODE_ENV !== 'production') {
    global.mealPlannerPool = pool
  }

  return pool
}

async function ensureWeeklyMenusTable(): Promise<void> {
  const pool = getPool()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_menus (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      menu_period TEXT NOT NULL DEFAULT '',
      menu_json JSONB NOT NULL
    )
  `)

  await pool.query(`
    ALTER TABLE weekly_menus
    ADD COLUMN IF NOT EXISTS menu_period TEXT NOT NULL DEFAULT ''
  `)

  await pool.query(`
    ALTER TABLE weekly_menus
    ADD COLUMN IF NOT EXISTS user_id TEXT
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS weekly_menus_user_id_created_at_idx
    ON weekly_menus (user_id, created_at DESC)
  `)
}

export async function saveWeeklyMenu(
  userId: string,
  weeklyPlan: WeeklyPlan,
  menuPeriod: string
): Promise<WeeklyMenuRecord> {
  await ensureWeeklyMenusTable()
  const pool = getPool()

  const result = await pool.query<{
    id: string
    user_id: string
    created_at: string
    menu_period: string
    menu_json: WeeklyPlan
  }>(
    `
    INSERT INTO weekly_menus (user_id, menu_period, menu_json)
    VALUES ($1, $2, $3::jsonb)
    RETURNING id::text, user_id, created_at, menu_period, menu_json
    `,
    [userId, menuPeriod, JSON.stringify(weeklyPlan)]
  )

  const row = result.rows[0]
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    menuPeriod: row.menu_period,
    weeklyPlan: row.menu_json,
  }
}

export async function listWeeklyMenus(userId: string, limit = 20, offset = 0): Promise<WeeklyMenuRecord[]> {
  await ensureWeeklyMenusTable()
  const pool = getPool()

  const result = await pool.query<{
    id: string
    user_id: string
    created_at: string
    menu_period: string
    menu_json: WeeklyPlan
  }>(
    `
    SELECT id::text, user_id, created_at, menu_period, menu_json
    FROM weekly_menus
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    OFFSET $3
    `,
    [userId, limit, offset]
  )

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    menuPeriod: row.menu_period,
    weeklyPlan: row.menu_json,
  }))
}

export async function getWeeklyMenuById(userId: string, id: string): Promise<WeeklyMenuRecord | null> {
  await ensureWeeklyMenusTable()
  const pool = getPool()

  const result = await pool.query<{
    id: string
    user_id: string
    created_at: string
    menu_period: string
    menu_json: WeeklyPlan
  }>(
    `
    SELECT id::text, user_id, created_at, menu_period, menu_json
    FROM weekly_menus
    WHERE user_id = $1 AND id::text = $2
    LIMIT 1
    `,
    [userId, id]
  )

  const row = result.rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    menuPeriod: row.menu_period,
    weeklyPlan: row.menu_json,
  }
}

export async function updateWeeklyMenu(
  userId: string,
  id: string,
  updates: WeeklyMenuUpdateInput
): Promise<WeeklyMenuRecord | null> {
  await ensureWeeklyMenusTable()
  const pool = getPool()

  const sets: string[] = []
  const values: Array<string> = []

  if (typeof updates.menuPeriod === 'string') {
    sets.push(`menu_period = $${values.length + 1}`)
    values.push(updates.menuPeriod)
  }

  if (updates.weeklyPlan) {
    sets.push(`menu_json = $${values.length + 1}::jsonb`)
    values.push(JSON.stringify(updates.weeklyPlan))
  }

  if (sets.length === 0) {
    return getWeeklyMenuById(userId, id)
  }

  values.push(userId)
  values.push(id)

  const result = await pool.query<{
    id: string
    user_id: string
    created_at: string
    menu_period: string
    menu_json: WeeklyPlan
  }>(
    `
    UPDATE weekly_menus
    SET ${sets.join(', ')}
    WHERE user_id = $${values.length - 1} AND id::text = $${values.length}
    RETURNING id::text, user_id, created_at, menu_period, menu_json
    `,
    values
  )

  const row = result.rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    menuPeriod: row.menu_period,
    weeklyPlan: row.menu_json,
  }
}

export async function deleteWeeklyMenu(userId: string, id: string): Promise<boolean> {
  await ensureWeeklyMenusTable()
  const pool = getPool()

  const result = await pool.query<{ id: string }>(
    `
    DELETE FROM weekly_menus
    WHERE user_id = $1 AND id::text = $2
    RETURNING id::text
    `,
    [userId, id]
  )

  return (result.rowCount ?? 0) > 0
}
