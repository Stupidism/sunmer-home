import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listRefundCandidates,
  rankExpensesAfterConfirmedRefunds,
  summarizeRefunds,
  validateRefundLink,
} from "../src/lib/domain/refunds";
import { normalizeDashboardPayload } from "../src/lib/domain/monthly";
import type { LedgerRecord } from "../src/lib/domain/types";
import { syntheticAliases, syntheticDashboard } from "./fixtures";

const source = {
  label: "synthetic.json",
  sha256: "b".repeat(64),
  hashKind: "dashboard-input" as const,
};
const evidence = { note: "虚构人工凭证", source: "synthetic test" };

function ledgerRecords(): LedgerRecord[] {
  return normalizeDashboardPayload(syntheticDashboard(), {
    source,
    resolver: undefined,
  }).months.flatMap((month) => [
    ...month.household.records,
    ...month.company.records,
    ...month.agency.records,
  ]);
}

test("same-day same-amount refunds remain separate and are never auto-matched", () => {
  const rows = ledgerRecords();
  const candidates = listRefundCandidates(rows);
  const sameDay = candidates.household.filter(
    (item) => item.date === "2026-01-03",
  );
  assert.equal(sameDay.length, 1);
  const another = {
    ...sameDay[0],
    id: "2026-01:household:refund-2",
    originalId: "refund-2",
  };
  const result = validateRefundLink(
    {
      expenseTransactionId: "2026-01:household:expense-1",
      refundTransactionId: another.id,
      allocationCents: 3_000,
      currency: "CNY",
      status: "confirmed",
      evidence,
    },
    [...rows.map(toCandidate), another],
  );
  assert.equal(result.ok, true);
  assert.equal(result.idempotent, false);
});

function toCandidate(record: LedgerRecord) {
  return {
    id: record.id,
    originalId: record.originalId,
    month: record.month,
    scope: record.scope,
    cents: record.cents,
    currency: record.currency,
    date: record.date,
    merchant: record.merchant,
  };
}

test("refund allocation cannot exceed the original or refund amount", () => {
  const rows = ledgerRecords().map(toCandidate);
  const result = validateRefundLink(
    {
      expenseTransactionId: "2026-01:household:expense-1",
      refundTransactionId: "2026-01:household:refund-1",
      allocationCents: 10_001,
      currency: "CNY",
      status: "pending",
      evidence,
    },
    rows,
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "invalid-allocation");
});

test("cross-currency and cross-scope links are rejected", () => {
  const rows = ledgerRecords().map(toCandidate);
  const crossCurrency = validateRefundLink(
    {
      expenseTransactionId: "2026-01:household:expense-1",
      refundTransactionId: "2026-01:household:refund-1",
      allocationCents: 1,
      currency: "USD",
      status: "pending",
      evidence,
    },
    rows.map((row) =>
      row.id === "2026-01:household:expense-1"
        ? { ...row, currency: "USD" }
        : row,
    ),
  );
  const crossScope = validateRefundLink(
    {
      expenseTransactionId: "2026-01:household:expense-1",
      refundTransactionId: "2026-01:company:company-refund-1",
      allocationCents: 1,
      currency: "CNY",
      status: "pending",
      evidence,
    },
    rows,
  );
  assert.equal(crossCurrency.ok, false);
  assert.equal(crossCurrency.code, "currency-mismatch");
  assert.equal(crossScope.ok, false);
  assert.equal(crossScope.code, "scope-mismatch");
});

test("unknown refunds remain visible and company refunds stay isolated from household", () => {
  const records = ledgerRecords();
  const summary = summarizeRefunds(records, []);
  const household = summary.scopes.find((item) => item.scope === "household");
  const company = summary.scopes.find((item) => item.scope === "company");
  assert.equal(household?.currencies.CNY.unallocatedRefundCents, 3_000);
  assert.equal(company?.currencies.CNY.unallocatedRefundCents, 2_000);
  assert.ok(
    household?.currencies.CNY.refunds.some(
      (item) => item.allocationState === "unknown",
    ),
  );
  assert.ok(
    company?.currencies.CNY.refunds.some(
      (item) => item.allocationState === "unknown",
    ),
  );
});

test("refund summaries keep currencies separate and pending is not confirmed", () => {
  const records = ledgerRecords();
  const expense = records.find(
    (item) => item.id === "2026-01:household:expense-1",
  );
  const refund = records.find(
    (item) => item.id === "2026-01:household:refund-1",
  );
  assert.ok(expense);
  assert.ok(refund);
  const usdExpense = {
    ...expense,
    id: "usd-expense",
    originalId: "usd-expense",
    currency: "USD",
    cents: 5_000,
  };
  const usdRefund = {
    ...refund,
    id: "usd-refund",
    originalId: "usd-refund",
    currency: "USD",
    cents: -2_000,
  };
  const summary = summarizeRefunds(
    [...records, usdExpense, usdRefund],
    [
      {
        expenseTransactionId: usdExpense.id,
        refundTransactionId: usdRefund.id,
        allocationCents: 2_000,
        currency: "USD",
        status: "pending",
        evidence,
      },
    ],
  );
  const household = summary.scopes.find((item) => item.scope === "household");
  assert.equal(household?.currencies.CNY.unallocatedRefundCents, 3_000);
  assert.equal(household?.currencies.USD.originalRefundCents, 2_000);
  assert.equal(household?.currencies.USD.confirmedAllocationCents, 0);
  assert.equal(household?.currencies.USD.pendingAllocationCents, 2_000);
  assert.equal(
    household?.currencies.USD.expenses[0].allocationState,
    "pending",
  );
  assert.equal(household?.currencies.USD.refunds[0].allocationState, "pending");
});

test("large-expense ranking uses confirmed remaining cost without changing cashflow", () => {
  const records = ledgerRecords();
  const expense = records.find(
    (row) => row.id === "2026-01:household:expense-1",
  )!;
  const refund = records.find(
    (row) => row.id === "2026-01:household:refund-1",
  )!;
  const cashflowBefore = expense.cents + refund.cents;
  const links = [
    {
      expenseTransactionId: expense.id,
      refundTransactionId: refund.id,
      allocationCents: Math.abs(refund.cents),
      currency: "CNY",
      status: "confirmed" as const,
      evidence,
    },
  ];
  const ranked = rankExpensesAfterConfirmedRefunds([expense], links);
  assert.equal(
    ranked[0].remainingCents,
    expense.cents - Math.abs(refund.cents),
  );
  assert.equal(expense.cents + refund.cents, cashflowBefore);
});

test("fully offset expenses are identifiable for default ranking exclusion", () => {
  const expense = ledgerRecords().find(
    (row) => row.id === "2026-01:household:expense-1",
  )!;
  const ranked = rankExpensesAfterConfirmedRefunds(
    [expense],
    [
      {
        expenseTransactionId: expense.id,
        refundTransactionId: "synthetic-refund",
        allocationCents: expense.cents,
        currency: expense.currency,
        status: "confirmed",
        evidence,
      },
    ],
  );
  assert.equal(ranked[0].remainingCents, 0);
});

test("foreign household refunds are candidates and remain currency-safe", () => {
  const base = ledgerRecords()[0];
  const expense = {
    ...base,
    id: "foreign-expense",
    originalId: "foreign-expense",
    scope: "foreignHousehold" as const,
    currency: "AUD",
    cents: 5_000,
  };
  const refund = {
    ...expense,
    id: "foreign-refund",
    originalId: "foreign-refund",
    cents: -2_000,
  };
  const candidates = listRefundCandidates([expense, refund]);
  assert.equal(candidates.foreignHousehold.length, 1);
  const validation = validateRefundLink(
    {
      expenseTransactionId: expense.id,
      refundTransactionId: refund.id,
      allocationCents: 1_500,
      currency: "AUD",
      status: "confirmed",
      evidence,
    },
    [expense, refund].map(toCandidate),
  );
  assert.equal(validation.ok, true);
  assert.equal(
    summarizeRefunds(
      [expense, refund],
      [
        {
          expenseTransactionId: expense.id,
          refundTransactionId: refund.id,
          allocationCents: 1_500,
          currency: "AUD",
          status: "confirmed",
          evidence,
        },
      ],
    ).scopes.find((item) => item.scope === "foreignHousehold")?.currencies.AUD
      .unallocatedRefundCents,
    500,
  );
});
