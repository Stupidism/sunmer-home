export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export const LEDGER_SCOPES = [
  'household',
  'company',
  'agency',
  'funding',
  'foreignHousehold',
  'income',
  'pendingIncome',
  'excludedIncome',
] as const

export type LedgerScope = (typeof LEDGER_SCOPES)[number]

export type LedgerDirection = 'expense' | 'refund' | 'income'

export interface SafeSource {
  label: string
  sha256: string
  hashKind: 'dashboard-input'
  originalFileLabel?: string
}

export interface PurposeHistory {
  transactionId: string
  purpose: string
  evidence: Json
  confirmedBy: string
  confirmedAt: string
  active: boolean
}

export interface SafeRefundLink {
  expenseTransactionId: string
  refundTransactionId: string
  allocationCents: number
  currency: string
  status: 'pending' | 'confirmed'
  evidence: Record<string, unknown>
  createdBy: string
  createdAt: string
}

export interface LedgerRecord {
  id: string
  originalId: string
  month: string
  date: string
  cents: number
  currency: string
  category: string
  merchant: string
  description: string
  account: string
  accountKey: string
  accountLabel: string
  owner: string
  scope: LedgerScope
  direction: LedgerDirection
  status?: string
  recurrence?: string
  incomeBasis?: string
  sourceBasis?: string
  basis?: string
  purpose?: string | null
  source: SafeSource
}

export interface PendingItem {
  label: string
  cents: number | null
  detail: string
}

export interface IncomeSection {
  available: boolean
  records: LedgerRecord[]
  pendingRecords: LedgerRecord[]
  excludedRecords: LedgerRecord[]
  foreignRecords: LedgerRecord[]
  foreignTotals: Record<string, number>
  totalCents: number | null
  knownTotalCents: number
  complete: boolean
  notes: string[]
}

export interface MortgageSummary {
  excludedCents: number
  reserveCents: number
  paymentCents: number
  shortfallCents: number | null
}

export interface LedgerMonth {
  month: string
  status: string
  notes: string[]
  coverage: Json | null
  household: {
    netCents: number
    records: LedgerRecord[]
  }
  mortgage: MortgageSummary
  company: {
    available: boolean
    netCents: number | null
    records: LedgerRecord[]
    notes: string[]
  }
  agency: {
    available: boolean
    paidCents: number | null
    receivedCents: number | null
    records: LedgerRecord[]
    notes: string[]
  }
  funding: {
    records: LedgerRecord[]
    notes: string[]
  }
  foreign: LedgerRecord[]
  pending: PendingItem[]
  income: IncomeSection
}

export interface DashboardPayload {
  schemaVersion: 1
  months: LedgerMonth[]
  defaultMonths: string[]
}

export interface TransactionFilters {
  from?: string
  to?: string
  owners?: string[]
  accounts?: string[]
  scopes?: LedgerScope[]
  categories?: string[]
  search?: string
  min?: number | null
  max?: number | null
  status?: 'all' | 'identified' | 'pending' | 'excluded'
  sort?: 'date-desc' | 'date-asc' | 'amount-asc' | 'amount-desc'
  months?: string[]
}

export interface RuntimeConfiguration {
  databaseUrl: boolean
  authSecret: boolean
}
