import { createHash } from 'node:crypto'
import { createAccountResolver, parseAccountAliases, type AccountAliasDocument } from '../domain/account-aliases'
import { normalizeDashboardPayload, stableRecordId } from '../domain/monthly'
import type { DashboardPayload, Json, LedgerMonth, LedgerRecord, LedgerScope, SafeSource } from '../domain/types'

export interface PreparedLedgerImport {
  source: SafeSource
  payload: DashboardPayload
  aliases: AccountAliasDocument
  months: Array<{
    raw: Record<string, Json>
    normalized: LedgerMonth
    rawSha256: string
  }>
  transactions: Array<{
    raw: Record<string, Json>
    normalized: LedgerRecord
    rawSha256: string
  }>
}

export interface ExistingMonthRow {
  month: string
  raw: Record<string, Json>
  rawSha256: string
}

export interface ExistingTransactionRow {
  stableId: string
  month: string
  scope: LedgerScope
  originalId: string
  accountKey?: string
  accountLabel?: string
  rawSha256: string
}

export interface ImportDiff {
  unchangedTransactions: number
  insertedTransactions: number
  updatedTransactions: number
  removedTransactions: number
  unchangedMonths: number
  upsertedMonths: number
  protectedConflicts: string[]
  idempotent: boolean
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}

export function safeSourceLabel(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? ''
  if (!name || name === '.' || name === '..' || name.length > 180) {
    throw new Error('source label must be a valid file name')
  }
  return name.replace(/[\u0000-\u001f]/g, '_')
}

export function prepareLedgerImport(
  rawPayload: Json,
  rawAliases: Json,
  source: SafeSource,
): PreparedLedgerImport {
  if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('source SHA-256 is invalid')
  if (!source.label || source.label.includes('/') || source.label.includes('\\')) {
    throw new Error('source label must not contain a path')
  }
  const aliases = parseAccountAliases(rawAliases)
  const payload = normalizeDashboardPayload(rawPayload, {
    source,
    resolver: createAccountResolver(aliases),
  })
  const rawRoot = rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
    ? rawPayload as Record<string, Json>
    : null
  if (!rawRoot) throw new Error('dashboard payload must be an object')
  const rawMonths = Array.isArray(rawRoot.months) ? rawRoot.months : []
  const normalizedByMonth = new Map(payload.months.map((month) => [month.month, month]))
  const months = rawMonths.map((rawMonth) => {
    if (!rawMonth || typeof rawMonth !== 'object' || Array.isArray(rawMonth)) throw new Error('months[] must be objects')
    const value = rawMonth as Record<string, Json>
    const normalized = normalizedByMonth.get(String(value.month))
    if (!normalized) throw new Error('normalized month is missing')
    return { raw: value, normalized, rawSha256: sha256Json(value) }
  })
  const transactions = payload.months
    .flatMap((month) => [
      ...month.household.records,
      ...month.company.records,
      ...month.agency.records,
      ...month.funding.records,
      ...month.foreign,
      ...month.income.records,
      ...month.income.pendingRecords,
      ...month.income.excludedRecords,
      ...month.income.foreignRecords,
    ])
    .map((normalized) => {
      const month = months.find((item) => item.normalized.month === normalized.month)
      if (!month) throw new Error(`source month missing for transaction ${normalized.id}`)
      const raw = rawTransactionsForMonth(month.raw).get(normalized.id)
      if (!raw) {
        throw new Error(`raw source record missing for ${normalized.id}`)
      }
      return { raw, normalized, rawSha256: sha256Json(raw) }
    })
  return { source, payload, aliases, months, transactions }
}

function rawTransactionsForMonth(month: Record<string, Json>): Map<string, Record<string, Json>> {
  const income = objectRecord(month.income)
  const groups: Array<[LedgerScope, Json | undefined]> = [
    ['household', objectRecord(month.household)?.records],
    ['company', objectRecord(month.company)?.records],
    ['agency', objectRecord(month.agency)?.records],
    ['funding', objectRecord(month.funding)?.records],
    ['foreignHousehold', month.foreign],
    ['income', income?.records],
    ['pendingIncome', income?.pending_records],
    ['excludedIncome', income?.excluded_records],
    // Foreign income shares the persisted logical scope, but this mapping keeps
    // its source-array identity stable instead of guessing by date or amount.
    ['income', income?.foreign_records],
  ]
  const result = new Map<string, Record<string, Json>>()
  for (const [scope, rawList] of groups) {
    if (rawList === undefined) continue
    if (!Array.isArray(rawList)) throw new Error(`month ${String(month.month)} raw ${scope} records must be an array`)
    for (const [index, raw] of rawList.entries()) {
      const record = objectRecord(raw)
      if (!record) throw new Error(`month ${String(month.month)} raw ${scope} record ${index} must be an object`)
      const originalId = typeof record.id === 'string' && record.id.trim()
        ? record.id
        : `${scope}-${String(month.month)}-${index}`
      const stableId = stableRecordId(String(month.month), scope, originalId)
      if (result.has(stableId)) throw new Error(`duplicate source transaction id: ${stableId}`)
      result.set(stableId, record)
    }
  }
  return result
}

function objectRecord(value: Json | undefined): Record<string, Json> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

export function diffLedgerImport(
  prepared: PreparedLedgerImport,
  existingMonths: readonly ExistingMonthRow[],
  existingTransactions: readonly ExistingTransactionRow[],
  protectedTransactionIds: readonly string[] = [],
): ImportDiff {
  const includedMonths = new Set(prepared.months.map((month) => month.normalized.month))
  const existingByMonth = new Map(existingMonths.filter((month) => includedMonths.has(month.month)).map((month) => [month.month, month]))
  const existingByStableId = new Map(
    existingTransactions.filter((transaction) => includedMonths.has(transaction.month)).map((transaction) => [transaction.stableId, transaction]),
  )
  const protectedSet = new Set(protectedTransactionIds)
  const protectedConflicts: string[] = []

  let unchangedTransactions = 0
  let insertedTransactions = 0
  let updatedTransactions = 0
  for (const transaction of prepared.transactions) {
    const existing = existingByStableId.get(transaction.normalized.id)
    if (!existing) {
      insertedTransactions += 1
      continue
    }
    const sameAccount = existing.accountKey === undefined ||
      (existing.accountKey === transaction.normalized.accountKey &&
        existing.accountLabel === transaction.normalized.accountLabel)
    if (existing.rawSha256 === transaction.rawSha256 && sameAccount) unchangedTransactions += 1
    else {
      updatedTransactions += 1
      if (protectedSet.has(transaction.normalized.id)) protectedConflicts.push(transaction.normalized.id)
    }
  }

  const plannedIds = new Set(prepared.transactions.map((transaction) => transaction.normalized.id))
  const removed = existingTransactions.filter(
    (transaction) => includedMonths.has(transaction.month) && !plannedIds.has(transaction.stableId),
  )
  for (const transaction of removed) {
    if (protectedSet.has(transaction.stableId)) protectedConflicts.push(transaction.stableId)
  }

  let unchangedMonths = 0
  let upsertedMonths = 0
  for (const month of prepared.months) {
    const existing = existingByMonth.get(month.normalized.month)
    if (existing?.rawSha256 === month.rawSha256) unchangedMonths += 1
    else upsertedMonths += 1
  }

  if (protectedConflicts.length) {
    throw new Error(
      `import would change transactions with user confirmations: ${protectedConflicts.sort().join(', ')}`,
    )
  }

  return {
    unchangedTransactions,
    insertedTransactions,
    updatedTransactions,
    removedTransactions: removed.length,
    unchangedMonths,
    upsertedMonths,
    protectedConflicts,
    idempotent: unchangedTransactions === prepared.transactions.length &&
      existingByStableId.size === prepared.transactions.length &&
      unchangedMonths === prepared.months.length &&
      removed.length === 0,
  }
}
