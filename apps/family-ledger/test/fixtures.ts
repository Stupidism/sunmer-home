import type { Json } from '../src/lib/domain/types'

export const syntheticAliases = {
  accounts: [
    {
      id: 'TEST-CARD-A',
      label: '虚构卡 A',
      aliases: ['虚构卡A'],
    },
  ],
} satisfies Json

function record(id: string, day: string, cents: number, overrides: Record<string, Json> = {}) {
  return {
    id,
    date: `2026-01-${day}`,
    cents,
    currency: 'CNY',
    category: '测试分类',
    merchant: `虚构商户 ${id}`,
    description: '虚构描述',
    account: '虚构卡A',
    owner: '本人',
    source: 'synthetic-source',
    ...overrides,
  }
}

export function syntheticDashboard(): Json {
  const income = [
    record('income-1', '05', 30_000, { scope: 'income' }),
  ]
  const pendingIncome = [
    record('pending-1', '06', 8_000, { status: 'pending' }),
  ]
  const excludedIncome = [
    record('excluded-1', '07', 5_000, { category: '资产转入' }),
  ]
  const foreignIncome = [
    record('foreign-income-1', '08', 2_000, { currency: 'USD' }),
  ]
  return {
    schema_version: 1,
    months: [
      {
        month: '2026-01',
        status: 'final',
        notes: ['synthetic fixture'],
        coverage: { source: 'synthetic.json', scope: 'test' },
        household: {
          net_cents: 27_000,
          records: [
            record('mortgage-reserve', '01', 20_000, { category: '房贷备款' }),
            record('expense-1', '02', 10_000),
            record('refund-1', '03', -3_000),
          ],
        },
        mortgage_funding_cents: 20_000,
        company: {
          net_cents: 5_000,
          records: [
            record('company-expense-1', '04', 7_000),
            record('company-refund-1', '05', -2_000),
          ],
          notes: ['synthetic company'],
        },
        agency: {
          paid_cents: 4_000,
          received_cents: 1_000,
          records: [
            record('agency-paid-1', '06', 4_000),
            record('agency-refund-1', '07', -1_000),
          ],
          notes: ['synthetic agency'],
        },
        funding: {
          records: [record('funding-1', '08', -500)],
          notes: ['synthetic funding'],
        },
        foreign: [record('foreign-expense-1', '09', 1_200, { currency: 'USD' })],
        pending: [{ label: '虚构待核项', cents: 100, detail: 'fixture' }],
        income: {
          records: income,
          pending_records: pendingIncome,
          excluded_records: excludedIncome,
          foreign_records: foreignIncome,
          foreign_totals: { USD: 2_000 },
          total_cents: 30_000,
          known_total_cents: 30_000,
          complete: true,
          notes: ['synthetic income'],
        },
      },
    ],
    generated_from: [{ path: 'synthetic.json', sha256: 'a'.repeat(64) }],
    default_months: ['2026-01'],
  }
}

export function syntheticRecord(id: string, day: string, cents: number, overrides: Record<string, Json> = {}) {
  return record(id, day, cents, overrides)
}
