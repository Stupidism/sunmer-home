import type { ClassificationScheme, LedgerRecord, LedgerScope, SafeRefundLink } from "./types";

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
  months: string[];
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
  months: [],
};

/** A small, deterministic identity for an exact UI draft/snapshot combination. */
export function previewFingerprint(parts: readonly unknown[]): string {
  return JSON.stringify(parts);
}

const listKeys = {
  owner: "owners",
  account: "accounts",
  category: "categories",
  scope: "scopes",
  currency: "currencies",
  direction: "directions",
  status: "statuses",
  month: "months",
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

/** Keep ledger filters between ledger pages, but never leak comparison-only state. */
export function ledgerNavigationQuery(
  pathname: string,
  destination: string,
  params: URLSearchParams,
): string {
  const scheme = params.get("scheme");
  if (pathname === "/compare" || destination === "/compare") {
    const result = new URLSearchParams();
    if (scheme) result.set("scheme", scheme);
    return result.toString();
  }
  const result = new URLSearchParams(params);
  for (const key of [...result.keys()])
    if (key.startsWith("compare")) result.delete(key);
  return result.toString();
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
    const localDate = row.date.slice(0, 10);
    return (
      (!filters.from || localDate >= filters.from) &&
      (!filters.to || localDate <= filters.to) &&
      (!filters.months.length || filters.months.includes(row.month)) &&
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

export interface ClassificationRanking {
  scheme: ClassificationScheme;
  mainLabel: string;
  subLabel: string;
  status: LedgerRecord["classifications"][ClassificationScheme]["status"];
  cents: number;
  count: number;
  rows: LedgerRecord[];
}

/** Presentation-only signed rollups. Refunds remain negative and unmapped rows stay visible. */
export function classificationRankings(
  rows: readonly LedgerRecord[],
  scheme: ClassificationScheme,
): ClassificationRanking[] {
  const groups = new Map<string, ClassificationRanking>();
  for (const row of rows) {
    const value = row.classifications[scheme];
    const mainLabel = value.mainLabel ?? "未映射";
    const subLabel = value.subLabel ?? (row.sourceCategory || "未映射");
    const key = `${mainLabel}\0${subLabel}\0${value.status}`;
    const current = groups.get(key) ?? {
      scheme,
      mainLabel,
      subLabel,
      status: value.status,
      cents: 0,
      count: 0,
      rows: [],
    };
    current.cents += row.cents;
    current.count += 1;
    current.rows.push(row);
    groups.set(key, current);
  }
  return [...groups.values()].sort(
    (left, right) => right.cents - left.cents || left.mainLabel.localeCompare(right.mainLabel, "zh-CN"),
  );
}

export function dailyNetSpending(rows: readonly LedgerRecord[]) {
  const days = new Map<string, { key: string; cents: number; count: number }>();
  for (const row of rows) {
    const key = row.date.slice(0, 10);
    const value = days.get(key) ?? { key, cents: 0, count: 0 };
    value.cents += row.cents;
    value.count += 1;
    days.set(key, value);
  }
  return [...days.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function classificationPending(row: LedgerRecord, scheme: ClassificationScheme) {
  const status = row.classifications[scheme].status;
  return status === "pending" || status === "inferred";
}

export type TransactionSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

export function transactionRowsForDisplay(
  rows: readonly LedgerRecord[],
  options: {
    scheme: ClassificationScheme;
    search?: string;
    accounts?: readonly string[];
    showExcluded?: boolean;
    pendingOnly?: boolean;
    sort?: TransactionSort;
  },
) {
  const query = options.search?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const result = rows.filter((row) =>
    (options.showExcluded || row.scope !== "excludedIncome") &&
    (!options.pendingOnly || recordStatus(row) === "pending" || classificationPending(row, options.scheme)) &&
    (!options.accounts?.length || options.accounts.includes(row.accountLabel)) &&
    (!query || [row.merchant, row.accountLabel, row.description, row.purpose]
      .join(" ").toLocaleLowerCase("zh-CN").includes(query)),
  );
  const sort = options.sort ?? "date-desc";
  return [...result].sort((left, right) => {
    if (sort === "amount-desc") return Math.abs(right.cents) - Math.abs(left.cents) || right.date.localeCompare(left.date);
    if (sort === "amount-asc") return Math.abs(left.cents) - Math.abs(right.cents) || right.date.localeCompare(left.date);
    if (sort === "date-asc") return left.date.localeCompare(right.date) || left.id.localeCompare(right.id);
    return right.date.localeCompare(left.date) || left.id.localeCompare(right.id);
  });
}


export interface ChartPoint {
  key: string;
  cents: number;
  ratio: number;
  startsSegment: boolean;
}

/** Calendar-proportional positions; daily gaps start a new line segment. */
export function calendarChartPoints(
  rows: readonly { key: string; cents: number }[],
): ChartPoint[] {
  if (!rows.length) return [];
  const daily = rows.every((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.key));
  const values = rows.map((row, index) =>
    daily ? Date.parse(`${row.key}T00:00:00Z`) / 86_400_000 : index,
  );
  const first = values[0];
  const range = Math.max(1, values.at(-1)! - first);
  return rows.map((row, index) => ({
    ...row,
    ratio: (values[index] - first) / range,
    startsSegment: index === 0 || (daily && values[index] - values[index - 1] > 1),
  }));
}

export function refundAllocationRows(group: RefundGroup) {
  const refunds = new Map(group.refunds.map((row) => [row.id, row]));
  return group.links.map((link) => {
    const refund = refunds.get(link.refundTransactionId);
    const validAllocation = Number.isFinite(link.allocationCents) && link.allocationCents > 0;
    const compatible = validAllocation && Boolean(refund) && refund!.currency === link.currency && group.expense.currency === link.currency && refund!.scope === group.expense.scope;
    const compatibilityReason = !validAllocation
      ? "分配金额无效，未计入"
      : !refund
        ? "关联退款记录不在当前快照，未计入"
        : refund.currency !== link.currency || group.expense.currency !== link.currency
          ? "币种边界不一致，未计入"
          : refund.scope !== group.expense.scope
            ? "账本范围不一致，未计入"
            : null;
    return {
      link,
      refund: refund ?? null,
      compatible,
      compatibilityReason,
      appliedCents: compatible ? link.allocationCents : null,
    };
  });
}

export function refundGroupResidual(group: RefundGroup) {
  const confirmedCents = refundAllocationRows(group).reduce(
    (total, item) => total + (item.compatible && item.link.status === "confirmed" ? item.link.allocationCents : 0),
    0,
  );
  return { confirmedCents, residualCents: Math.max(0, group.expense.cents - confirmedCents) };
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
  const allocations = refundAllocationRows(group);
  const confirmed = allocations
    .filter((item) => item.compatible && item.link.status === "confirmed")
    .reduce((total, item) => total + item.link.allocationCents, 0);
  if (allocations.some((item) => item.compatible && item.link.status === "pending")) return "pending";
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
    const allocations = refundAllocationRows(group);
    const confirmedCents = allocations
      .filter((item) => item.compatible && item.link.status === "confirmed")
      .reduce((total, item) => total + item.link.allocationCents, 0);
    const pendingCents = allocations
      .filter((item) => item.compatible && item.link.status === "pending")
      .reduce((total, item) => total + item.link.allocationCents, 0);
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
        .filter((link) => link.refundTransactionId === record.id && Number.isFinite(link.allocationCents) && link.allocationCents > 0 && link.currency === record.currency)
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
