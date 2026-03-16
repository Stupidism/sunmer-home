import { getPayloadPool } from '@/lib/payload-db'

export type UserRecipeCategory = 'big-meat' | 'small-meat' | 'vegetable'
export type UserRecipeStatus = 'pending' | 'approved' | 'rejected'

export type UserRecipeRecord = {
  id: string
  userId: string
  name: string
  category: UserRecipeCategory
  description: string | null
  status: UserRecipeStatus
  reviewNote: string | null
  publishedToPublic: boolean
  createdAt: string
  updatedAt: string
}

const VALID_CATEGORIES: readonly UserRecipeCategory[] = ['big-meat', 'small-meat', 'vegetable']

export function isValidUserRecipeCategory(value: string): value is UserRecipeCategory {
  return VALID_CATEGORIES.includes(value as UserRecipeCategory)
}

export async function ensureUserRecipeSubmissionsTable(): Promise<void> {
  const pool = getPayloadPool()

  await pool.query(`
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

  await pool.query(
    `CREATE INDEX IF NOT EXISTS user_recipe_submissions_user_id_idx ON user_recipe_submissions (user_id)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS user_recipe_submissions_status_idx ON user_recipe_submissions (status)`
  )
  await pool.query(
    `CREATE INDEX IF NOT EXISTS user_recipe_submissions_user_id_created_at_idx ON user_recipe_submissions (user_id, created_at DESC)`
  )
}

export async function createUserRecipeSubmission(input: {
  userId: string
  name: string
  category: UserRecipeCategory
  description: string | null
}): Promise<UserRecipeRecord> {
  await ensureUserRecipeSubmissionsTable()
  const pool = getPayloadPool()

  const result = await pool.query<{
    id: string
    user_id: string
    name: string
    category: UserRecipeCategory
    description: string | null
    status: UserRecipeStatus
    review_note: string | null
    published_to_public: boolean
    created_at: string
    updated_at: string
  }>(
    `
    INSERT INTO user_recipe_submissions
      (user_id, name, category, description, status, published_to_public, updated_at, created_at)
    VALUES
      ($1, $2, $3, $4, 'pending', FALSE, NOW(), NOW())
    RETURNING
      id::text,
      user_id,
      name,
      category,
      description,
      status,
      review_note,
      published_to_public,
      created_at,
      updated_at
    `,
    [input.userId, input.name, input.category, input.description]
  )

  const row = result.rows[0]

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    description: row.description,
    status: row.status,
    reviewNote: row.review_note,
    publishedToPublic: row.published_to_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listUserRecipeSubmissions(input: {
  userId: string
  includeStatuses?: UserRecipeStatus[]
}): Promise<UserRecipeRecord[]> {
  await ensureUserRecipeSubmissionsTable()
  const pool = getPayloadPool()

  const values: string[] = [input.userId]
  let whereSql = 'WHERE user_id = $1'

  if (input.includeStatuses && input.includeStatuses.length > 0) {
    const placeholders = input.includeStatuses.map((_, index) => `$${index + 2}`)
    whereSql += ` AND status IN (${placeholders.join(', ')})`
    values.push(...input.includeStatuses)
  }

  const result = await pool.query<{
    id: string
    user_id: string
    name: string
    category: UserRecipeCategory
    description: string | null
    status: UserRecipeStatus
    review_note: string | null
    published_to_public: boolean
    created_at: string
    updated_at: string
  }>(
    `
    SELECT
      id::text,
      user_id,
      name,
      category,
      description,
      status,
      review_note,
      published_to_public,
      created_at,
      updated_at
    FROM user_recipe_submissions
    ${whereSql}
    ORDER BY created_at DESC
    `,
    values
  )

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    category: row.category,
    description: row.description,
    status: row.status,
    reviewNote: row.review_note,
    publishedToPublic: row.published_to_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function existsDuplicateRecipeName(input: {
  userId: string
  name: string
}): Promise<boolean> {
  await ensureUserRecipeSubmissionsTable()
  const pool = getPayloadPool()

  const normalizedName = input.name.trim().toLowerCase()
  if (!normalizedName) {
    return false
  }

  const publicMatch = await pool.query<{ id: string }>(
    'SELECT id::text FROM planner_recipes WHERE LOWER(TRIM(name)) = $1 LIMIT 1',
    [normalizedName]
  )

  if ((publicMatch.rowCount ?? 0) > 0) {
    return true
  }

  const selfMatch = await pool.query<{ id: string }>(
    `
    SELECT id::text
    FROM user_recipe_submissions
    WHERE user_id = $1
      AND status IN ('pending', 'approved')
      AND LOWER(TRIM(name)) = $2
    LIMIT 1
    `,
    [input.userId, normalizedName]
  )

  return (selfMatch.rowCount ?? 0) > 0
}
