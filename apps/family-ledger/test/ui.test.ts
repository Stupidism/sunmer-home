import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDashboardPayload } from "../src/lib/domain/monthly";
import {
  comparisonCell,
  classificationRankings,
  calendarChartPoints,
  currencyTotalsAndAverages,
  dailyNetSpending,
  EMPTY_FILTERS,
  filterLedgerRows,
  knownAggregate,
  ledgerNavigationQuery,
  monthsOverlappingDateRange,
  parseFilters,
  previewFingerprint,
  refundAccountingForDisplay,
  refundAllocationRows,
  refundGroupResidual,
  refundGroupsForFilters,
  refundRemainders,
  serializeFilters,
  transactionRowsForDisplay,
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

test("noncontiguous month chips intersect local dates and multiple people", () => {
  const base = rows.find((row) => row.originalId === "expense-1")!;
  const fixture = [
    { ...base, id: "jan-a", month: "2026-01", date: "2026-01-04", owner: "甲" },
    { ...base, id: "feb-a", month: "2026-02", date: "2026-02-04", owner: "甲" },
    { ...base, id: "mar-b", month: "2026-03", date: "2026-03-08", owner: "乙" },
    { ...base, id: "mar-c", month: "2026-03", date: "2026-03-09", owner: "丙" },
  ];
  const result = filterLedgerRows(fixture, {
    ...EMPTY_FILTERS,
    months: ["2026-01", "2026-03"],
    owners: ["甲", "乙"],
    from: "2026-01-03",
    to: "2026-03-08",
  });
  assert.deepEqual(result.map((row) => row.id), ["jan-a", "mar-b"]);
});

test("inclusive end date includes timestamps on that local bill date", () => {
  const base = rows.find((row) => row.originalId === "expense-1")!;
  const result = filterLedgerRows([
    { ...base, id: "end-day", month: "2026-03", date: "2026-03-08T23:59:59+08:00", owner: "甲" },
    { ...base, id: "next-day", month: "2026-03", date: "2026-03-09T00:00:00+08:00", owner: "甲" },
  ], { ...EMPTY_FILTERS, months: ["2026-03"], owners: ["甲"], to: "2026-03-08" });
  assert.deepEqual(result.map((row) => row.id), ["end-day"]);
});

test("ledger navigation isolates comparison query state", () => {
  const compare = new URLSearchParams("scheme=QS&compareScope=company&compareMonth=2026-01");
  assert.equal(ledgerNavigationQuery("/compare", "/", compare), "scheme=QS");
  const ledger = new URLSearchParams("scheme=GB&owner=甲&compareScope=company");
  assert.equal(ledgerNavigationQuery("/transactions", "/income", ledger), "scheme=GB&owner=%E7%94%B2");
  assert.equal(ledgerNavigationQuery("/transactions", "/compare", ledger), "scheme=GB");
});

test("all three classification standards conserve signed cents and keep unmapped visible", () => {
  const base = rows.find((row) => row.originalId === "expense-1")!;
  const fixture: LedgerRecord[] = [
    { ...base, id: "positive", cents: 10_000 },
    { ...base, id: "refund", cents: -2_500, classifications: {
      GB: { categoryId: null, mainLabel: null, subLabel: null, status: "pending", source: "unmapped" },
      QS: { categoryId: "q", mainLabel: "退款", subLabel: "退货", status: "confirmed", source: "rule" },
      ZFB: { categoryId: "z", mainLabel: "退款", subLabel: "商品退款", status: "confirmed", source: "rule" },
    } },
  ];
  for (const scheme of ["GB", "QS", "ZFB"] as const) {
    const ranking = classificationRankings(fixture, scheme);
    assert.equal(ranking.reduce((total, item) => total + item.cents, 0), 7_500);
    assert.equal(ranking.reduce((total, item) => total + item.count, 0), 2);
  }
  assert.ok(classificationRankings(fixture, "GB").some((item) => item.mainLabel === "未映射"));
});

test("daily net spending uses local date text and preserves negative refund days", () => {
  const base = rows.find((row) => row.originalId === "expense-1")!;
  assert.deepEqual(dailyNetSpending([
    { ...base, id: "late", date: "2026-01-31T23:30:00+08:00", cents: 5_000 },
    { ...base, id: "refund-next", date: "2026-02-01T00:10:00+08:00", cents: -1_500 },
  ]), [
    { key: "2026-01-31", cents: 5_000, count: 1 },
    { key: "2026-02-01", cents: -1_500, count: 1 },
  ]);
});

test("daily chart positions use calendar distance and split unknown gaps", () => {
  const points = calendarChartPoints([
    { key: "2026-01-01", cents: 100 },
    { key: "2026-01-02", cents: 200 },
    { key: "2026-01-11", cents: -50 },
  ]);
  assert.equal(points[1].ratio, 0.1);
  assert.equal(points[1].startsSegment, false);
  assert.equal(points[2].startsSegment, true);
});

test("refund reconciliation keeps partial allocations and rejects currency boundaries", () => {
  const expense = { ...rows.find((row) => row.originalId === "expense-1")!, cents: 10_000 };
  const cnyRefund = { ...rows.find((row) => row.originalId === "refund-1")!, cents: -4_000 };
  const secondCnyRefund = { ...cnyRefund, id: "second-cny-refund", cents: -1_000 };
  const usdRefund = { ...cnyRefund, id: "usd-refund", currency: "USD", cents: -3_000 };
  const companyRefund = { ...cnyRefund, id: "company-refund", scope: "company" as const };
  const common: SafeRefundLink = { expenseTransactionId: expense.id, refundTransactionId: cnyRefund.id, allocationCents: 4_000, currency: "CNY", status: "confirmed", evidence: { source: "fixture" }, createdBy: "test", createdAt: "2026-02-01T00:00:00Z" };
  const group = { expense, refunds: [cnyRefund, secondCnyRefund, usdRefund, companyRefund], links: [common, { ...common, refundTransactionId: secondCnyRefund.id, allocationCents: 1_000 }, { ...common, refundTransactionId: usdRefund.id, allocationCents: 3_000 }, { ...common, refundTransactionId: companyRefund.id, allocationCents: 1_000 }, { ...common, refundTransactionId: cnyRefund.id, allocationCents: 0 }] };
  assert.deepEqual(refundAllocationRows(group).map((item) => item.compatible), [true, true, false, false, false]);
  assert.deepEqual(refundGroupResidual(group), { confirmedCents: 5_000, residualCents: 5_000 });
});

test("transaction view searches note fields, applies scheme status, exclusions, accounts, and stable amount sort", () => {
  const base = rows.find((row) => row.originalId === "expense-1")!;
  const pending = { ...base, id: "pending", cents: 500, accountLabel: "卡一", purpose: "生日礼物", classifications: { ...base.classifications, QS: { ...base.classifications.QS, status: "inferred" as const } } };
  const confirmed = { ...base, id: "confirmed", cents: 2_000, accountLabel: "卡一", merchant: "书店", classifications: { ...base.classifications, QS: { ...base.classifications.QS, status: "confirmed" as const } } };
  const excluded = { ...base, id: "excluded", cents: 100, accountLabel: "卡二", scope: "excludedIncome" as const };
  const sourcePending = { ...base, id: "source-pending", status: "pending" as const, classifications: { ...base.classifications, QS: { ...base.classifications.QS, status: "confirmed" as const } } };
  assert.deepEqual(transactionRowsForDisplay([confirmed, excluded, pending], { scheme: "QS", search: "生日", accounts: ["卡一"], pendingOnly: true, sort: "amount-asc" }).map((row) => row.id), ["pending"]);
  assert.deepEqual(transactionRowsForDisplay([pending, confirmed, excluded], { scheme: "QS", showExcluded: true, sort: "amount-desc" }).map((row) => row.id), ["confirmed", "pending", "excluded"]);
  assert.deepEqual(transactionRowsForDisplay([confirmed, sourcePending], { scheme: "QS", pendingOnly: true }).map((row) => row.id), ["source-pending"]);
});
