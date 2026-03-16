import { Pool } from 'pg'

let payloadPool: Pool | null = null

function getPayloadDatabaseURL(): string {
  return (
    process.env.PAYLOAD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  )
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
