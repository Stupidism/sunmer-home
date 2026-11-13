import pg from 'pg'
import { requiredDatabaseUrl } from '../config'

declare global {
  // eslint-disable-next-line no-var
  var familyLedgerPool: pg.Pool | undefined
}

export function getPool(): pg.Pool {
  globalThis.familyLedgerPool ??= new pg.Pool({
    connectionString: requiredDatabaseUrl(),
    max: 5,
    application_name: 'family-ledger',
  })
  return globalThis.familyLedgerPool
}

export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // The connection may already be unhealthy; preserve the original failure.
    }
    throw error
  } finally {
    client.release()
  }
}
