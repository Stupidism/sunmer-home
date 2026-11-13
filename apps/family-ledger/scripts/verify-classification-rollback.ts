import assert from 'node:assert/strict'
import pg from 'pg'
import type { ClassificationScheme, LedgerScope, PublishedDashboardSnapshot } from '../src/lib/domain/types'
import {
  assignTransactionClassification,
  bulkMapSourceLabel,
  createCategory,
  mergeCategories,
  previewBulkMap,
  previewMerge,
  previewRename,
  previewSplit,
  previewTransactionAssignment,
  renameCategory,
  splitCategory,
  type ClassificationPreview,
} from '../src/server/classification-management'
import { readPublishedSnapshot } from '../src/server/repository'

const ACTOR = 'TEST classification rollback verifier'
const PREFIX = `TEST-${Date.now()}-${process.pid}`

type TransactionIdentity = {
  stable_id: string
  original_id: string
  transaction_date: string
  cents: string
  currency: string
  raw_sha256: string
}

type Publication = {
  snapshot_version: number
  document: PublishedDashboardSnapshot
  published_at: string
  published_by: string
}

type Candidate = {
  stable_id: string
  scope: LedgerScope
  source_label: string
  cents: string
  currency: string
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function financialFingerprint(snapshot: PublishedDashboardSnapshot): string {
  const records = snapshot.payload.months.flatMap((month) => [
    ...month.household.records,
    ...month.company.records,
    ...month.agency.records,
    ...month.funding.records,
    ...month.foreign,
    ...month.income.records,
    ...month.income.pendingRecords,
    ...month.income.excludedRecords,
    ...month.income.foreignRecords,
  ]).map((row) => ({
    id: row.id,
    date: row.date,
    cents: row.cents,
    currency: row.currency,
    scope: row.scope,
    sourceSha256: row.source.sha256,
  })).sort((left, right) => left.id.localeCompare(right.id))
  return canonical({ overview: snapshot.overview, refunds: snapshot.refunds, records })
}

function effectiveCategory(snapshot: PublishedDashboardSnapshot, transactionId: string, scheme: ClassificationScheme): string | null {
  for (const month of snapshot.payload.months) {
    const records = [
      ...month.household.records, ...month.company.records, ...month.agency.records,
      ...month.funding.records, ...month.foreign, ...month.income.records,
      ...month.income.pendingRecords, ...month.income.excludedRecords,
    ]
    const record = records.find((item) => item.id === transactionId)
    if (record) return record.classifications[scheme]?.categoryId ?? null
  }
  throw new Error(`selected transaction ${transactionId} is absent from the published snapshot`)
}

function affectedCount(preview: ClassificationPreview): number {
  return preview.affected.reduce((total, item) => total + item.count, 0)
}

async function rejects(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(action, pattern)
}

async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.argv[2] !== '--rollback-only') {
    throw new Error('refusing to run: the sole required argument is --rollback-only')
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('refusing to run: DATABASE_URL is required')

  const realPool = new pg.Pool({ connectionString: databaseUrl, max: 1, application_name: 'family-ledger-rollback-verifier' })
  const realClient = await realPool.connect()
  const originalGlobalPool = globalThis.familyLedgerPool
  let outerOpen = false
  let rollbackPromise: Promise<void> | undefined
  let interrupted = false
  let savepoint = 0
  const savepoints: string[] = []
  const passed: string[] = []
  let adapterTail: Promise<void> = Promise.resolve()

  const sequential = <T>(action: () => Promise<T>): Promise<T> => {
    const result = adapterTail.then(action, action)
    adapterTail = result.then(() => undefined, () => undefined)
    return result
  }

  const rollbackOuter = (): Promise<void> => {
    rollbackPromise ??= (async () => {
      if (!outerOpen) return
      outerOpen = false
      await realClient.query('ROLLBACK')
    })()
    return rollbackPromise
  }
  const onSignal = (): void => {
    interrupted = true
    void rollbackOuter().catch(() => undefined)
  }
  process.once('SIGINT', onSignal)
  process.once('SIGTERM', onSignal)

  let baselineIdentities = ''
  let baselinePublication = ''
  let prefixCounts = ''
  let verificationError: unknown
  try {
    await realClient.query('BEGIN')
    outerOpen = true

    const identityRows = await realClient.query<TransactionIdentity>(
      `SELECT stable_id, original_id, to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date,
              cents::text, currency, raw_sha256
       FROM family_ledger.transactions ORDER BY stable_id`,
    )
    baselineIdentities = canonical(identityRows.rows)
    const publication = await realClient.query<Publication>(
      `SELECT snapshot_version, document, published_at::text, published_by
       FROM family_ledger.dashboard_snapshots WHERE name='published'`,
    )
    assert.equal(publication.rowCount, 1, 'a published snapshot is required')
    baselinePublication = canonical(publication.rows[0])
    const baselineSnapshot = publication.rows[0]!.document
    const baselineFinancial = financialFingerprint(baselineSnapshot)
    const beforePrefix = await realClient.query<{ categories: string; audits: string; rules: string; overrides: string }>(
      `SELECT
         (SELECT count(*)::text FROM family_ledger.categories WHERE main_label LIKE $1 OR sub_label LIKE $1) categories,
         (SELECT count(*)::text FROM family_ledger.category_audit WHERE actor=$2) audits,
         (SELECT count(*)::text FROM family_ledger.category_rules WHERE evidence->>'verification'=$3) rules,
         (SELECT count(*)::text FROM family_ledger.transaction_classifications WHERE evidence->>'verification'=$3) overrides`,
      [`${PREFIX}%`, ACTOR, PREFIX],
    )
    prefixCounts = canonical(beforePrefix.rows[0])

    const adapterClient = {
      query: (...args: Parameters<pg.PoolClient['query']>) => sequential(async () => {
        const query = args[0] as string | { text: string }
        const text = typeof query === 'string' ? query : query.text
        const command = text.trim().replace(/;$/, '').trim().toUpperCase()
        if (/^(BEGIN|START\s+TRANSACTION)$/.test(command)) {
          assert.equal(savepoints.length, 0, 'nested service calls must execute sequentially')
          const name = `classification_verify_${++savepoint}`
          savepoints.push(name)
          return realClient.query(`SAVEPOINT ${name}`)
        }
        if (command === 'COMMIT') {
          const name = savepoints.pop()
          if (!name) throw new Error('service attempted to commit without an active savepoint')
          return realClient.query(`RELEASE SAVEPOINT ${name}`)
        }
        if (command === 'ROLLBACK') {
          const name = savepoints.pop()
          if (!name) throw new Error('service attempted to roll back without an active savepoint')
          await realClient.query(`ROLLBACK TO SAVEPOINT ${name}`)
          return realClient.query(`RELEASE SAVEPOINT ${name}`)
        }
        if (/^(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE\s+TRANSACTION)\b/.test(command)) {
          throw new Error('service issued transaction control outside the verifier protocol')
        }
        return realClient.query(...args)
      }),
      release: () => undefined,
    } as unknown as pg.PoolClient
    const adapterPool = {
      query: (...args: Parameters<pg.PoolClient['query']>) => adapterClient.query(...args),
      connect: async () => adapterClient,
    } as unknown as pg.Pool
    globalThis.familyLedgerPool = adapterPool

    let previousSnapshot = canonical(baselineSnapshot)
    const verifySnapshot = async (name: string, check?: (snapshot: PublishedDashboardSnapshot) => void): Promise<PublishedDashboardSnapshot> => {
      if (interrupted) throw new Error('verification interrupted')
      assert.equal(savepoints.length, 0, 'service transaction leaked a savepoint')
      const snapshot = await readPublishedSnapshot()
      assert.equal(financialFingerprint(snapshot), baselineFinancial, 'financial totals, rows, or refunds changed')
      assert.notEqual(canonical(snapshot), previousSnapshot, 'service mutation did not update the published snapshot')
      previousSnapshot = canonical(snapshot)
      const publisher = await realClient.query<{ published_by: string }>("SELECT published_by FROM family_ledger.dashboard_snapshots WHERE name='published'")
      assert.equal(publisher.rows[0]?.published_by, ACTOR)
      check?.(snapshot)
      passed.push(name)
      return snapshot
    }

    const candidates = await realClient.query<Candidate>(
      `SELECT t.stable_id, t.scope, COALESCE(t.raw->>'category','未分类') AS source_label,
              t.cents::text, t.currency
       FROM family_ledger.transactions t
       LEFT JOIN family_ledger.transaction_classifications a
         ON a.transaction_id=t.stable_id AND a.scheme='GB'
       JOIN (
         SELECT scope, COALESCE(raw->>'category','未分类') AS source_label
         FROM family_ledger.transactions
         GROUP BY scope, COALESCE(raw->>'category','未分类')
         HAVING count(*) >= 2
       ) grouped ON grouped.scope=t.scope AND grouped.source_label=COALESCE(t.raw->>'category','未分类')
       WHERE a.transaction_id IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM family_ledger.transaction_classifications existing
           JOIN family_ledger.transactions sibling ON sibling.stable_id=existing.transaction_id
           WHERE existing.scheme='GB' AND sibling.scope=t.scope
             AND COALESCE(sibling.raw->>'category','未分类')=COALESCE(t.raw->>'category','未分类')
         )
       ORDER BY t.scope, source_label, t.stable_id`,
    )
    const first = candidates.rows[0]
    if (!first) throw new Error('need at least two same source-label/scope records without GB assignments')
    const selected = candidates.rows.filter((row) => row.scope === first.scope && row.source_label === first.source_label)
    if (selected.length < 2) throw new Error('need at least two same source-label/scope records')
    const [splitRow, assignRow] = selected as [Candidate, Candidate, ...Candidate[]]

    const scheme: ClassificationScheme = 'GB'
    const source = await createCategory({ scheme, id: `gb:test-${Date.now()}-source`, mainLabel: `${PREFIX}-source`, subLabel: 'source' }, ACTOR)
    await verifySnapshot('create source category', (snapshot) => assert(snapshot.taxonomy.categories.some((item) => item.id === source.id)))
    const destination = await createCategory({ scheme, id: `gb:test-${Date.now()}-destination`, mainLabel: `${PREFIX}-destination`, subLabel: 'destination' }, ACTOR)
    await verifySnapshot('create destination category', (snapshot) => assert(snapshot.taxonomy.categories.some((item) => item.id === destination.id)))
    const third = await createCategory({ scheme, id: `gb:test-${Date.now()}-third`, mainLabel: `${PREFIX}-third`, subLabel: 'third' }, ACTOR)
    await verifySnapshot('create third category')
    const foreign = await createCategory({ scheme: 'QS', id: `qs:test-${Date.now()}-foreign`, mainLabel: `${PREFIX}-foreign`, subLabel: 'foreign' }, ACTOR)
    await verifySnapshot('create foreign-scheme category')

    await rejects(() => createCategory({ scheme, mainLabel: source.mainLabel, subLabel: source.subLabel }, ACTOR), /duplicate|unique/i)
    passed.push('reject duplicate category path')
    const foreignRevision = await realClient.query<{ revision: string }>("SELECT revision::text FROM family_ledger.classification_schemes WHERE code='GB'")
    await rejects(() => previewBulkMap({ scheme, scope: first.scope, sourceLabel: first.source_label, destinationCategoryId: foreign.id, expectedRevision: Number(foreignRevision.rows[0]!.revision) }), /different scheme/i)
    passed.push('reject foreign-scheme target')

    const renameDestination = await previewRename({ categoryId: destination.id, expectedRevision: destination.revision })
    const renamedDestination = await renameCategory(renameDestination, { mainLabel: `${PREFIX}-destination-renamed`, subLabel: 'renamed' }, ACTOR)
    await verifySnapshot('rename destination category', (snapshot) => {
      const category = snapshot.taxonomy.categories.find((item) => item.id === destination.id)
      assert.equal(category?.mainLabel, renamedDestination.mainLabel)
    })

    const revision1 = await realClient.query<{ revision: string }>("SELECT revision::text FROM family_ledger.classification_schemes WHERE code='GB'")
    const initialMap = await previewBulkMap({ scheme, scope: first.scope, sourceLabel: first.source_label, destinationCategoryId: source.id, expectedRevision: Number(revision1.rows[0]!.revision) })
    assert.equal(affectedCount(initialMap), selected.length)
    await bulkMapSourceLabel(initialMap, ACTOR, 'confirmed', { verification: PREFIX })
    await verifySnapshot('map source label to source category', (snapshot) => {
      for (const row of selected) assert.equal(effectiveCategory(snapshot, row.stable_id, scheme), source.id)
    })

    await rejects(() => previewSplit({ sourceCategoryId: source.id, destinationCategoryId: destination.id, scope: first.scope, transactionIds: ['TEST-invalid-transaction-id'], expectedRevision: source.revision }), /outside the source category|does not exist/i)
    passed.push('reject invalid split transaction')
    const currentSource1 = await realClient.query<{ revision: string }>('SELECT revision::text FROM family_ledger.categories WHERE id=$1', [source.id])
    const split = await previewSplit({ sourceCategoryId: source.id, destinationCategoryId: destination.id, scope: first.scope, transactionIds: [splitRow.stable_id], expectedRevision: Number(currentSource1.rows[0]!.revision) })
    assert.equal(affectedCount(split), 1)
    await splitCategory(split, ACTOR, { verification: PREFIX })
    await verifySnapshot('split exactly one transaction', (snapshot) => {
      assert.equal(effectiveCategory(snapshot, splitRow.stable_id, scheme), destination.id)
      for (const row of selected.slice(1)) assert.equal(effectiveCategory(snapshot, row.stable_id, scheme), source.id)
    })

    const revision2 = await realClient.query<{ revision: string }>("SELECT revision::text FROM family_ledger.classification_schemes WHERE code='GB'")
    const remap = await previewBulkMap({ scheme, scope: first.scope, sourceLabel: first.source_label, destinationCategoryId: third.id, expectedRevision: Number(revision2.rows[0]!.revision) })
    assert.equal(affectedCount(remap), selected.length - 1, 'mapping affected count must exclude the split override')
    await bulkMapSourceLabel(remap, ACTOR, 'confirmed', { verification: PREFIX })
    await verifySnapshot('remap excludes and preserves override', (snapshot) => {
      assert.equal(effectiveCategory(snapshot, splitRow.stable_id, scheme), destination.id)
      for (const row of selected.slice(1)) assert.equal(effectiveCategory(snapshot, row.stable_id, scheme), third.id)
    })

    const revision3 = await realClient.query<{ revision: string }>("SELECT revision::text FROM family_ledger.classification_schemes WHERE code='GB'")
    const assignment = await previewTransactionAssignment({ scheme, transactionId: assignRow.stable_id, destinationCategoryId: source.id, expectedRevision: Number(revision3.rows[0]!.revision) })
    await assignTransactionClassification(assignment, ACTOR, { verification: PREFIX })
    await verifySnapshot('assign transaction override', (snapshot) => assert.equal(effectiveCategory(snapshot, assignRow.stable_id, scheme), source.id))

    const sourceBeforeStale = await realClient.query<{ revision: string }>('SELECT revision::text FROM family_ledger.categories WHERE id=$1', [source.id])
    const staleSourceMerge = await previewMerge({ sourceCategoryId: source.id, destinationCategoryId: third.id, expectedRevision: Number(sourceBeforeStale.rows[0]!.revision) })
    const sourceRename = await previewRename({ categoryId: source.id, expectedRevision: Number(sourceBeforeStale.rows[0]!.revision) })
    await renameCategory(sourceRename, { mainLabel: `${PREFIX}-source-renamed`, subLabel: 'renamed' }, ACTOR)
    await verifySnapshot('rename merge source')
    await rejects(() => mergeCategories(staleSourceMerge, ACTOR), /stale|revision/i)
    passed.push('reject stale source preview')

    const sourceNow = await realClient.query<{ revision: string }>('SELECT revision::text FROM family_ledger.categories WHERE id=$1', [source.id])
    const staleTargetMerge = await previewMerge({ sourceCategoryId: source.id, destinationCategoryId: third.id, expectedRevision: Number(sourceNow.rows[0]!.revision) })
    const thirdNow = await realClient.query<{ revision: string }>('SELECT revision::text FROM family_ledger.categories WHERE id=$1', [third.id])
    const thirdRename = await previewRename({ categoryId: third.id, expectedRevision: Number(thirdNow.rows[0]!.revision) })
    await renameCategory(thirdRename, { mainLabel: `${PREFIX}-third-renamed`, subLabel: 'renamed' }, ACTOR)
    await verifySnapshot('rename merge destination')
    await rejects(() => mergeCategories(staleTargetMerge, ACTOR), /stale/i)
    passed.push('reject stale target preview')

    const sourceFinal = await realClient.query<{ revision: string }>('SELECT revision::text FROM family_ledger.categories WHERE id=$1', [source.id])
    const merge = await previewMerge({ sourceCategoryId: source.id, destinationCategoryId: third.id, expectedRevision: Number(sourceFinal.rows[0]!.revision) })
    await mergeCategories(merge, ACTOR)
    await verifySnapshot('merge source into renamed third category', (snapshot) => {
      assert.equal(effectiveCategory(snapshot, assignRow.stable_id, scheme), third.id)
      const merged = snapshot.taxonomy.categories.find((item) => item.id === source.id)
      assert.equal(merged?.state, 'merged')
      assert.equal(merged?.mergedIntoId, third.id)
    })
  } catch (error) {
    verificationError = error
  } finally {
    globalThis.familyLedgerPool = originalGlobalPool
    process.removeListener('SIGINT', onSignal)
    process.removeListener('SIGTERM', onSignal)
    try {
      await rollbackOuter()
    } finally {
      realClient.release()
    }
  }

  if (verificationError) {
    await realPool.end()
    throw verificationError
  }

  try {
    const identities = await realPool.query<TransactionIdentity>(
      `SELECT stable_id, original_id, to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date,
              cents::text, currency, raw_sha256
       FROM family_ledger.transactions ORDER BY stable_id`,
    )
    assert.equal(canonical(identities.rows), baselineIdentities, 'transaction identity/financial fingerprint changed after rollback')
    const publication = await realPool.query<Publication>(
      `SELECT snapshot_version, document, published_at::text, published_by
       FROM family_ledger.dashboard_snapshots WHERE name='published'`,
    )
    assert.equal(canonical(publication.rows[0]), baselinePublication, 'published snapshot was not exactly restored')
    const afterPrefix = await realPool.query<{ categories: string; audits: string; rules: string; overrides: string }>(
      `SELECT
         (SELECT count(*)::text FROM family_ledger.categories WHERE main_label LIKE $1 OR sub_label LIKE $1) categories,
         (SELECT count(*)::text FROM family_ledger.category_audit WHERE actor=$2) audits,
         (SELECT count(*)::text FROM family_ledger.category_rules WHERE evidence->>'verification'=$3) rules,
         (SELECT count(*)::text FROM family_ledger.transaction_classifications WHERE evidence->>'verification'=$3) overrides`,
      [`${PREFIX}%`, ACTOR, PREFIX],
    )
    assert.equal(canonical(afterPrefix.rows[0]), prefixCounts, 'test categories, audits, rules, or overrides persisted')
    passed.push('outer rollback restores database and publication')
  } finally {
    await realPool.end()
  }

  for (const name of passed) console.log(`PASS ${name}`)
  console.log(`PASS ${passed.length} cases`)
}

main().catch((error: unknown) => {
  process.exitCode = 1
  console.error(error instanceof Error ? error.message : 'classification rollback verification failed')
})
