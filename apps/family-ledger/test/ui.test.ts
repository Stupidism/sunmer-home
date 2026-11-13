import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDashboardPayload } from "../src/lib/domain/monthly";
import {
  comparisonCell,
  currencyTotalsAndAverages,
  EMPTY_FILTERS,
  filterLedgerRows,
  knownAggregate,
  monthsOverlappingDateRange,
  parseFilters,
  previewFingerprint,
  refundAccountingForDisplay,
  refundGroupsForFilters,
  refundRemainders,
  serializeFilters,
  trendFromFilteredRows,
} from "../src/lib/domain/ui";
import type { LedgerRecord, SafeRefundLink } from "../src/lib/domain/types";
import { syntheticDashboard } from "./fixtures";

const source = {
  label: "synthetic.json",
  sha256: "b".repeat(64),
  hashKind: "dashboard-input" as const,
};
const rows = normalizeDashboardPayload(syntheticDashboard(), {
  source,
}).months.flatMap((month) => [
  ...month.household.records,
  ...month.company.records,
  ...month.income.records,
  ...month.income.foreignRecords,
]);

test("preview fingerprints bind a response to the exact draft and snapshot", () => {
  const draft = ["published-1", "GB", "rename", "source-1", "", "新主类", "新子类"];
  assert.equal(previewFingerprint(draft), previewFingerprint([...draft]));
  assert.notEqual(previewFingerprint(draft), previewFingerprint([...draft.slice(0, -1), "另一子类"]));
  assert.notEqual(previewFingerprint(draft), previewFingerprint(["published-2", ...draft.slice(1)]));
});

test("currency totals and selected-month averages never mix currencies", () => {
  const income = rows.filter((row) => row.scope === "income");
  const result = currencyTotalsAndAverages(income, ["2026-01", "2026-02"]);
  assert.deepEqual(
    result.map(({ currency, totalCents, averageCents, monthCount }) => ({
      currency,
      totalCents,
      averageCents,
      monthCount,
    })),
    [
      {
        currency: "CNY",
        totalCents: 30_000,
        averageCents: 15_000,
        monthCount: 2,
      },
      {
        currency: "USD",
        totalCents: 2_000,
        averageCents: 1_000,
        monthCount: 2,
      },
    ],
  );
});

test("income search keeps a three-month date-window denominator with one matching month", () => {
  const januaryIncome = rows.find(
    (row) => row.scope === "income" && row.currency === "CNY",
  )!;
  const incomeRows = [
    januaryIncome,
    {
      ...januaryIncome,
      id: "2026-02:income:income-2",
      originalId: "income-2",
      month: "2026-02",
      date: "2026-02-05",
      merchant: "另一家公司",
    },
    {
      ...januaryIncome,
      id: "2026-03:income:income-3",
      originalId: "income-3",
      month: "2026-03",
      date: "2026-03-05",
      merchant: "第三家公司",
    },
  ];
  const filters = {
    ...EMPTY_FILTERS,
    from: "2026-01-01",
    to: "2026-03-10",
    search: "另一家公司",
  };
  const matching = filterLedgerRows(incomeRows, filters);
  const selectedMonths = monthsOverlappingDateRange(
    ["2026-01", "2026-02", "2026-03"],
    filters.from,
    filters.to,
  );
  const [summary] = currencyTotalsAndAverages(matching, selectedMonths);

  assert.equal(matching.length, 1);
  assert.equal(summary.monthCount, 3);
  assert.equal(summary.averageCents, incomeRows[1].cents / 3);
});

test("filtered trend groups the exact filtered records including search", () => {
  const filtered = filterLedgerRows(rows, {
    ...EMPTY_FILTERS,
    search: "expense-1",
  });
  assert.deepEqual(trendFromFilteredRows(filtered), [
    { key: "2026-01", cents: 17_000 },
  ]);
});

test("filter query round-trip is stable and preserves repeated values", () => {
  const filters: typeof EMPTY_FILTERS = {
    ...EMPTY_FILTERS,
    from: "2026-01-02",
    owners: ["本人", "家人"],
    scopes: ["household"],
    search: "咖啡",
  };
  const encoded = serializeFilters(filters);
  assert.deepEqual(parseFilters(new URLSearchParams(encoded)), filters);
  assert.equal(
    serializeFilters(parseFilters(new URLSearchParams(encoded))),
    encoded,
  );
});

test("known covered category absence is zero while unavailable stays unknown", () => {
  assert.deepEqual(comparisonCell(undefined, true), { known: true, cents: 0 });
  assert.deepEqual(comparisonCell(undefined, false), {
    known: false,
    cents: null,
  });
  assert.equal(knownAggregate([100, 0]), 100);
  assert.equal(knownAggregate([100, null]), null);
});

test("refund group matches when linked refund is in range and retains outside-range original", () => {
  const expense = rows.find((row) => row.originalId === "expense-1")!;
  const refund = rows.find((row) => row.originalId === "refund-1")!;
  const links: SafeRefundLink[] = [
    {
      expenseTransactionId: expense.id,
      refundTransactionId: refund.id,
      allocationCents: 1_000,
      currency: "CNY",
      status: "confirmed",
      evidence: {},
      createdBy: "test",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ];
  const filtered = filterLedgerRows(rows, {
    ...EMPTY_FILTERS,
    from: refund.date,
    to: refund.date,
  });
  const groups = refundGroupsForFilters(rows, filtered, links);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].expense.id, expense.id);
  assert.equal(refundRemainders([refund], links)[0].remainingCents, 2_000);
});

test("refund group accounting follows the displayed association-status subset", () => {
  const expense = rows.find((row) => row.originalId === "expense-1")!;
  const refund = rows.find((row) => row.originalId === "refund-1")!;
  const pendingExpense = {
    ...expense,
    id: "2026-01:household:expense-pending",
    originalId: "expense-pending",
    cents: 8_000,
  };
  const pendingRefund = {
    ...refund,
    id: "2026-01:household:refund-pending",
    originalId: "refund-pending",
    cents: -2_000,
  };
  const confirmedLink: SafeRefundLink = {
    expenseTransactionId: expense.id,
    refundTransactionId: refund.id,
    allocationCents: expense.cents,
    currency: "CNY",
    status: "confirmed",
    evidence: {},
    createdBy: "test",
    createdAt: "2026-01-01T00:00:00Z",
  };
  const pendingLink: SafeRefundLink = {
    ...confirmedLink,
    expenseTransactionId: pendingExpense.id,
    refundTransactionId: pendingRefund.id,
    allocationCents: 2_000,
    status: "pending",
  };
  const accounting = refundAccountingForDisplay(
    [
      { expense, refunds: [refund], links: [confirmedLink] },
      {
        expense: pendingExpense,
        refunds: [pendingRefund],
        links: [pendingLink],
      },
    ],
    "pending",
  );

  assert.deepEqual(
    accounting.groups.map((group) => group.expense.id),
    [pendingExpense.id],
  );
  assert.deepEqual(accounting.totals, [
    {
      scope: "household",
      currency: "CNY",
      groupCount: 1,
      expenseCents: 8_000,
      confirmedCents: 0,
      pendingCents: 2_000,
      remainingCents: 8_000,
    },
  ]);
});
