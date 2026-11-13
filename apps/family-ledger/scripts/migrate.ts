import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const here = dirname(fileURLToPath(import.meta.url))
const schemaDirectory = join(here, '../src/server/db')
const version = '0003-classification-snapshots'

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required to run the explicit migration')
  const pool = new pg.Pool({ connectionString, max: 1, application_name: 'family-ledger-migration' })
  try {
    await pool.query('SELECT pg_advisory_lock(hashtext($1))', ['family_ledger:migrate'])
    await pool.query('BEGIN')
    const schema = await readFile(join(schemaDirectory, 'schema.sql'), 'utf8')
    const tracking = await readFile(join(schemaDirectory, 'migration-tracking.sql'), 'utf8')
    await pool.query(schema)
    await pool.query(tracking)
    await pool.query(schema)
    const applied = await pool.query<{ version: string }>(
      'SELECT version FROM family_ledger.schema_migrations WHERE version = $1',
      [version],
    )
    if (applied.rowCount === 0) {
      const migration = await readFile(join(schemaDirectory, '0003-classification-snapshots.sql'), 'utf8')
      await pool.query(migration)
      await pool.query(
        'INSERT INTO family_ledger.schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [version],
      )
    }
    await pool.query('COMMIT')
    console.log(`family_ledger schema is up to date (${version})`)
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await pool.query('SELECT pg_advisory_unlock(hashtext($1))', ['family_ledger:migrate']).catch(() => undefined)
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'migration failed')
  process.exitCode = 1
})
