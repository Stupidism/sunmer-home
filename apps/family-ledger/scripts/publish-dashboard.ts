import { getPool } from '../src/server/db/pool'
import { refreshPublishedSnapshot } from '../src/server/repository'

const actorIndex = process.argv.indexOf('--actor')
const actor = actorIndex >= 0 ? process.argv[actorIndex + 1] : undefined
if (!actor || actor.length > 100) throw new Error('usage: pnpm publish-dashboard -- --actor <audit-name>')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
refreshPublishedSnapshot(actor)
  .then((snapshot) => console.log(JSON.stringify({ snapshotVersion: snapshot.snapshotVersion, publishedAt: snapshot.publishedAt, records: snapshot.overview.transactionCount })))
  .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'dashboard publish failed'); process.exitCode=1 })
  .finally(() => getPool().end())
