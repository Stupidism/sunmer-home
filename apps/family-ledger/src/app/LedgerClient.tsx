"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  allTransactions,
  compareForeign,
  compareMonths,
  groupSum,
  isMortgage,
  sum,
} from "@/lib/domain/monthly";
import {
  rankExpensesAfterConfirmedRefunds,
  type RefundSummary,
} from "@/lib/domain/refunds";
import {
  comparisonCell,
  currencyTotalsAndAverages,
  EMPTY_FILTERS,
  filterLedgerRows,
  knownAggregate,
  monthsOverlappingDateRange,
  parseFilters,
  recordStatus,
  refundAccountingForDisplay,
  refundGroupsForFilters,
  refundRemainders,
  serializeFilters,
  trendFromFilteredRows,
  type LedgerFilters,
  type RefundAssociationStatus,
} from "@/lib/domain/ui";
import type {
  DashboardPayload,
  Json,
  LedgerRecord,
  LedgerScope,
  PurposeHistory,
  SafeRefundLink,
} from "@/lib/domain/types";
import {
  confirmPurposeAction,
  createRefundLinkAction,
} from "./actions/refunds";

export type LedgerView =
  | "overview"
  | "income"
  | "transactions"
  | "compare"
  | "company"
  | "refunds"
  | "reconcile";
type RefundData = {
  summary: RefundSummary;
  links: SafeRefundLink[];
  candidates: Record<
    "household" | "company" | "agency" | "foreignHousehold",
    Array<{
      id: string;
      originalId: string;
      month: string;
      scope: string;
      cents: number;
      currency: string;
      date: string;
      merchant: string;
    }>
  >;
};
const NAV: Array<[LedgerView, string, string]> = [
  ["overview", "/", "总览"],
  ["income", "/income", "收入"],
  ["transactions", "/transactions", "交易"],
  ["compare", "/compare", "月份对比"],
  ["company", "/company", "公司"],
  ["refunds", "/refunds", "退款与冲抵"],
  ["reconcile", "/reconcile", "账单与对账"],
];
const TITLES: Record<LedgerView, [string, string]> = {
  overview: ["家庭总览", "现金发生月口径；退款关联只用于解释与大额消费净额。"],
  income: [
    "收入",
    "普通收入按原币种分别汇总，不把退款、公司代收或投入算作收入。",
  ],
  transactions: ["交易明细", "逐笔查看账本边界、识别状态、来源和用途确认。"],
  compare: [
    "月份对比",
    "已覆盖月份没有某分类时显示 0；只有缺少资料才显示待核。",
  ],
  company: [
    "公司与代付",
    "经营费、代收代付和投入退回分别呈现；期间差额不代表当前欠款。",
  ],
  refunds: [
    "退款与冲抵",
    "原交易和退款仍按各自发生日期计入现金流，关联不会再次扣减。",
  ],
  reconcile: ["账单与对账", "按月检查账户覆盖、来源批次、备注和待核事项。"],
};
const SCOPE_LABELS: Record<string, string> = {
  household: "家庭",
  company: "公司",
  agency: "代付",
  funding: "投入/退回",
  foreignHousehold: "家庭外币",
  income: "已识别收入",
  pendingIncome: "待确认收入",
  excludedIncome: "明确非收入",
};

export default function LedgerClient({
  view,
  payload,
  refunds,
  purposeHistory,
  role,
  username,
}: {
  view: LedgerView;
  payload: DashboardPayload;
  refunds: RefundData;
  purposeHistory: PurposeHistory[];
  role: "admin" | "viewer";
  username: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationQuery = searchParams.toString();
  const writtenQuery = useRef<string | null>(null);
  const records = useMemo(() => allTransactions(payload), [payload]);
  const values = useMemo(
    () => ({
      owners: unique(records.map((row) => row.owner)),
      accounts: unique(records.map((row) => row.accountLabel)),
      categories: unique(records.map((row) => row.category)),
      currencies: unique(records.map((row) => row.currency)),
    }),
    [records],
  );
  const [filters, setFilters] = useState<LedgerFilters>(EMPTY_FILTERS);
  const [filtersReady, setFiltersReady] = useState(false);
  const [detailIds, setDetailIds] = useState<string[] | null>(null);
  const filtered = useMemo(
    () => filterLedgerRows(records, filters),
    [records, filters],
  );
  const detail =
    detailIds?.flatMap((id) => records.find((row) => row.id === id) ?? []) ??
    null;
  const query = serializeFilters(filters);
  useEffect(() => {
    if (writtenQuery.current === locationQuery) {
      writtenQuery.current = null;
      return;
    }
    setFilters(parseFilters(new URLSearchParams(locationQuery)));
    setFiltersReady(true);
  }, [locationQuery]);
  useEffect(() => {
    if (!filtersReady || view === "compare" || query === locationQuery) return;
    writtenQuery.current = query;
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [filtersReady, locationQuery, pathname, query, router, view]);
  const open = (rows: LedgerRecord[]) =>
    setDetailIds(rows.map((row) => row.id));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={query ? `/?${query}` : "/"} className="brand">
          <span>FL</span>
          <strong>家庭账本</strong>
        </Link>
        <nav aria-label="主要导航">
          {NAV.map(([key, href, label]) => (
            <Link
              key={key}
              href={query && key !== "compare" ? `${href}?${query}` : href}
              aria-current={view === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="account-panel">
          <strong>{username}</strong>
          <small>{role === "admin" ? "管理员" : "只读"}</small>
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setDetailIds(null);
              void signOut({ redirectTo: "/login" });
            }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="page-head">
          <div>
            <p className="eyebrow">Family Ledger</p>
            <h1>{TITLES[view][0]}</h1>
            <p>{TITLES[view][1]}</p>
          </div>
          <span className="period-pill">
            {payload.months.at(0)?.month} — {payload.months.at(-1)?.month}
          </span>
        </header>
        {view !== "compare" && view !== "reconcile" ? (
          <FilterBar
            filters={filters}
            setFilters={setFilters}
            values={values}
          />
        ) : null}
        {view === "overview" ? (
          <Overview
            rows={filtered}
            filters={filters}
            payload={payload}
            refunds={refunds}
            open={open}
          />
        ) : null}
        {view === "income" ? (
          <Income
            rows={filtered}
            filters={filters}
            payload={payload}
            open={open}
          />
        ) : null}
        {view === "transactions" ? (
          <Transactions rows={filtered} open={open} />
        ) : null}
        {view === "compare" ? (
          <ComparisonView payload={payload} open={open} />
        ) : null}
        {view === "company" ? (
          <CompanyByCurrency
            rows={filtered}
            filters={filters}
            payload={payload}
            open={open}
          />
        ) : null}
        {view === "refunds" ? (
          <Refunds
            allRows={records}
            filteredRows={filtered}
            data={refunds}
            role={role}
            open={open}
          />
        ) : null}
        {view === "reconcile" ? <Reconcile payload={payload} /> : null}
      </main>
      {detail ? (
        <DetailDialog
          key={detail.map((row) => row.id).join("|")}
          rows={detail}
          history={purposeHistory}
          role={role}
          onClose={() => setDetailIds(null)}
        />
      ) : null}
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
  values,
}: {
  filters: LedgerFilters;
  setFilters: React.Dispatch<React.SetStateAction<LedgerFilters>>;
  values: {
    owners: string[];
    accounts: string[];
    categories: string[];
    currencies: string[];
  };
}) {
  const update = <K extends keyof LedgerFilters>(
    key: K,
    value: LedgerFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const count = Object.values(filters).reduce(
    (total, value) =>
      total + (Array.isArray(value) ? value.length : Number(Boolean(value))),
    0,
  );
  return (
    <section className="filters" aria-label="账本筛选">
      <label>
        从
        <input
          type="date"
          value={filters.from}
          onChange={(event) => update("from", event.target.value)}
        />
      </label>
      <label>
        到
        <input
          type="date"
          value={filters.to}
          onChange={(event) => update("to", event.target.value)}
        />
      </label>
      <MultiFilter
        label="成员"
        values={values.owners}
        selected={filters.owners}
        onChange={(value) => update("owners", value)}
      />
      <MultiFilter
        label="账户"
        values={values.accounts}
        selected={filters.accounts}
        onChange={(value) => update("accounts", value)}
      />
      <MultiFilter
        label="分类"
        values={values.categories}
        selected={filters.categories}
        onChange={(value) => update("categories", value)}
      />
      <MultiFilter
        label="范围"
        values={Object.keys(SCOPE_LABELS)}
        labels={SCOPE_LABELS}
        selected={filters.scopes}
        onChange={(value) => update("scopes", value as LedgerScope[])}
      />
      <MultiFilter
        label="币种"
        values={values.currencies}
        selected={filters.currencies}
        onChange={(value) => update("currencies", value)}
      />
      <MultiFilter
        label="方向"
        values={["expense", "refund", "income"]}
        labels={{ expense: "支出", refund: "退款冲抵", income: "收入" }}
        selected={filters.directions}
        onChange={(value) =>
          update("directions", value as LedgerFilters["directions"])
        }
      />
      <MultiFilter
        label="状态"
        values={["identified", "pending", "excluded"]}
        labels={{ identified: "已识别", pending: "待确认", excluded: "已排除" }}
        selected={filters.statuses}
        onChange={(value) =>
          update("statuses", value as LedgerFilters["statuses"])
        }
      />
      <label>
        最小金额
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.min}
          onChange={(event) => update("min", event.target.value)}
        />
      </label>
      <label>
        最大金额
        <input
          type="number"
          min="0"
          step="0.01"
          value={filters.max}
          onChange={(event) => update("max", event.target.value)}
        />
      </label>
      <label className="search-label">
        搜索
        <input
          type="search"
          placeholder="商户、说明、ID"
          value={filters.search}
          onChange={(event) => update("search", event.target.value)}
        />
      </label>
      {count ? (
        <button className="quiet" onClick={() => setFilters(EMPTY_FILTERS)}>
          清除 {count} 项
        </button>
      ) : null}
    </section>
  );
}

function MultiFilter({
  label,
  values,
  labels = {},
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  labels?: Record<string, string>;
  selected: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = values.filter((value) =>
    (labels[value] ?? value).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <details className="popover">
      <summary>
        {label}
        {selected.length ? ` · ${selected.length}` : ""}
      </summary>
      <div className="popover-panel">
        <input
          aria-label={`搜索${label}`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`搜索${label}`}
        />
        {shown.map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() =>
                onChange(
                  selected.includes(value)
                    ? selected.filter((item) => item !== value)
                    : [...selected, value],
                )
              }
            />
            {(labels[value] ?? value) || "未注明"}
          </label>
        ))}
      </div>
    </details>
  );
}

function Overview({
  rows,
  filters,
  payload,
  refunds,
  open,
}: {
  rows: LedgerRecord[];
  filters: LedgerFilters;
  payload: DashboardPayload;
  refunds: RefundData;
  open: (rows: LedgerRecord[]) => void;
}) {
  const expenses = rows.filter(
    (row) =>
      row.scope === "household" && row.currency === "CNY" && !isMortgage(row),
  );
  const incomes = rows.filter(
    (row) => row.scope === "income" && row.currency === "CNY",
  );
  const foreign = rows.filter(
    (row) =>
      row.scope === "foreignHousehold" ||
      (row.scope === "income" && row.currency !== "CNY"),
  );
  const categories = groupSum(expenses, (row) => row.category).sort(
    (a, b) => Math.abs(b.cents) - Math.abs(a.cents),
  );
  const max = Math.max(1, ...categories.map((item) => Math.abs(item.cents)));
  const ranked = rankExpensesAfterConfirmedRefunds(expenses, refunds.links);
  const selectedMonthNames = monthsOverlappingDateRange(
    payload.months.map((month) => month.month),
    filters.from,
    filters.to,
  );
  const selectedMonths = payload.months.filter((month) =>
    selectedMonthNames.includes(month.month),
  );
  const mortgageExcluded = rows.filter(
    (row) =>
      row.scope === "household" && row.currency === "CNY" && isMortgage(row),
  );
  const large = ranked.filter((item) => item.remainingCents > 0).slice(0, 8),
    full = ranked.filter((item) => item.remainingCents === 0),
    known =
      selectedMonths.length > 0 &&
      selectedMonths.every(
        (month) => month.income.available && month.income.complete,
      );
  return (
    <>
      <div className="metric-grid">
        <Metric
          label="已识别收入"
          value={known ? money(sum(incomes)) : `已知 ${money(sum(incomes))}`}
          tone="income"
        />
        <Metric
          label="净开支（实际流水）"
          value={money(sum(expenses))}
          tone="expense"
        />
        <Metric
          label="暂估结余"
          value={known ? money(sum(incomes) - sum(expenses)) : "待核"}
        />
        <Metric
          label="待核事项"
          value={String(
            selectedMonths.reduce(
              (total, month) => total + month.pending.length,
              0,
            ),
          )}
        />
        <Metric label="已排除的房贷资金" value={money(sum(mortgageExcluded))} />
      </div>
      {!selectedMonths.length ? (
        <Notice>所选日期没有覆盖任何账本月份。</Notice>
      ) : !known ? (
        <Notice>
          所选月份收入资料不完整；收入卡仅显示已知小计，暂估结余保持待核。
        </Notice>
      ) : null}
      {!incomes.length ? (
        <Notice>所选条件下没有已知匹配收入；这不等同于完整收入为零。</Notice>
      ) : null}
      <Notice>
        “净开支（实际流水）”按现有口径排除上方单列的房贷资金，金额没有重分类或改写。
      </Notice>
      {Object.entries(groupCurrency(foreign)).map(
        ([currency, currencyRows]) => {
          const incomeRows = currencyRows.filter(
            (row) => row.direction === "income",
          );
          const expenseRows = currencyRows.filter(
            (row) => row.direction !== "income",
          );
          return (
            <Notice key={currency}>
              家庭外币 {currency}：已记录收入{" "}
              {incomeRows.length
                ? money(sum(incomeRows), currency)
                : "未记录（待核）"}
              ；已记录开支{" "}
              {expenseRows.length
                ? money(sum(expenseRows), currency)
                : "未记录（待核）"}
              。不与人民币换算或相加。
            </Notice>
          );
        },
      )}
      <div className="two-col">
        <Card
          title="月度净开支趋势"
          hint="与当前筛选后的家庭人民币记录完全一致；退款按到账月计入。"
        >
          <Bars rows={trendFromFilteredRows(expenses)} />
        </Card>
        <Card title="分类支出" hint="点击分类打开可浏览明细表">
          {categories.slice(0, 10).map((item) => (
            <button
              className="bar-row"
              key={item.key}
              onClick={() => open(item.rows)}
            >
              <span>{item.key}</span>
              <i
                style={{
                  width: `${Math.max(3, (Math.abs(item.cents) / max) * 100)}%`,
                }}
              />
              <strong>{money(item.cents)}</strong>
            </button>
          ))}
        </Card>
      </div>
      <Card
        title="大额消费（已确认退款后的剩余金额）"
        hint="关联只解释剩余成本，不改写月度现金流。"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>分类 / 商户</th>
                <th>原支出</th>
                <th>已退</th>
                <th>剩余</th>
              </tr>
            </thead>
            <tbody>
              {large.map(({ record, remainingCents, confirmedCents }) => (
                <tr
                  className="clickable"
                  key={record.id}
                  onClick={() => open([record])}
                >
                  <td>{record.date}</td>
                  <td>
                    {record.category}
                    <small>{record.merchant}</small>
                  </td>
                  <td>{money(record.cents, record.currency)}</td>
                  <td>{money(confirmedCents, record.currency)}</td>
                  <td>
                    <strong>{money(remainingCents, record.currency)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {full.length ? (
          <p className="card-foot">
            另有 <Link href="/refunds">{full.length} 笔已全额冲抵</Link>。
          </p>
        ) : null}
      </Card>
    </>
  );
}

function Income({
  rows,
  filters,
  payload,
  open,
}: {
  rows: LedgerRecord[];
  filters: LedgerFilters;
  payload: DashboardPayload;
  open: (rows: LedgerRecord[]) => void;
}) {
  const ordinary = rows.filter((row) => row.scope === "income"),
    pending = rows.filter((row) => row.scope === "pendingIncome"),
    excluded = rows.filter((row) => row.scope === "excludedIncome");
  const selectedMonths = monthsOverlappingDateRange(
    payload.months.map((month) => month.month),
    filters.from,
    filters.to,
  );
  const summaries = currencyTotalsAndAverages(ordinary, selectedMonths);
  const incomeCoverageKnown =
    selectedMonths.length > 0 &&
    payload.months
      .filter((month) => selectedMonths.includes(month.month))
      .every((month) => month.income.available && month.income.complete);
  return (
    <>
      <div className="metric-grid">
        {summaries.flatMap((item) => [
          <Metric
            key={`${item.currency}-total`}
            label={`${item.currency} 已识别收入`}
            value={money(item.totalCents, item.currency)}
            tone="income"
          />,
          <Metric
            key={`${item.currency}-average`}
            label={`${item.currency} 月均（所选 ${item.monthCount} 月）`}
            value={
              item.averageCents === null
                ? "待核"
                : money(item.averageCents, item.currency)
            }
          />,
        ])}
        <Metric label="待确认" value={`${pending.length} 笔`} />
        <Metric label="明确非收入" value={`${excluded.length} 笔`} />
      </div>
      {!ordinary.length ? (
        <Notice>
          所选条件下没有已知匹配收入；
          {incomeCoverageKnown
            ? "相关月份来源已覆盖，但不把空结果展示成完整收入为零。"
            : "相关月份资料仍可能不完整。"}
        </Notice>
      ) : null}
      <Card
        title="普通已识别收入"
        hint="每个币种独立计算；公司、代付、退款与银行冲正不在此表"
      >
        <RowTable rows={ordinary} open={open} />
      </Card>
      <div className="two-col">
        <Card title="待确认收入">
          <RowTable rows={pending} open={open} empty="没有待确认记录" />
        </Card>
        <Card title="明确非收入">
          <RowTable rows={excluded} open={open} empty="没有排除记录" />
        </Card>
      </div>
      {payload.months.some(
        (month) =>
          selectedMonths.includes(month.month) && !month.income.complete,
      ) ? (
        <Notice>部分月份收入资料不完整，总额和结余不应解释为完整收入。</Notice>
      ) : null}
    </>
  );
}

function Transactions({
  rows,
  open,
}: {
  rows: LedgerRecord[];
  open: (rows: LedgerRecord[]) => void;
}) {
  const [sort, setSort] = useState("date-desc"),
    [page, setPage] = useState(0);
  const sorted = [...rows].sort((a, b) =>
    sort === "amount-desc"
      ? Math.abs(b.cents) - Math.abs(a.cents)
      : sort === "amount-asc"
        ? Math.abs(a.cents) - Math.abs(b.cents)
        : sort === "date-asc"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
  );
  const pages = Math.max(1, Math.ceil(sorted.length / 40)),
    safePage = Math.min(page, pages - 1);
  return (
    <Card
      title={`${rows.length} 笔交易`}
      action={
        <label>
          排序
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(0);
            }}
          >
            <option value="date-desc">日期从新到旧</option>
            <option value="date-asc">日期从旧到新</option>
            <option value="amount-desc">金额从大到小</option>
            <option value="amount-asc">金额从小到大</option>
          </select>
        </label>
      }
    >
      <RowTable
        rows={sorted.slice(safePage * 40, safePage * 40 + 40)}
        open={open}
        showBoundary
      />
      <div className="pager">
        <button disabled={!safePage} onClick={() => setPage(safePage - 1)}>
          上一页
        </button>
        <span>
          {safePage + 1} / {pages}
        </span>
        <button
          disabled={safePage + 1 >= pages}
          onClick={() => setPage(safePage + 1)}
        >
          下一页
        </button>
      </div>
    </Card>
  );
}

function ComparisonView({
  payload,
  open,
}: {
  payload: DashboardPayload;
  open: (rows: LedgerRecord[]) => void;
}) {
  const records = allTransactions(payload);
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationQuery = searchParams.toString();
  const allMonths = payload.months.map((month) => month.month);
  const ownerValues = unique(records.map((row) => row.owner));
  const accountValues = unique(records.map((row) => row.accountLabel));
  const currencyValues = unique(records.map((row) => row.currency));
  const [owners, setOwners] = useState<string[]>([]),
    [accounts, setAccounts] = useState<string[]>([]),
    [currencies, setCurrencies] = useState<string[]>([]),
    [selected, setSelected] = useState(allMonths.slice(-3)),
    [scope, setScope] = useState<"household" | "company">("household"),
    [ready, setReady] = useState(false);
  const writtenQuery = useRef<string | null>(null);
  const restoringQuery = useRef(false);
  useEffect(() => {
    if (writtenQuery.current === locationQuery) {
      writtenQuery.current = null;
      return;
    }
    restoringQuery.current = true;
    const query = new URLSearchParams(locationQuery);
    const restoredMonths = query
      .getAll("compareMonth")
      .filter((month) => allMonths.includes(month));
    setSelected(restoredMonths.length ? restoredMonths : allMonths.slice(-3));
    setScope(query.get("compareScope") === "company" ? "company" : "household");
    setOwners(
      query
        .getAll("compareOwner")
        .filter((value) => ownerValues.includes(value)),
    );
    setAccounts(
      query
        .getAll("compareAccount")
        .filter((value) => accountValues.includes(value)),
    );
    setCurrencies(
      query
        .getAll("compareCurrency")
        .filter((value) => currencyValues.includes(value)),
    );
    setReady(true);
  }, [locationQuery]);
  useEffect(() => {
    if (!ready) return;
    if (restoringQuery.current) {
      restoringQuery.current = false;
      return;
    }
    const query = new URLSearchParams(locationQuery);
    for (const key of [
      "compareMonth",
      "compareScope",
      "compareOwner",
      "compareAccount",
      "compareCurrency",
    ])
      query.delete(key);
    selected.forEach((month) => query.append("compareMonth", month));
    query.set("compareScope", scope);
    owners.forEach((owner) => query.append("compareOwner", owner));
    accounts.forEach((account) => query.append("compareAccount", account));
    currencies.forEach((currency) => query.append("compareCurrency", currency));
    const nextQuery = query.toString();
    if (nextQuery === locationQuery) return;
    writtenQuery.current = nextQuery;
    router.replace(`/compare${nextQuery ? `?${nextQuery}` : ""}`, {
      scroll: false,
    });
  }, [
    accounts,
    currencies,
    locationQuery,
    owners,
    ready,
    router,
    scope,
    selected,
  ]);
  const filtered = useMemo(() => {
    const keep = (row: LedgerRecord) =>
      (!owners.length || owners.includes(row.owner)) &&
      (!accounts.length || accounts.includes(row.accountLabel)) &&
      (!currencies.length || currencies.includes(row.currency));
    return {
      ...payload,
      months: payload.months.map((month) => ({
        ...month,
        household: {
          ...month.household,
          records: month.household.records.filter(keep),
        },
        company: {
          ...month.company,
          records: month.company.records.filter(keep),
        },
        foreign: month.foreign.filter(keep),
        income: {
          ...month.income,
          records: month.income.records.filter(keep),
          foreignRecords: month.income.foreignRecords.filter(keep),
          pendingRecords: month.income.pendingRecords.filter(keep),
          excludedRecords: month.income.excludedRecords.filter(keep),
        },
      })),
    };
  }, [payload, owners, accounts, currencies]);
  return (
    <>
      <section className="filters">
        <MultiFilter
          label="成员"
          values={ownerValues}
          selected={owners}
          onChange={setOwners}
        />
        <MultiFilter
          label="账户"
          values={accountValues}
          selected={accounts}
          onChange={setAccounts}
        />
        <MultiFilter
          label="币种"
          values={currencyValues}
          selected={currencies}
          onChange={setCurrencies}
        />
        {owners.length + accounts.length + currencies.length ? (
          <button
            className="quiet"
            onClick={() => {
              setOwners([]);
              setAccounts([]);
              setCurrencies([]);
            }}
          >
            清除对比筛选
          </button>
        ) : null}
      </section>
      <Compare
        payload={filtered}
        open={open}
        selected={selected}
        setSelected={setSelected}
        scope={scope}
        setScope={setScope}
      />
    </>
  );
}

function Compare({
  payload,
  open,
  selected,
  setSelected,
  scope,
  setScope,
}: {
  payload: DashboardPayload;
  open: (rows: LedgerRecord[]) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  scope: "household" | "company";
  setScope: React.Dispatch<React.SetStateAction<"household" | "company">>;
}) {
  const allMonths = payload.months.map((month) => month.month);
  const [saving, setSaving] = useState(0);
  const comparison = compareMonths(payload, selected, scope),
    foreign = compareForeign(payload, selected);
  const companyForeign = groupCurrency(
    payload.months
      .filter((month) => selected.includes(month.month))
      .flatMap((month) => month.company.records)
      .filter((row) => row.currency !== "CNY"),
  );
  const categories = unique(
    comparison.flatMap((month) =>
      month.categories.map((category) => category.key),
    ),
  );
  return (
    <>
      <section className="filters compare-controls">
        <MultiFilter
          label="对比月份"
          values={allMonths}
          selected={selected}
          onChange={setSelected}
        />
        <label>
          范围
          <select
            value={scope}
            onChange={(event) =>
              setScope(event.target.value as "household" | "company")
            }
          >
            <option value="household">家庭</option>
            <option value="company">公司经营</option>
          </select>
        </label>
        <label className="slider">
          节流试算 {saving}%
          <input
            type="range"
            min="0"
            max="50"
            value={saving}
            onChange={(event) => setSaving(Number(event.target.value))}
          />
        </label>
        <button className="quiet" onClick={() => setSaving(0)}>
          重置试算
        </button>
      </section>
      {selected.length < 2 ? (
        <Notice>请至少选择两个月。</Notice>
      ) : (
        <>
          <Card
            title="月份总览（CNY）"
            hint="仅汇总人民币；账本实际值不受节流试算影响，模拟值单独标注。"
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>已识别收入（CNY）</th>
                    <th>实际净开支</th>
                    <th>实际结余</th>
                    <th>模拟开支</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((month) => (
                    <tr key={month.month}>
                      <th>{month.month}</th>
                      <td>
                        {scope === "company"
                          ? "不适用"
                          : month.incomeUnknown
                            ? `已知 ${money(month.incomeCents ?? 0)}（不完整）`
                            : money(month.incomeCents ?? 0)}
                      </td>
                      <td>
                        {month.expenseCents === null
                          ? `已知 ${money(month.knownExpenseCents)}`
                          : money(month.expenseCents)}
                      </td>
                      <td>
                        {month.balanceCents === null || month.incomeUnknown
                          ? "待核"
                          : money(month.balanceCents)}
                      </td>
                      <td>
                        {month.expenseCents === null
                          ? "待核"
                          : money(month.expenseCents * (1 - saving / 100))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card
            title="分类 × 月份（CNY）"
            hint="0 表示该月资料已覆盖但没有匹配记录；待核表示该月资料不可用。"
          >
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>分类</th>
                    {comparison.map((month) => (
                      <th key={month.month}>{month.month}</th>
                    ))}
                    <th>实际合计</th>
                    <th>实际月均</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => {
                    const cells = comparison.map((month) => {
                      const found = month.categories.find(
                        (item) => item.key === category,
                      );
                      return {
                        ...comparisonCell(found?.cents, month.complete),
                        rows: found?.rows ?? [],
                      };
                    });
                    const total = knownAggregate(
                      cells.map((cell) => cell.cents),
                    );
                    return (
                      <tr key={category}>
                        <th>{category}</th>
                        {cells.map((cell, index) => (
                          <td key={comparison[index].month}>
                            {cell.known ? (
                              cell.rows.length ? (
                                <button
                                  className="amount-link"
                                  onClick={() => open(cell.rows)}
                                >
                                  {money(cell.cents ?? 0)}
                                </button>
                              ) : (
                                money(0)
                              )
                            ) : (
                              "待核"
                            )}
                          </td>
                        ))}
                        <td>{total === null ? "待核" : money(total)}</td>
                        <td>
                          {total === null
                            ? "待核"
                            : money(total / comparison.length)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {scope === "household" ? (
            <Card
              title="家庭外币收入与开支"
              hint="各币种独立显示，不换算、不与公司混合。"
            >
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>币种</th>
                      {foreign.months.map((month) => (
                        <th key={month}>{month}</th>
                      ))}
                      <th>收入合计</th>
                      <th>开支合计</th>
                      <th>期间差额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foreign.rows.map((row) => (
                      <tr key={row.currency}>
                        <th>{row.currency}</th>
                        {row.monthly.map((month) => (
                          <td key={month.month}>
                            {month.differenceCents === null
                              ? "待核"
                              : money(month.differenceCents, row.currency)}
                          </td>
                        ))}
                        <td>
                          {row.incomeCents === null
                            ? "待核"
                            : money(row.incomeCents, row.currency)}
                        </td>
                        <td>
                          {row.expenseCents === null
                            ? "待核"
                            : money(row.expenseCents, row.currency)}
                        </td>
                        <td>
                          {row.differenceCents === null
                            ? "待核"
                            : money(row.differenceCents, row.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
          {scope === "company"
            ? Object.entries(companyForeign).map(([currency, rows]) => (
                <Notice key={currency}>
                  公司外币 {currency} 已知期间流水净额：
                  {money(sum(rows), currency)}。该原币种记录未纳入上述 CNY
                  总览或分类合计。
                </Notice>
              ))
            : null}
        </>
      )}
    </>
  );
}

function CompanyByCurrency({
  rows,
  filters,
  payload,
  open,
}: {
  rows: LedgerRecord[];
  filters: LedgerFilters;
  payload: DashboardPayload;
  open: (rows: LedgerRecord[]) => void;
}) {
  const companyRows = rows.filter((row) =>
    ["company", "agency", "funding"].includes(row.scope),
  );
  const months = payload.months.filter(
    (month) =>
      (!filters.from || `${month.month}-31` >= filters.from) &&
      (!filters.to || `${month.month}-01` <= filters.to),
  );
  const coverage =
    months.length > 0 &&
    months.every(
      (month) => month.company.available && month.company.netCents !== null,
    );
  const currencies = unique(companyRows.map((row) => row.currency));
  if (!currencies.length)
    return (
      <Notice>
        {coverage
          ? "所选范围已覆盖，但没有匹配的公司流水。"
          : "所选范围公司资料待核，当前没有已知匹配流水。"}
      </Notice>
    );
  return (
    <>
      {currencies.map((currency) => {
        const currencyRows = companyRows.filter(
            (row) => row.currency === currency,
          ),
          operating = currencyRows.filter((row) => row.scope === "company"),
          agency = currencyRows.filter((row) => row.scope === "agency"),
          funding = currencyRows.filter((row) => row.scope === "funding");
        return (
          <section key={currency}>
            <h2>{currency} · 原币种独立核算</h2>
            <div className="metric-grid">
              <Metric
                label="经营费（已知期间净额）"
                value={money(sum(operating), currency)}
                tone="expense"
              />
              <Metric
                label="代收代付（期间差额）"
                value={money(sum(agency), currency)}
              />
              <Metric
                label="投入 / 退回"
                value={money(sum(funding), currency)}
              />
              <Metric
                label="资料状态"
                value={coverage ? "所选月份已覆盖" : "部分待核（显示已知小计）"}
              />
            </div>
            <Notice>
              以下均为所选期间流水差额，不表示公司当前欠款或应收余额。
            </Notice>
            <div className="three-col">
              <Card title="经营费">
                <RowTable rows={operating} open={open} />
              </Card>
              <Card title="代收代付">
                <RowTable rows={agency} open={open} />
              </Card>
              <Card title="投入 / 退回">
                <RowTable rows={funding} open={open} />
              </Card>
            </div>
          </section>
        );
      })}
    </>
  );
}

function Refunds({
  allRows,
  filteredRows,
  data,
  role,
  open,
}: {
  allRows: LedgerRecord[];
  filteredRows: LedgerRecord[];
  data: RefundData;
  role: "admin" | "viewer";
  open: (rows: LedgerRecord[]) => void;
}) {
  const [status, setStatus] = useState<RefundAssociationStatus>("all");
  const matchedGroups = refundGroupsForFilters(
    allRows,
    filteredRows,
    data.links,
  );
  const { groups, totals } = refundAccountingForDisplay(matchedGroups, status);
  const filteredRefunds = filteredRows.filter(
    (row) =>
      row.cents < 0 &&
      ["household", "company", "agency", "foreignHousehold"].includes(
        row.scope,
      ),
  );
  const remainders = refundRemainders(filteredRefunds, data.links);
  return (
    <>
      <Notice>
        组纳入规则：原支出或任一关联退款命中日期、成员、账户、分类、币种等当前筛选时，整组纳入；组内范围外记录仅用于解释，不改变其实际月份现金流。
      </Notice>
      <section className="filters">
        <label>
          关联状态
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as RefundAssociationStatus)
            }
          >
            <option value="all">全部</option>
            <option value="full">全额</option>
            <option value="partial">部分</option>
            <option value="pending">待确认</option>
            <option value="unallocated">未分配</option>
          </select>
        </label>
      </section>
      <div className="metric-grid">
        {totals.flatMap((total) => {
          const key = `${total.scope}-${total.currency}`;
          const label = `${scopeName(total.scope)} · ${total.currency} · ${total.groupCount} 组`;
          return [
            <Metric
              key={`${key}-gross`}
              label={`${label}原支出`}
              value={money(total.expenseCents, total.currency)}
            />,
            <Metric
              key={`${key}-confirmed`}
              label={`${label}已确认冲抵`}
              value={money(total.confirmedCents, total.currency)}
            />,
            <Metric
              key={`${key}-remaining`}
              label={`${label}剩余净额`}
              value={money(total.remainingCents, total.currency)}
            />,
            <Metric
              key={`${key}-pending`}
              label={`${label}待确认分配（未扣减）`}
              value={money(total.pendingCents, total.currency)}
            />,
          ];
        })}
      </div>
      <Card
        title="退款关联组"
        hint="顶部按当前实际显示的组汇总；剩余净额只减已确认分配，待确认金额单列。范围外关联行仍显示以解释整组。"
      >
        {groups.length ? (
          groups.map((group) => {
            const confirmed = group.links
                .filter((link) => link.status === "confirmed")
                .reduce((total, link) => total + link.allocationCents, 0),
              pending = group.links
                .filter((link) => link.status === "pending")
                .reduce((total, link) => total + link.allocationCents, 0),
              remaining = Math.max(0, group.expense.cents - confirmed),
              state = pending
                ? "待确认"
                : confirmed >= group.expense.cents
                  ? "全额"
                  : "部分";
            return (
              <article className="refund-group" key={group.expense.id}>
                <button
                  className="group-head"
                  onClick={() => open([group.expense, ...group.refunds])}
                >
                  <span>
                    <b>{group.expense.date}</b> ·{" "}
                    {group.expense.merchant || group.expense.category}
                    <small>
                      {group.expense.accountLabel} ·{" "}
                      {scopeName(group.expense.scope)} ·{" "}
                      {group.expense.currency}
                    </small>
                  </span>
                  <span>
                    {state} · 原{" "}
                    {money(group.expense.cents, group.expense.currency)}
                    <br />
                    确认 {money(confirmed, group.expense.currency)} · 待确认{" "}
                    {money(pending, group.expense.currency)}
                    <br />
                    剩余净额（仅减已确认）{" "}
                    {money(remaining, group.expense.currency)}
                  </span>
                </button>
                {group.links.map((link) => {
                  const refund = group.refunds.find(
                    (row) => row.id === link.refundTransactionId,
                  );
                  return (
                    <div className="refund-line" key={link.refundTransactionId}>
                      <span>
                        {refund?.date} · {refund?.merchant || "退款"}
                      </span>
                      <span>
                        {money(link.allocationCents, link.currency)} ·{" "}
                        {link.status === "confirmed" ? "已确认" : "待确认"}
                      </span>
                      <span>{evidenceText(link.evidence)}</span>
                    </div>
                  );
                })}
              </article>
            );
          })
        ) : (
          <Empty />
        )}
      </Card>
      <div className="two-col">
        <Card
          title={`未分配余额 · ${remainders.length}`}
          hint="部分关联后仍保留未分配余款。"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>退款</th>
                  <th>已分配</th>
                  <th>未分配</th>
                </tr>
              </thead>
              <tbody>
                {remainders.map(
                  ({ record, allocatedCents, remainingCents }) => (
                    <tr
                      className="clickable"
                      key={record.id}
                      onClick={() => open([record])}
                    >
                      <td>
                        {record.date} · {record.merchant || record.category}
                        <small>
                          {scopeName(record.scope)} · {record.accountLabel}
                        </small>
                      </td>
                      <td>{money(allocatedCents, record.currency)}</td>
                      <td>{money(remainingCents, record.currency)}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card
          title="新增证据关联"
          hint="默认不选择交易；仅允许同范围、同币种，并由服务器复核余量。"
        >
          {role === "admin" ? (
            <RefundForm rows={allRows} links={data.links} />
          ) : (
            <p>当前账号为只读权限。</p>
          )}
        </Card>
      </div>
    </>
  );
}

function RefundForm({
  rows,
  links,
}: {
  rows: LedgerRecord[];
  links: SafeRefundLink[];
}) {
  const router = useRouter(),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [expenseId, setExpenseId] = useState(""),
    [refundId, setRefundId] = useState("");
  const expenses = rows.filter(
      (row) =>
        row.cents > 0 &&
        ["household", "company", "agency", "foreignHousehold"].includes(
          row.scope,
        ),
    ),
    refunds = rows.filter(
      (row) =>
        row.cents < 0 &&
        ["household", "company", "agency", "foreignHousehold"].includes(
          row.scope,
        ),
    );
  const expense = rows.find((row) => row.id === expenseId),
    refund = rows.find((row) => row.id === refundId),
    refundRemaining = refund
      ? (refundRemainders([refund], links)[0]?.remainingCents ?? 0)
      : null;
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !expense ||
          !refund ||
          expense.scope !== refund.scope ||
          expense.currency !== refund.currency
        ) {
          setMessage("原支出与退款必须属于同一范围和币种。");
          return;
        }
        const form = new FormData(event.currentTarget);
        start(async () => {
          const result = await createRefundLinkAction({
            expenseTransactionId: expense.id,
            refundTransactionId: refund.id,
            allocationCents: Math.round(Number(form.get("amount")) * 100),
            status: form.get("status"),
            evidence: { note: form.get("note"), source: form.get("source") },
          });
          setMessage(result.ok ? "已由服务器保存并验证。" : result.error);
          if (result.ok) router.refresh();
        });
      }}
    >
      <label>
        原支出（输入日期、账户、商户或 ID）
        <input
          list="expense-options"
          value={expenseId}
          onChange={(event) => setExpenseId(event.target.value)}
          placeholder="请选择原支出"
          required
        />
      </label>
      <datalist id="expense-options">
        {expenses.map((row) => (
          <option key={row.id} value={row.id}>
            {row.date} · {row.accountLabel} · {row.merchant || row.category} ·{" "}
            {money(row.cents, row.currency)}
          </option>
        ))}
      </datalist>
      <label>
        退款（输入日期、账户、商户或 ID）
        <input
          list="refund-options"
          value={refundId}
          onChange={(event) => setRefundId(event.target.value)}
          placeholder="请选择退款"
          required
        />
      </label>
      <datalist id="refund-options">
        {refunds.map((row) => (
          <option key={row.id} value={row.id}>
            {row.date} · {row.accountLabel} · {row.merchant || row.category} ·{" "}
            {money(row.cents, row.currency)}
          </option>
        ))}
      </datalist>
      {refund && refundRemaining !== null ? (
        <small>该退款尚可分配：{money(refundRemaining, refund.currency)}</small>
      ) : null}
      <label>
        分配金额
        <input name="amount" type="number" min="0.01" step="0.01" required />
      </label>
      <label>
        状态
        <select name="status">
          <option value="confirmed">已确认</option>
          <option value="pending">待确认</option>
        </select>
      </label>
      <label>
        证据说明
        <textarea name="note" minLength={3} required />
      </label>
      <label>
        证据来源
        <input name="source" required placeholder="回单、沟通记录等" />
      </label>
      <button disabled={pending}>{pending ? "保存中…" : "保存关联"}</button>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}

function Reconcile({ payload }: { payload: DashboardPayload }) {
  const [selected, setSelected] = useState(payload.months.at(-1)?.month ?? "");
  const month =
    payload.months.find((item) => item.month === selected) ??
    payload.months.at(-1);
  if (!month) return <Empty />;
  const records = [
    ...month.household.records,
    ...month.company.records,
    ...month.agency.records,
    ...month.funding.records,
    ...month.foreign,
    ...month.income.records,
    ...month.income.pendingRecords,
    ...month.income.excludedRecords,
    ...month.income.foreignRecords,
  ];
  const notes = [
    ...month.notes,
    ...month.company.notes,
    ...month.agency.notes,
    ...month.funding.notes,
    ...month.income.notes,
  ];
  const sources = unique(
    records.map(
      (row) =>
        `${row.source.label}|${row.source.originalFileLabel ?? ""}|${row.source.sha256}`,
    ),
  );
  return (
    <>
      <section className="filters">
        <label>
          对账月份
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {payload.months.map((item) => (
              <option key={item.month}>{item.month}</option>
            ))}
          </select>
        </label>
      </section>
      <Card
        title={`${month.month} · ${monthStatusName(month.status)}`}
        hint={`${month.pending.length + month.income.pendingRecords.length} 项待核`}
      >
        <div className="reconcile-grid">
          <div>
            <h3>账户覆盖</h3>
            <Coverage value={month.coverage} />
          </div>
          <div>
            <h3>月份与各范围备注</h3>
            {notes.length ? (
              <ul>
                {notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            ) : (
              <p>无备注</p>
            )}
            <h3>待核用途与收入</h3>
            {month.pending.length || month.income.pendingRecords.length ? (
              <ul>
                {month.pending.map((item, index) => (
                  <li key={`pending-${index}`}>
                    <b>{item.label}</b>
                    {item.cents === null
                      ? " · 金额待核"
                      : ` · ${money(item.cents)}`}
                    <br />
                    <small>{item.detail}</small>
                  </li>
                ))}
                {month.income.pendingRecords.map((row) => (
                  <li key={row.id}>
                    <b>
                      {row.date} · {row.merchant || row.category}
                    </b>{" "}
                    · {money(row.cents, row.currency)}
                    <br />
                    <small>
                      {row.basis || row.description || "收入依据待核"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>无待核项</p>
            )}
          </div>
          <div>
            <h3>导入批次与原始文件</h3>
            {sources.map((source) => {
              const [label, original, hash] = source.split("|");
              return (
                <p key={source}>
                  <b>{label}</b>
                  <br />
                  {original ? (
                    <small>
                      原始文件：{original}
                      <br />
                    </small>
                  ) : null}
                  <small>仪表盘输入 SHA-256 · {hash}</small>
                </p>
              );
            })}
            <p className="muted">
              只显示安全文件名；本地绝对路径不会传到浏览器。
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

function Coverage({ value }: { value: Json | null }) {
  if (value === null) return <p>未提供覆盖信息</p>;
  if (Array.isArray(value))
    return (
      <div className="coverage-list">
        {value.map((item, index) =>
          item !== null && typeof item === "object" ? (
            <dl className="coverage" key={index}>
              {Object.entries(item).map(([key, field]) => (
                <div key={key}>
                  <dt>{labelKey(key)}</dt>
                  <dd>{readable(field)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p key={index}>{readable(item)}</p>
          ),
        )}
      </div>
    );
  if (typeof value === "object")
    return (
      <dl className="coverage">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{labelKey(key)}</dt>
            <dd>{readable(item)}</dd>
          </div>
        ))}
      </dl>
    );
  return <p>{readable(value)}</p>;
}

function DetailDialog({
  rows,
  history,
  role,
  onClose,
}: {
  rows: LedgerRecord[];
  history: PurposeHistory[];
  role: "admin" | "viewer";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    previous = useRef<HTMLElement | null>(null),
    router = useRouter(),
    [index, setIndex] = useState(0),
    [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    row = rows[index];
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous.current?.focus();
  }, []);
  useEffect(() => {
    setMessage("");
  }, [row?.id]);
  if (!row) return null;
  const rowHistory = history.filter((item) => item.transactionId === row.id);
  return (
    <dialog
      ref={dialog}
      className="detail-dialog"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="detail-title"
    >
      <header>
        <div>
          <p className="eyebrow">
            交易 {index + 1} / {rows.length}
          </p>
          <h2 id="detail-title">{row.category}</h2>
        </div>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </header>
      {rows.length > 1 ? (
        <div className="detail-list">
          <strong>分类合计：{money(sum(rows), row.currency)}</strong>
          {rows.map((item, itemIndex) => (
            <button
              key={item.id}
              aria-current={itemIndex === index}
              onClick={() => setIndex(itemIndex)}
            >
              {item.date} · {item.merchant || item.category} ·{" "}
              {money(item.cents, item.currency)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="detail-amount">{money(row.cents, row.currency)}</div>
      <dl className="detail-grid">
        <div>
          <dt>日期</dt>
          <dd>{row.date}</dd>
        </div>
        <div>
          <dt>交易对方</dt>
          <dd>{row.merchant || "未注明"}</dd>
        </div>
        <div>
          <dt>账户</dt>
          <dd>{row.accountLabel || "未注明"}</dd>
        </div>
        <div>
          <dt>范围 / 方向</dt>
          <dd>
            {scopeName(row.scope)} · {directionName(row)}
          </dd>
        </div>
        <div>
          <dt>识别状态</dt>
          <dd>{statusName(recordStatus(row))}</dd>
        </div>
        <div>
          <dt>归属</dt>
          <dd>{row.owner}</dd>
        </div>
        <div>
          <dt>原始 ID</dt>
          <dd>{row.originalId}</dd>
        </div>
        <div>
          <dt>用途 / 依据</dt>
          <dd>
            {row.purpose ||
              row.basis ||
              row.incomeBasis ||
              row.sourceBasis ||
              "待确认"}
          </dd>
        </div>
        <div>
          <dt>原始来源文件</dt>
          <dd>{row.source.originalFileLabel || "未记录文件标签"}</dd>
        </div>
        <div>
          <dt>导入批次</dt>
          <dd>
            {row.source.label}
            <br />
            <small>仪表盘输入 SHA-256 · {row.source.sha256}</small>
          </dd>
        </div>
      </dl>
      {row.description ? (
        <p className="description">{row.description}</p>
      ) : null}
      <section>
        <h3>确认历史</h3>
        {rowHistory.length ? (
          <ul>
            {rowHistory.map((item) => (
              <li key={item.confirmedAt}>
                {item.purpose} · {item.confirmedBy} ·{" "}
                {new Date(item.confirmedAt).toLocaleString("zh-CN")}
                {item.active ? "（当前）" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">尚无用途确认记录。</p>
        )}
      </section>
      {role === "admin" ? (
        <form
          key={row.id}
          className="purpose-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await confirmPurposeAction({
                transactionId: row.id,
                purpose: form.get("purpose"),
                evidence: {
                  note: form.get("note"),
                  source: "dashboard purpose note",
                },
              });
              setMessage(result.ok ? "用途备注已保存。" : result.error);
              if (result.ok) router.refresh();
            });
          }}
        >
          <h3>记录用途备注</h3>
          <p>新增可审计备注，不改变会计分类或金额。</p>
          <label>
            用途
            <input
              name="purpose"
              required
              minLength={1}
              maxLength={500}
              defaultValue={row.purpose ?? ""}
            />
          </label>
          <label>
            确认依据
            <input name="note" required minLength={3} maxLength={2000} />
          </label>
          <button disabled={pending}>{pending ? "保存中…" : "保存备注"}</button>
          {message ? <p role="status">{message}</p> : null}
        </form>
      ) : null}
      <footer>
        <button
          disabled={index === 0}
          onClick={() => setIndex((value) => value - 1)}
        >
          上一笔
        </button>
        <button
          disabled={index === rows.length - 1}
          onClick={() => setIndex((value) => value + 1)}
        >
          下一笔
        </button>
      </footer>
    </dialog>
  );
}

function RowTable({
  rows,
  open,
  empty = "当前条件下没有记录",
  showBoundary = false,
}: {
  rows: LedgerRecord[];
  open: (rows: LedgerRecord[]) => void;
  empty?: string;
  showBoundary?: boolean;
}) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>分类 / 对方</th>
            {showBoundary ? (
              <>
                <th>范围 / 方向</th>
                <th>状态</th>
              </>
            ) : null}
            <th>归属</th>
            <th>账户</th>
            <th>金额</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="clickable"
              tabIndex={0}
              onClick={() => open([row])}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") open([row]);
              }}
            >
              <td>{row.date}</td>
              <td>
                {row.category}
                <small>{row.merchant || row.description}</small>
              </td>
              {showBoundary ? (
                <>
                  <td>
                    {scopeName(row.scope)}
                    <small>{directionName(row)}</small>
                  </td>
                  <td>{statusName(recordStatus(row))}</td>
                </>
              ) : null}
              <td>{row.owner}</td>
              <td>{row.accountLabel}</td>
              <td className={row.cents < 0 ? "negative" : ""}>
                {money(row.cents, row.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Bars({ rows }: { rows: Array<{ key: string; cents: number }> }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.cents)));
  return (
    <div className="chart" role="img" aria-label="按月净开支柱状图">
      {rows.map((row) => (
        <div key={row.key}>
          <span>{money(row.cents)}</span>
          <i
            style={{
              height: `${Math.max(3, (Math.abs(row.cents) / max) * 120)}px`,
            }}
          />
          <small>{row.key.slice(5)}</small>
        </div>
      ))}
    </div>
  );
}
function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <section className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
function Card({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <header>
        <div>
          <h2>{title}</h2>
          {hint ? <p>{hint}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
function Empty({ text = "暂无记录" }: { text?: string }) {
  return <p className="empty">{text}</p>;
}
function Notice({ children }: { children: React.ReactNode }) {
  return <p className="notice">{children}</p>;
}
function money(cents: number, currency = "CNY"): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
}
function groupCurrency(rows: LedgerRecord[]): Record<string, LedgerRecord[]> {
  return rows.reduce<Record<string, LedgerRecord[]>>((result, row) => {
    (result[row.currency] ??= []).push(row);
    return result;
  }, {});
}
function evidenceText(value: unknown): React.ReactNode {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "证据已记录";
  const record = value as Record<string, unknown>,
    sources = Array.isArray(record.evidence_sources)
      ? (record.evidence_sources as Array<Record<string, unknown>>)
      : [];
  return (
    <>
      {[record.kind, record.basis, record.reviewed_at]
        .filter((item) => typeof item === "string")
        .join(" · ") ||
        [record.source, record.note]
          .filter((item) => typeof item === "string")
          .join(" · ") ||
        "证据已记录"}
      {sources.map((source, index) => (
        <small key={index}>
          {String(source.label ?? "来源")} · SHA-256{" "}
          {String(source.sha256 ?? "")}
        </small>
      ))}
    </>
  );
}
function scopeName(scope: string): string {
  return SCOPE_LABELS[scope] ?? scope;
}
function directionName(row: LedgerRecord): string {
  return row.direction === "refund"
    ? "退款冲抵"
    : row.direction === "income"
      ? "收入"
      : "支出";
}
function statusName(status: ReturnType<typeof recordStatus>): string {
  return status === "pending"
    ? "待确认"
    : status === "excluded"
      ? "已排除"
      : "已识别";
}
function monthStatusName(status: string): string {
  return status === "provisional" ? "暂算" : status;
}
function readable(value: Json): string {
  if (value === null) return "待核";
  if (Array.isArray(value)) return value.map(readable).join("、");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, item]) => `${labelKey(key)}：${readable(item)}`)
      .join("；");
  if (typeof value === "boolean") return value ? "已覆盖" : "未覆盖";
  return String(value);
}
function labelKey(key: string): string {
  return (
    (
      {
        owner: "成员",
        account: "账户",
        coverage: "覆盖区间",
        note: "备注",
        accounts: "账户",
        covered: "已覆盖",
        missing: "缺口",
        notes: "备注",
        source: "来源",
        status: "状态",
        household_review: "家庭账单复核",
        company_review: "公司账单复核",
        agency_review: "代付复核",
        income_review: "收入复核",
      } as Record<string, string>
    )[key] ?? key.replaceAll("_", " ")
  );
}
