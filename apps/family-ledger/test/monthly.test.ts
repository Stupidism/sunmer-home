import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccountResolver } from "../src/lib/domain/account-aliases";
import {
  compareForeign,
  compareMonths,
  isMortgage,
  normalizeDashboardPayload,
  summarizeOverview,
} from "../src/lib/domain/monthly";
import { syntheticAliases, syntheticDashboard } from "./fixtures";
import type { Json } from "../src/lib/domain/types";

const source = {
  label: "synthetic.json",
  sha256: "b".repeat(64),
  hashKind: "dashboard-input" as const,
};

test("mortgage exclusion follows immutable source category after display projection", () => {
  assert.equal(isMortgage({ category: "生活 / 住房", sourceCategory: "房贷月供" }), true);
  assert.equal(isMortgage({ category: "房贷月供", sourceCategory: "普通转账" }), false);
});

function objectValue(value: Json, label: string): Record<string, Json> {
  assert.ok(
    value && typeof value === "object" && !Array.isArray(value),
    `${label} must be an object`,
  );
  return value;
}

test("external fictional account aliases normalize without hardcoded account numbers", () => {
  const payload = normalizeDashboardPayload(syntheticDashboard(), {
    source,
    resolver: createAccountResolver(syntheticAliases),
  });
  const row = payload.months[0].household.records[0];
  assert.equal(row.accountKey, "TEST-CARD-A");
  assert.equal(row.accountLabel, "虚构卡 A");
});

test("missing income stays unknown with a null total rather than zero", () => {
  const raw = structuredClone(syntheticDashboard());
  const root = objectValue(raw, "dashboard");
  assert.ok(Array.isArray(root.months));
  delete objectValue(root.months[0], "month").income;
  const payload = normalizeDashboardPayload(raw, {
    source,
    resolver: createAccountResolver(syntheticAliases),
  });
  assert.equal(payload.months[0].income.totalCents, null);
  assert.equal(payload.months[0].income.available, false);
  assert.equal(payload.months[0].income.complete, false);
  const overview = summarizeOverview(payload);
  assert.equal(overview.incomeUnknown, true);
  assert.equal(overview.incomeComplete, false);
});

test("missing company and agency sections remain unavailable rather than zero", () => {
  const raw = structuredClone(syntheticDashboard());
  const root = objectValue(raw, "dashboard");
  assert.ok(Array.isArray(root.months));
  const month = objectValue(root.months[0], "month");
  delete month.company;
  delete month.agency;
  const payload = normalizeDashboardPayload(raw, {
    source,
    resolver: createAccountResolver(syntheticAliases),
  });
  assert.equal(payload.months[0].company.available, false);
  assert.equal(payload.months[0].company.netCents, null);
  assert.deepEqual(payload.months[0].company.records, []);
  assert.equal(payload.months[0].agency.available, false);
  assert.equal(payload.months[0].agency.paidCents, null);
  assert.equal(payload.months[0].agency.receivedCents, null);
});

test("family overview excludes company and agency and excludes mortgage reserve by default", () => {
  const payload = normalizeDashboardPayload(syntheticDashboard(), {
    source,
    resolver: createAccountResolver(syntheticAliases),
  });
  const overview = summarizeOverview(payload);
  assert.equal(overview.incomeCents, 30_000);
  assert.equal(overview.expenseCents, 7_000);
  assert.equal(overview.balanceCents, 23_000);
  assert.equal(overview.foreign.USD.expenseCents, 1_200);
});

test("covered filtered month with no matching income remains known zero", () => {
  const payload = normalizeDashboardPayload(syntheticDashboard(), { source });
  const filtered = structuredClone(payload);
  filtered.months[0].income.records = [];
  const compared = compareMonths(filtered, ["2026-01"], "household")[0];
  assert.equal(compared.incomeCents, 0);
  assert.equal(compared.incomeUnknown, false);
});

test("comparison keeps known incomplete CNY income, unknown balance, and excludes foreign company currency", () => {
  const payload = normalizeDashboardPayload(syntheticDashboard(), { source });
  const month = payload.months[0];
  month.income.complete = false;
  month.company.records.push({
    ...month.company.records[0],
    id: "2026-01:company:foreign-company",
    originalId: "foreign-company",
    currency: "USD",
    cents: 99_000,
  });

  const household = compareMonths(payload, ["2026-01"], "household")[0];
  const company = compareMonths(payload, ["2026-01"], "company")[0];

  assert.equal(household.incomeCents, 30_000);
  assert.equal(household.incomeUnknown, true);
  assert.equal(household.balanceCents, null);
  assert.equal(company.knownExpenseCents, 5_000);
});

test("covered foreign side with no matching rows is zero rather than unknown", () => {
  const payload = normalizeDashboardPayload(syntheticDashboard(), { source });
  payload.months[0].foreign = [];
  const usd = compareForeign(payload, ["2026-01"]).rows.find(
    (row) => row.currency === "USD",
  )!;
  assert.equal(usd.monthly[0].expenseCents, 0);
  assert.equal(usd.monthly[0].differenceCents, 2_000);
});
