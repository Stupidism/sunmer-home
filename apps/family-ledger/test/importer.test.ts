import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diffLedgerImport, prepareLedgerImport } from '../src/lib/importer/core'
import type { ExistingMonthRow, ExistingTransactionRow } from '../src/lib/importer/core'
import { syntheticAliases, syntheticDashboard } from './fixtures'
import type { Json } from '../src/lib/domain/types'

const source = { label: 'synthetic.json', sha256: 'b'.repeat(64), hashKind: 'dashboard-input' as const }

function objectValue(value: Json, label: string): Record<string, Json> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`)
  return value
}

test('import diff is idempotent for identical content and preserves other months', () => {
  const prepared = prepareLedgerImport(syntheticDashboard(), syntheticAliases, source)
  const existingMonths: ExistingMonthRow[] = prepared.months.map((month) => ({
    month: month.normalized.month,
    raw: month.raw,
    rawSha256: month.rawSha256,
  }))
  const existingTransactions: ExistingTransactionRow[] = prepared.transactions.map((transaction) => ({
    stableId: transaction.normalized.id,
    month: transaction.normalized.month,
    scope: transaction.normalized.scope,
    originalId: transaction.normalized.originalId,
    rawSha256: transaction.rawSha256,
  }))
  existingTransactions.push({
    stableId: '2026-02:household:kept',
    month: '2026-02',
    scope: 'household',
    originalId: 'kept',
    rawSha256: 'c'.repeat(64),
  })

  const diff = diffLedgerImport(prepared, existingMonths, existingTransactions)
  assert.equal(diff.idempotent, true)
  assert.equal(diff.insertedTransactions, 0)
  assert.equal(diff.updatedTransactions, 0)
  assert.equal(diff.removedTransactions, 0)
  assert.ok(!diff.protectedConflicts.includes('2026-02:household:kept'))
})

test('a changed transaction with a purpose confirmation is a protected conflict', () => {
  const raw = syntheticDashboard()
  const prepared = prepareLedgerImport(raw, syntheticAliases, source)
  const changedRaw = structuredClone(raw)
  const root = objectValue(changedRaw, 'dashboard')
  assert.ok(Array.isArray(root.months))
  const month = objectValue(root.months[0], 'month')
  const household = objectValue(month.household, 'household')
  assert.ok(Array.isArray(household.records))
  objectValue(household.records[1], 'transaction').merchant = 'changed synthetic merchant'
  const changed = prepareLedgerImport(changedRaw, syntheticAliases, source)
  const existing = prepared.transactions.map((transaction): ExistingTransactionRow => ({
    stableId: transaction.normalized.id,
    month: transaction.normalized.month,
    scope: transaction.normalized.scope,
    originalId: transaction.normalized.originalId,
    rawSha256: transaction.rawSha256,
  }))

  assert.throws(
    () => diffLedgerImport(changed, [], existing, ['2026-01:household:expense-1']),
    /user confirmations/,
  )
})

test('foreign income maps back to its own raw source record', () => {
  const prepared = prepareLedgerImport(syntheticDashboard(), syntheticAliases, source)
  const foreign = prepared.transactions.find((item) => item.normalized.originalId === 'foreign-income-1')
  assert.ok(foreign)
  assert.equal(foreign.normalized.scope, 'income')
  assert.equal(foreign.normalized.currency, 'USD')
  assert.equal(foreign.raw.id, 'foreign-income-1')
  assert.equal(foreign.raw.currency, 'USD')
})

test('changed account aliases are an explicit transaction update', () => {
  const prepared = prepareLedgerImport(syntheticDashboard(), syntheticAliases, source)
  const changedAliases = {
    accounts: [{ id: 'TEST-CARD-B', label: '虚构卡 B', aliases: ['虚构卡A'] }],
  } satisfies Json
  const changed = prepareLedgerImport(syntheticDashboard(), changedAliases, source)
  const existing = prepared.transactions.map((transaction): ExistingTransactionRow => ({
    stableId: transaction.normalized.id,
    month: transaction.normalized.month,
    scope: transaction.normalized.scope,
    originalId: transaction.normalized.originalId,
    accountKey: transaction.normalized.accountKey,
    accountLabel: transaction.normalized.accountLabel,
    rawSha256: transaction.rawSha256,
  }))
  const diff = diffLedgerImport(changed, prepared.months.map((month) => ({
    month: month.normalized.month,
    raw: month.raw,
    rawSha256: month.rawSha256,
  })), existing)
  assert.equal(diff.idempotent, false)
  assert.ok(diff.updatedTransactions > 0)
})
