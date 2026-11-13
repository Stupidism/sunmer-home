import { allTransactions } from './monthly'
import { buildCategoryAggregates } from './classification'
import type { DashboardPayload, PublishedDashboardSnapshot, PurposeHistory, RefundOverview, TaxonomySnapshot } from './types'

export function constructDashboardSnapshot(input: {
  publishedAt: string
  payload: DashboardPayload
  refunds: RefundOverview
  purposeHistory: PurposeHistory[]
  taxonomy: TaxonomySnapshot
}): PublishedDashboardSnapshot {
  const records = allTransactions(input.payload)
  const totalsByScopeCurrency: Record<string, number> = {}
  for (const record of records) {
    const key = `${record.scope}:${record.currency}`
    const next = (totalsByScopeCurrency[key] ?? 0) + record.cents
    if (!Number.isSafeInteger(next)) throw new Error('snapshot overview exceeds safe integer range')
    totalsByScopeCurrency[key] = next
  }
  return {
    schemaVersion: 1,
    snapshotVersion: 1,
    publishedAt: input.publishedAt,
    payload: input.payload,
    refunds: input.refunds,
    purposeHistory: input.purposeHistory,
    taxonomy: input.taxonomy,
    aggregates: buildCategoryAggregates(records),
    overview: { transactionCount: records.length, totalsByScopeCurrency },
  }
}
