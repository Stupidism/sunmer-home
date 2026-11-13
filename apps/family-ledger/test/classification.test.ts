import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertMergeAllowed, assertRevision, assertSplitSelection, assertUniqueCategory,
  buildCategoryAggregates, classificationDisplay, effectiveClassification, emptyClassifications,
} from '../src/lib/domain/classification'
import { constructDashboardSnapshot } from '../src/lib/domain/snapshot'
import type { CategoryDefinition, DashboardPayload, LedgerRecord, RefundOverview } from '../src/lib/domain/types'

const source = { label: 'fictional.json', sha256: 'a'.repeat(64), hashKind: 'dashboard-input' as const }
function record(id: string, cents: number, currency = 'CNY'): LedgerRecord {
  return { id, originalId: id, month: '2026-01', date: '2026-01-01', cents, currency, category: 'Fictional source',
    sourceCategory: 'Fictional source', classifications: emptyClassifications(), merchant: '', description: '', account: '',
    accountKey: '', accountLabel: '', owner: 'Test', scope: 'household', direction: cents < 0 ? 'refund' : 'expense', source }
}
function category(id: string, scheme: 'GB'|'QS'|'ZFB' = 'GB'): CategoryDefinition {
  return { id, scheme, mainLabel: 'Fictional main', subLabel: id, state: 'active', revision: 1 }
}

test('duplicate labels collide only inside the same scheme', () => {
  const existing = [category('gb:a')]
  assert.throws(() => assertUniqueCategory(existing, { ...category('gb:b'), subLabel: 'gb:a' }), /already exists/)
  assert.doesNotThrow(() => assertUniqueCategory(existing, { ...category('qs:a', 'QS'), mainLabel: 'Fictional main', subLabel: 'gb:a' }))
})

test('merge is bounded to distinct active categories in one scheme', () => {
  assert.throws(() => assertMergeAllowed(category('gb:a'), category('qs:a', 'QS')), /same scheme/)
  assert.throws(() => assertMergeAllowed(category('gb:a'), category('gb:a')), /itself/)
  assert.throws(() => assertMergeAllowed(category('gb:a'), { ...category('gb:b'), state: 'archived' }), /archived/)
})

test('split selection requires explicit unique eligible transaction ids', () => {
  assert.deepEqual(assertSplitSelection(['t1'], new Set(['t1','t2'])), ['t1'])
  assert.throws(() => assertSplitSelection([], new Set()), /requires/)
  assert.throws(() => assertSplitSelection(['t1','t1'], new Set(['t1'])), /unique/)
  assert.throws(() => assertSplitSelection(['t3'], new Set(['t1'])), /ineligible/)
})

test('transaction override has stable precedence over a source rule', () => {
  const rule = { categoryId: 'gb:rule', mainLabel: 'A', subLabel: 'B', status: 'confirmed' as const, source: 'rule' as const }
  const override = { categoryId: 'gb:override', mainLabel: 'A', subLabel: 'C', status: 'override' as const, source: 'override' as const }
  assert.equal(effectiveClassification(rule, override).categoryId, 'gb:override')
  assert.equal(effectiveClassification(rule, undefined).categoryId, 'gb:rule')
})

test('revision validation rejects stale and invalid revisions', () => {
  assert.doesNotThrow(() => assertRevision(4, 4))
  assert.throws(() => assertRevision(4, 3), /conflict/)
  assert.throws(() => assertRevision(1, 0), /conflict/)
})

test('classification aggregates keep schemes and currencies separate without changing totals', () => {
  const a = record('a', 100); a.classifications.GB = { categoryId: 'gb:a', mainLabel: 'A', subLabel: 'A', status: 'confirmed', source: 'rule' }
  const b = record('b', -25); b.classifications.GB = { ...a.classifications.GB }; b.classifications.QS = { categoryId: 'qs:a', mainLabel: 'Q', subLabel: 'A', status: 'override', source: 'override' }
  const c = record('c', 7, 'AUD')
  const aggregates = buildCategoryAggregates([a,b,c])
  assert.equal(aggregates.filter((x) => x.scheme === 'GB' && x.currency === 'CNY').reduce((n,x) => n+x.cents,0), 75)
  assert.equal(aggregates.filter((x) => x.scheme === 'QS' && x.currency === 'CNY').reduce((n,x) => n+x.cents,0), 75)
  assert.equal(aggregates.filter((x) => x.currency === 'AUD' && x.scheme === 'ZFB').reduce((n,x) => n+x.cents,0), 7)
})

test('scheme display changes labels and pending markers without changing signed amounts or source category', () => {
  const row = record('display', -321)
  row.classifications.GB = { categoryId: 'gb:a', mainLabel: '家庭', subLabel: '餐饮', status: 'confirmed', source: 'rule' }
  row.classifications.QS = { categoryId: 'qs:a', mainLabel: '生活', subLabel: '食品', status: 'inferred', source: 'rule' }
  assert.deepEqual(classificationDisplay(row, 'GB'), { category: '家庭 / 餐饮', pending: false })
  assert.deepEqual(classificationDisplay(row, 'QS'), { category: '生活 / 食品', pending: false })
  assert.deepEqual(classificationDisplay(row, 'ZFB'), { category: '待分类', pending: true })
  assert.equal(row.cents, -321)
  assert.equal(row.sourceCategory, 'Fictional source')
})

test('snapshot construction publishes version, catalog, aggregates and signed overview unchanged', () => {
  const row = record('a', -125)
  const payload = { schemaVersion: 1, months: [{ month: '2026-01', status: 'ok', notes: [], coverage: null,
    household: { netCents: -125, records: [row] }, mortgage: { excludedCents: 0, reserveCents: 0, paymentCents: 0, shortfallCents: null },
    company: { available: false, netCents: null, records: [], notes: [] }, agency: { available: false, paidCents: null, receivedCents: null, records: [], notes: [] },
    funding: { records: [], notes: [] }, foreign: [], pending: [], income: { available: false, records: [], pendingRecords: [], excludedRecords: [], foreignRecords: [], foreignTotals: {}, totalCents: null, knownTotalCents: 0, complete: false, notes: [] } }], defaultMonths: ['2026-01'] } satisfies DashboardPayload
  const refunds = { candidates: { household: [], company: [], agency: [], foreignHousehold: [] }, summary: { scopes: [], confirmedByArrivalMonth: {}, groups: [] }, links: [] } as unknown as RefundOverview
  const snapshot = constructDashboardSnapshot({ publishedAt: '2026-01-02T00:00:00.000Z', payload, refunds, purposeHistory: [], taxonomy: { schemes: [{ code: 'GB', label: 'GB', revision: 1 }], categories: [category('gb:a')], rules: [] } })
  assert.equal(snapshot.snapshotVersion, 1); assert.equal(snapshot.overview.totalsByScopeCurrency['household:CNY'], -125)
  assert.equal(snapshot.aggregates.filter((x) => x.scheme === 'GB').reduce((n,x) => n+x.cents,0), -125)
})
