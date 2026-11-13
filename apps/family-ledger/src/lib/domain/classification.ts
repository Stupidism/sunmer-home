import {
  CLASSIFICATION_SCHEMES,
  type CategoryAggregate,
  type CategoryDefinition,
  type ClassificationScheme,
  type LedgerRecord,
  type TransactionClassification,
} from './types'

export const PENDING_CLASSIFICATION: TransactionClassification = {
  categoryId: null,
  mainLabel: null,
  subLabel: null,
  status: 'pending',
  source: 'unmapped',
}

export function emptyClassifications(): Record<ClassificationScheme, TransactionClassification> {
  return Object.fromEntries(CLASSIFICATION_SCHEMES.map((scheme) => [scheme, { ...PENDING_CLASSIFICATION }])) as Record<ClassificationScheme, TransactionClassification>
}

export function validateCategoryName(value: string, field = 'category label'): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > 100) throw new Error(`${field} must contain 1-100 characters`)
  return normalized
}

export function validateSourceLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized || normalized.length > 200) throw new Error('source label must contain 1-200 characters')
  return normalized
}

export function assertUniqueCategory(categories: readonly Pick<CategoryDefinition, 'id' | 'scheme' | 'mainLabel' | 'subLabel'>[], candidate: Pick<CategoryDefinition, 'id' | 'scheme' | 'mainLabel' | 'subLabel'>): void {
  if (categories.some((item) => item.id !== candidate.id && item.scheme === candidate.scheme && item.mainLabel === candidate.mainLabel && item.subLabel === candidate.subLabel)) {
    throw new Error('category already exists in this scheme')
  }
}

export function assertMergeAllowed(source: CategoryDefinition, destination: CategoryDefinition): void {
  if (source.id === destination.id) throw new Error('cannot merge a category into itself')
  if (source.scheme !== destination.scheme) throw new Error('categories must belong to the same scheme')
  if (source.state !== 'active' || destination.state !== 'active') throw new Error('archived or merged categories cannot be merge targets')
}

export function assertRevision(actual: number, expected: number): void {
  if (!Number.isSafeInteger(expected) || expected < 1 || actual !== expected) throw new Error('category revision conflict')
}

export function effectiveClassification(rule: TransactionClassification | undefined, assignment: TransactionClassification | undefined): TransactionClassification {
  if (assignment?.source === 'override' || assignment?.status === 'override') return assignment
  if (assignment) return assignment
  return rule ?? { ...PENDING_CLASSIFICATION }
}

export function buildCategoryAggregates(records: readonly LedgerRecord[]): CategoryAggregate[] {
  const grouped = new Map<string, CategoryAggregate>()
  for (const row of records) {
    for (const scheme of CLASSIFICATION_SCHEMES) {
      const categoryId = row.classifications[scheme]?.categoryId ?? null
      const key = [row.month, scheme, row.scope, row.currency, categoryId ?? 'pending'].join('\0')
      const current = grouped.get(key) ?? { month: row.month, scheme, scope: row.scope, currency: row.currency, categoryId, count: 0, cents: 0 }
      current.count += 1
      current.cents += row.cents
      if (!Number.isSafeInteger(current.cents)) throw new Error('category aggregate exceeds safe integer range')
      grouped.set(key, current)
    }
  }
  return [...grouped.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

export function assertSplitSelection(transactionIds: readonly string[], eligibleIds: ReadonlySet<string>): string[] {
  const unique = [...new Set(transactionIds)]
  if (!unique.length) throw new Error('split requires explicit transaction ids')
  if (unique.length !== transactionIds.length) throw new Error('split transaction ids must be unique')
  if (unique.some((id) => !eligibleIds.has(id))) throw new Error('split contains an ineligible transaction')
  return unique
}

export function totalsByCurrency(records: readonly Pick<LedgerRecord, 'currency' | 'cents'>[]): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of records) result[row.currency] = (result[row.currency] ?? 0) + row.cents
  return result
}

export function classificationDisplay(record: Pick<LedgerRecord, 'classifications'>, scheme: ClassificationScheme): { category: string; pending: boolean } {
  const value = record.classifications[scheme]
  if (!value?.categoryId) return { category: '待分类', pending: true }
  return { category: [value.mainLabel, value.subLabel].filter(Boolean).join(' / '), pending: false }
}
