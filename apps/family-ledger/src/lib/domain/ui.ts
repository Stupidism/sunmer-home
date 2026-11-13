import type { LedgerRecord, LedgerScope, SafeRefundLink } from "./types";

export interface LedgerFilters {
  from: string;
  to: string;
  owners: string[];
  accounts: string[];
  categories: string[];
  scopes: LedgerScope[];
  currencies: string[];
  directions: Array<"expense" | "refund" | "income">;
  statuses: Array<"identified" | "pending" | "excluded">;
  min: string;
  max: string;
  search: string;
}

export const EMPTY_FILTERS: LedgerFilters = {
  from: "",
  to: "",
  owners: [],
  accounts: [],
  categories: [],
  scopes: [],
  currencies: [],
  directions: [],
  statuses: [],
  min: "",
  max: "",
  search: "",
};

const listKeys = {
  owner: "owners",
  account: "accounts",
  category: "categories",
  scope: "scopes",
  currency: "currencies",
  direction: "directions",
  status: "statuses",
} as const;

export function parseFilters(params: URLSearchParams): LedgerFilters {
  const result: LedgerFilters = { ...EMPTY_FILTERS };
  result.from = params.get("from") ?? "";
  result.to = params.get("to") ?? "";
  result.min = params.get("min") ?? "";
  result.max = params.get("max") ?? "";
  result.search = params.get("q") ?? "";
  for (const [queryKey, field] of Object.entries(listKeys)) {
    (result[field] as string[]) = [...new Set(params.getAll(queryKey))].filter(
      Boolean,
    );
  }
  return result;
}

export function serializeFilters(
  filters: LedgerFilters,
  extra?: URLSearchParams,
): string {
  const params = new URLSearchParams(extra);
  for (const key of ["from", "to", "min", "max", "q", ...Object.keys(listKeys)])
    params.delete(key);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.min) params.set("min", filters.min);
  if (filters.max) params.set("max", filters.max);
  if (filters.search) params.set("q", filters.search);
  for (const [queryKey, field] of Object.entries(listKeys)) {
    for (const value of filters[field]) params.append(queryKey, value);
  }
  return params.toString();
}

export function recordStatus(
  record: LedgerRecord,
): "identified" | "pending" | "excluded" {
  if (record.scope === "pendingIncome" || record.status === "pending")
    return "pending";
  if (record.scope === "excludedIncome") return "excluded";
  return "identified";
}

export function filterLedgerRows(
  rows: readonly LedgerRecord[],
  filters: LedgerFilters,
): LedgerRecord[] {
  const query = filters.search.trim().toLocaleLowerCase("zh-CN");
  const minCents =
    filters.min === "" ? null : Math.round(Number(filters.min) * 100);
  const maxCents =
    filters.max === "" ? null : Math.round(Number(filters.max) * 100);
  return rows.filter((row) => {
    const amount = Math.abs(row.cents);
    return (
      (!filters.from || row.date >= filters.from) &&
      (!filters.to || row.date <= filters.to) &&
      (!filters.owners.length || filters.owners.includes(row.owner)) &&
      (!filters.accounts.length ||
        filters.accounts.includes(row.accountLabel)) &&
      (!filters.categories.length ||
        filters.categories.includes(row.category)) &&
      (!filters.scopes.length || filters.scopes.includes(row.scope)) &&
      (!filters.currencies.length ||
        filters.currencies.includes(row.currency)) &&
      (!filters.directions.length ||
        filters.directions.includes(row.direction)) &&
      (!filters.statuses.length ||
        filters.statuses.includes(recordStatus(row))) &&
      (minCents === null || !Number.isFinite(minCents) || amount >= minCents) &&
      (maxCents === null || !Number.isFinite(maxCents) || amount <= maxCents) &&
      (!query ||
        [
          row.id,
          row.originalId,
          row.category,
          row.merchant,
          row.description,
          row.accountLabel,
          row.owner,
          row.purpose,
        ]
          .join(" ")
          .toLocaleLowerCase("zh-CN")
          .includes(query))
    );
  });
}

export function trendFromFilteredRows(rows: readonly LedgerRecord[]) {
  const months = new Map<string, number>();
  for (const row of rows)
    months.set(row.month, (months.get(row.month) ?? 0) + row.cents);
  return [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, cents]) => ({ key, cents }));
}

export function currencyTotalsAndAverages(
  rows: readonly LedgerRecord[],
  selectedMonths: readonly string[],
) {
  const denominator = selectedMonths.length;
  const totals = new Map<string, number>();
  for (const row of rows)
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.cents);
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, totalCents]) => ({
      currency,
      totalCents,
      averageCents: denominator ? totalCents / denominator : null,
      monthCount: denominator,
    }));
}

export function monthsOverlappingDateRange(
  months: readonly string[],
  from: string,
  to: string,
): string[] {
  return months.filter((month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    const end = new Date(Date.UTC(year, monthNumber, 0))
      .toISOString()
      .slice(0, 10);
    return (!from || end >= from) && (!to || `${month}-01` <= to);
  });
}

export interface RefundGroup {
  expense: LedgerRecord;
  links: SafeRefundLink[];
  refunds: LedgerRecord[];
}

export type RefundAssociationStatus =
  | "all"
  | "full"
  | "partial"
  | "pending"
  | "unallocated";

export function refundGroupStatus(
  group: RefundGroup,
): Exclude<RefundAssociationStatus, "all" | "unallocated"> {
  const confirmed = group.links
    .filter((link) => link.status === "confirmed")
    .reduce((total, link) => total + link.allocationCents, 0);
  if (group.links.some((link) => link.status === "pending")) return "pending";
  return confirmed >= group.expense.cents ? "full" : "partial";
}

export function refundAccountingForDisplay(
  matchedGroups: readonly RefundGroup[],
  status: RefundAssociationStatus,
) {
  const groups = matchedGroups.filter(
    (group) => status === "all" || refundGroupStatus(group) === status,
  );
  const byScopeCurrency = new Map<
    string,
    {
      scope: LedgerScope;
      currency: string;
      groupCount: number;
      expenseCents: number;
      confirmedCents: number;
      pendingCents: number;
      remainingCents: number;
    }
  >();
  for (const group of groups) {
    const confirmedCents = group.links
      .filter((link) => link.status === "confirmed")
      .reduce((total, link) => total + link.allocationCents, 0);
    const pendingCents = group.links
      .filter((link) => link.status === "pending")
      .reduce((total, link) => total + link.allocationCents, 0);
    const key = `${group.expense.scope}\0${group.expense.currency}`;
    const total = byScopeCurrency.get(key) ?? {
      scope: group.expense.scope,
      currency: group.expense.currency,
      groupCount: 0,
      expenseCents: 0,
      confirmedCents: 0,
      pendingCents: 0,
      remainingCents: 0,
    };
    total.groupCount += 1;
    total.expenseCents += group.expense.cents;
    total.confirmedCents += confirmedCents;
    total.pendingCents += pendingCents;
    total.remainingCents += Math.max(0, group.expense.cents - confirmedCents);
    byScopeCurrency.set(key, total);
  }
  return {
    groups,
    totals: [...byScopeCurrency.values()].sort(
      (left, right) =>
        left.scope.localeCompare(right.scope) ||
        left.currency.localeCompare(right.currency),
    ),
  };
}

export function refundGroupsForFilters(
  allRows: readonly LedgerRecord[],
  filteredRows: readonly LedgerRecord[],
  links: readonly SafeRefundLink[],
): RefundGroup[] {
  const byId = new Map(allRows.map((row) => [row.id, row]));
  const matches = new Set(filteredRows.map((row) => row.id));
  const grouped = new Map<string, SafeRefundLink[]>();
  for (const link of links)
    grouped.set(link.expenseTransactionId, [
      ...(grouped.get(link.expenseTransactionId) ?? []),
      link,
    ]);
  return [...grouped].flatMap(([expenseId, groupLinks]) => {
    const expense = byId.get(expenseId);
    const refunds = groupLinks.flatMap(
      (link) => byId.get(link.refundTransactionId) ?? [],
    );
    if (
      !expense ||
      (!matches.has(expenseId) && !refunds.some((row) => matches.has(row.id)))
    )
      return [];
    return [{ expense, links: groupLinks, refunds }];
  });
}

export function refundRemainders(
  rows: readonly LedgerRecord[],
  links: readonly SafeRefundLink[],
) {
  return rows
    .filter((row) => row.cents < 0)
    .map((record) => {
      const allocatedCents = links
        .filter((link) => link.refundTransactionId === record.id)
        .reduce((total, link) => total + link.allocationCents, 0);
      return {
        record,
        allocatedCents,
        remainingCents: Math.max(0, Math.abs(record.cents) - allocatedCents),
      };
    })
    .filter((item) => item.remainingCents > 0);
}

export function comparisonCell(
  categoryCents: number | undefined,
  monthCovered: boolean,
): { known: boolean; cents: number | null } {
  if (categoryCents !== undefined) return { known: true, cents: categoryCents };
  return monthCovered
    ? { known: true, cents: 0 }
    : { known: false, cents: null };
}

export function knownAggregate(values: Array<number | null>): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
