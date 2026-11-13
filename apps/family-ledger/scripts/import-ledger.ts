import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { canonicalJson, diffLedgerImport, prepareLedgerImport, safeSourceLabel, sha256Json, type ExistingMonthRow, type ExistingTransactionRow } from '../src/lib/importer/core'
import type { Json, LedgerRecord, LedgerScope } from '../src/lib/domain/types'
import { getPool, withTransaction } from '../src/server/db/pool'

interface Arguments {
  file: string
  accountAliases?: string
  expectedTotals?: string
  dryRun: boolean
}

function parseArguments(argv: string[]): Arguments {
  let file: string | undefined
  let accountAliases: string | undefined
  let expectedTotals: string | undefined
  let dryRun = false
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--') continue
    if (value === '--file') file = argv[++index]
    else if (value === '--account-aliases') accountAliases = argv[++index]
    else if (value === '--expected-totals') expectedTotals = argv[++index]
    else if (value === '--dry-run') dryRun = true
    else throw new Error(`unknown argument: ${value}`)
  }
  if (!file) throw new Error('usage: pnpm --filter family-ledger import-ledger -- --file dashboard-months.json [--account-aliases account-aliases.json] [--dry-run --expected-totals totals.json]')
  if (expectedTotals && !dryRun) throw new Error('--expected-totals is only valid with --dry-run')
  return { file, accountAliases, expectedTotals, dryRun }
}

function parseJson<T extends Json>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${label} is not valid JSON`)
  }
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const payloadBytes = await readFile(args.file)
  const aliasBytes = args.accountAliases
    ? await readFile(args.accountAliases)
    : Buffer.from('{"accounts":[]}', 'utf8')
  const payload = parseJson<Json>(payloadBytes.toString('utf8'), 'ledger file')
  const aliases = parseJson<Json>(aliasBytes.toString('utf8'), 'account aliases file')
  const source = {
    label: safeSourceLabel(args.file),
    sha256: createHash('sha256').update(payloadBytes).digest('hex'),
    hashKind: 'dashboard-input' as const,
  }
  const aliasesSha256 = createHash('sha256').update(aliasBytes).digest('hex')
  const prepared = prepareLedgerImport(payload, aliases, source)
  const monthNames = prepared.months.map((month) => month.normalized.month)

  if (args.dryRun) {
    let comparison: 'pass' | 'not-requested' = 'not-requested'
    if (args.expectedTotals) {
      const expected = parseJson<Json>((await readFile(args.expectedTotals)).toString('utf8'), 'expected totals file')
      if (canonicalJson(expected) !== canonicalJson(preflightTotals(prepared, source.sha256))) {
        throw new Error('dry-run comparison failed')
      }
      comparison = 'pass'
    }
    console.log(JSON.stringify({ dryRun: true, months: monthNames.length, records: prepared.transactions.length, comparison }))
    return
  }

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const pool = getPool()
  try {

    const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['family_ledger:import'])
    const existingImport = await client.query<{ id: string }>(
      `SELECT id FROM family_ledger.imports
       WHERE source_label = $1 AND source_sha256 = $2 AND account_aliases_sha256 = $3`,
      [source.label, source.sha256, aliasesSha256],
    )
    if (existingImport.rowCount) {
      return {
        idempotent: true,
        insertedTransactions: 0,
        updatedTransactions: 0,
        removedTransactions: 0,
        upsertedMonths: 0,
      }
    }

    const existingMonthsResult = await client.query<{ month: string; report_meta: Record<string, Json> }>(
      'SELECT month, report_meta FROM family_ledger.months WHERE month = ANY($1::text[])',
      [monthNames],
    )
    const existingTransactionsResult = await client.query<{
      stable_id: string
      month: string
      scope: LedgerScope
      original_id: string
      account_key: string
      account_label: string
      raw_sha256: string
    }>(
      `SELECT stable_id, month, scope, original_id, account_key, account_label, raw_sha256
       FROM family_ledger.transactions
       WHERE month = ANY($1::text[])
       ORDER BY stable_id
       FOR UPDATE`,
      [monthNames],
    )
    const protectedResult = await client.query<{ transaction_id: string }>(
      `SELECT transaction_id FROM family_ledger.purpose_confirmations WHERE active
       UNION
       SELECT expense_transaction_id AS transaction_id FROM family_ledger.refund_links
       UNION
       SELECT refund_transaction_id AS transaction_id FROM family_ledger.refund_links`,
    )
    const existingMonths: ExistingMonthRow[] = existingMonthsResult.rows.map((row) => ({
      month: row.month,
      raw: row.report_meta,
      rawSha256: sha256Json(row.report_meta),
    }))
    const existingTransactions: ExistingTransactionRow[] = existingTransactionsResult.rows.map((row) => ({
      stableId: row.stable_id,
      month: row.month,
      scope: row.scope,
      originalId: row.original_id,
      accountKey: row.account_key,
      accountLabel: row.account_label,
      rawSha256: row.raw_sha256,
    }))
    const diff = diffLedgerImport(
      prepared,
      existingMonths,
      existingTransactions,
      protectedResult.rows.map((row) => row.transaction_id),
    )

    const insertedImport = await client.query<{ id: string }>(
      `INSERT INTO family_ledger.imports (
         source_label, source_sha256, account_aliases_sha256, payload, account_aliases
       ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       RETURNING id`,
      [source.label, source.sha256, aliasesSha256, JSON.stringify(payload), JSON.stringify(aliases)],
    )
    const importId = insertedImport.rows[0]?.id
    if (!importId) throw new Error('import registration failed')

    for (const month of prepared.months) {
      await client.query(
        `INSERT INTO family_ledger.months (
          month, import_id, report_status, report_meta, coverage, income_available, income_complete
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
        ON CONFLICT (month) DO UPDATE SET
          import_id = EXCLUDED.import_id,
          report_status = EXCLUDED.report_status,
          report_meta = EXCLUDED.report_meta,
          coverage = EXCLUDED.coverage,
          income_available = EXCLUDED.income_available,
          income_complete = EXCLUDED.income_complete`,
        [
          month.normalized.month,
          importId,
          month.normalized.status,
          JSON.stringify(month.raw),
          month.raw.coverage === undefined ? null : JSON.stringify(month.raw.coverage),
          month.normalized.income.available,
          month.normalized.income.complete,
        ],
      )
    }

    for (const transaction of prepared.transactions) {
      await client.query(
        `INSERT INTO family_ledger.transactions (
          stable_id, month, original_id, scope, transaction_date, cents, currency,
          account, account_key, account_label, raw, raw_sha256, import_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
        ON CONFLICT (month, scope, original_id) DO UPDATE SET
          stable_id = EXCLUDED.stable_id,
          transaction_date = EXCLUDED.transaction_date,
          cents = EXCLUDED.cents,
          currency = EXCLUDED.currency,
          account = EXCLUDED.account,
          account_key = EXCLUDED.account_key,
          account_label = EXCLUDED.account_label,
          raw = EXCLUDED.raw,
          raw_sha256 = EXCLUDED.raw_sha256,
          import_id = EXCLUDED.import_id,
          updated_at = now()`,
        [
          transaction.normalized.id,
          transaction.normalized.month,
          transaction.normalized.originalId,
          transaction.normalized.scope,
          transaction.normalized.date,
          transaction.normalized.cents,
          transaction.normalized.currency,
          transaction.normalized.account,
          transaction.normalized.accountKey,
          transaction.normalized.accountLabel,
          JSON.stringify(transaction.raw),
          transaction.rawSha256,
          importId,
        ],
      )
    }

    if (diff.removedTransactions) {
      const keptIds = prepared.transactions.map((transaction) => transaction.normalized.id)
      await client.query(
        'DELETE FROM family_ledger.transactions WHERE month = ANY($1::text[]) AND NOT (stable_id = ANY($2::text[]))',
        [monthNames, keptIds],
      )
    }

    return {
      idempotent: false,
      insertedTransactions: diff.insertedTransactions,
      updatedTransactions: diff.updatedTransactions,
      removedTransactions: diff.removedTransactions,
      upsertedMonths: diff.upsertedMonths,
    }
    })

    console.log(JSON.stringify({ months: monthNames.length, records: prepared.transactions.length, ...result }))
  } finally {
    await pool.end()
  }
}

function totalsByCurrency(records: readonly LedgerRecord[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const record of records) {
    const next = (totals[record.currency] ?? 0) + record.cents
    if (!Number.isSafeInteger(next)) throw new Error('preflight total exceeds the safe-integer range')
    totals[record.currency] = next
  }
  return totals
}

function preflightTotals(prepared: ReturnType<typeof prepareLedgerImport>, sourceSha256: string): Json {
  return {
    sha256: sourceSha256,
    months: prepared.payload.months.map((month) => ({
      month: month.month,
      scopes: {
        household: { count: month.household.records.length, totals: totalsByCurrency(month.household.records) },
        company: { count: month.company.records.length, totals: totalsByCurrency(month.company.records) },
        funding: { count: month.funding.records.length, totals: totalsByCurrency(month.funding.records) },
        income: { known_cny_cents: month.income.knownTotalCents, foreign_totals: month.income.foreignTotals },
      },
      mortgage_funding_cents: month.mortgage.excludedCents,
    })),
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'ledger import failed')
  process.exitCode = 1
})

export { getPool }
