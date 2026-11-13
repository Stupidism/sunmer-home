import {
  createAccountResolver,
  ownerKey,
  type AccountResolver,
} from "./account-aliases";
import {
  LEDGER_SCOPES,
  type DashboardPayload,
  type Json,
  type LedgerMonth,
  type LedgerRecord,
  type LedgerScope,
  type SafeSource,
  type TransactionFilters,
} from "./types";
import { emptyClassifications } from "./classification";

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MORTGAGE_CATEGORIES = [
  "房贷还款账户转入",
  "房贷月供",
  "房贷备款",
] as const;
const RESERVE_CATEGORIES = new Set<string>(["房贷还款账户转入", "房贷备款"]);
const PAYMENT_CATEGORY = "房贷月供";
export const JS_MIN_SAFE_INTEGER = -Number.MAX_SAFE_INTEGER;
export const JS_MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

const scopeSet = new Set<string>(LEDGER_SCOPES);

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function requiredObject(
  value: Json | undefined,
  field: string,
): Record<string, Json> {
  if (!isRecord(value)) throw new Error(`${field} must be an object`);
  return value;
}

function optionalObject(
  value: Json | undefined,
  field: string,
): Record<string, Json> | null {
  if (value === null || value === undefined) return null;
  return requiredObject(value, field);
}

function requiredArray(value: Json | undefined, field: string): Json[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return value;
}

function stringList(value: Json | undefined, field: string): string[] {
  return requiredArray(value, field).map((item, index) => {
    if (typeof item !== "string")
      throw new Error(`${field}[${index}] must be a string`);
    return item;
  });
}

function optionalStringList(value: Json | undefined, field: string): string[] {
  if (value === undefined || value === null) return [];
  return stringList(value, field);
}

function requiredString(
  value: Json | undefined,
  field: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`${field} must be a valid string`);
  }
  return value;
}

function optionalString(value: Json | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requiredCents(value: Json | undefined, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value)
  ) {
    throw new Error(`${field} must be an integer number of cents`);
  }
  return value;
}

function optionalCents(value: Json | undefined, field: string): number | null {
  if (value === null || value === undefined) return null;
  return requiredCents(value, field);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function monthEnd(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return date.toISOString().slice(0, 10);
}

export function isMortgage(record: Pick<LedgerRecord, "category"> & Partial<Pick<LedgerRecord, "sourceCategory">>): boolean {
  return (MORTGAGE_CATEGORIES as readonly string[]).includes(record.sourceCategory ?? record.category);
}

function normalizeRecord(
  raw: Json,
  scope: LedgerScope,
  month: string,
  index: number,
  resolver: AccountResolver,
  source: SafeSource,
): LedgerRecord {
  const value = requiredObject(
    raw,
    `month ${month} scope ${scope} record ${index}`,
  );
  const originalId =
    requiredString(value.id, `record ${index} id`, true) ||
    `${scope}-${month}-${index}`;
  const date = requiredString(value.date, `record ${originalId} date`);
  if (!isValidDate(date) || date.slice(0, 7) !== month) {
    throw new Error(`record ${originalId} does not belong to month ${month}`);
  }
  const cents = requiredCents(value.cents, `record ${originalId} cents`);
  const currency =
    requiredString(
      value.currency,
      `record ${originalId} currency`,
      true,
    ).toUpperCase() || "CNY";
  if (!/^[A-Z]{3}$/.test(currency))
    throw new Error(`record ${originalId} currency is invalid`);
  const account = optionalString(value.account) ?? "";
  const owner = optionalString(value.owner) ?? "未注明归属";
  const direction =
    scope === "income" ||
    scope === "pendingIncome" ||
    scope === "excludedIncome"
      ? "income"
      : cents < 0
        ? "refund"
        : "expense";

  const sourceCategory = optionalString(value.category) ?? "未分类";
  return {
    id: stableRecordId(month, scope, originalId),
    originalId,
    month,
    date,
    cents,
    currency,
    category: sourceCategory,
    sourceCategory,
    classifications: emptyClassifications(),
    merchant: optionalString(value.merchant) ?? "",
    description: optionalString(value.description) ?? "",
    account,
    accountKey: resolver.key(account, owner),
    accountLabel: resolver.label(account, owner),
    owner,
    scope,
    direction,
    status: optionalString(value.status),
    recurrence: optionalString(value.recurrence),
    incomeBasis: optionalString(value.income_basis),
    sourceBasis: optionalString(value.source_basis),
    basis: optionalString(value.basis),
    source,
  };
}

function normalizeRecordList(
  raw: Json | undefined,
  scope: LedgerScope,
  month: string,
  resolver: AccountResolver,
  source: SafeSource,
): LedgerRecord[] {
  return requiredArray(raw, `month ${month} ${scope}.records`).map(
    (item, index) =>
      normalizeRecord(item, scope, month, index, resolver, source),
  );
}

function normalizeOptionalRecordList(
  raw: Json | undefined,
  scope: LedgerScope,
  month: string,
  resolver: AccountResolver,
  source: SafeSource,
): LedgerRecord[] {
  if (raw === undefined || raw === null) return [];
  return normalizeRecordList(raw, scope, month, resolver, source);
}

function mortgageSummary(
  records: LedgerRecord[],
  expected: number,
): LedgerMonth["mortgage"] {
  const rows = records.filter(isMortgage);
  const excluded = sum(rows);
  if (excluded !== expected)
    throw new Error("mortgage funding total does not match its records");
  const reserve = sum(
    rows.filter((row) => RESERVE_CATEGORIES.has(row.category)),
  );
  const payment = sum(rows.filter((row) => row.category === PAYMENT_CATEGORY));
  return {
    excludedCents: excluded,
    reserveCents: reserve,
    paymentCents: payment,
    shortfallCents:
      payment > reserve ? payment - reserve : payment > 0 ? 0 : null,
  };
}

function normalizeIncome(
  raw: Json | undefined,
  month: string,
  resolver: AccountResolver,
  source: SafeSource,
): LedgerMonth["income"] {
  const missing = raw === undefined || raw === null;
  const value = missing ? null : requiredObject(raw, `month ${month} income`);
  const records = normalizeOptionalRecordList(
    value?.records,
    "income",
    month,
    resolver,
    source,
  );
  const pendingRecords = normalizeOptionalRecordList(
    value?.pending_records,
    "pendingIncome",
    month,
    resolver,
    source,
  );
  const excludedRecords = normalizeOptionalRecordList(
    value?.excluded_records,
    "excludedIncome",
    month,
    resolver,
    source,
  );
  const foreignRecords = normalizeOptionalRecordList(
    value?.foreign_records,
    "income",
    month,
    resolver,
    source,
  );
  const known = sum(records);
  const knownTotal = requiredCents(
    value?.known_total_cents === undefined ? 0 : value.known_total_cents,
    `month ${month} income.known_total_cents`,
  );
  const total = optionalCents(
    value?.total_cents,
    `month ${month} income.total_cents`,
  );
  if (known !== knownTotal)
    throw new Error(`month ${month} income known total does not match records`);
  if (records.length ? total !== known : total !== null) {
    throw new Error(
      `month ${month} income total must be null unless supported by records`,
    );
  }

  const rawForeignTotals = optionalObject(
    value?.foreign_totals,
    `month ${month} income.foreign_totals`,
  );
  const foreignTotals: Record<string, number> = {};
  if (rawForeignTotals) {
    for (const [currency, rawAmount] of Object.entries(rawForeignTotals)) {
      if (!/^[A-Z]{3}$/.test(currency))
        throw new Error(`month ${month} foreign currency is invalid`);
      const amount = requiredCents(
        rawAmount,
        `month ${month} foreign total ${currency}`,
      );
      if (
        amount !==
        sum(foreignRecords.filter((row) => row.currency === currency))
      ) {
        throw new Error(
          `month ${month} foreign income total does not match records`,
        );
      }
      foreignTotals[currency] = amount;
    }
  }
  for (const currency of new Set(foreignRecords.map((row) => row.currency))) {
    if (!(currency in foreignTotals))
      throw new Error(
        `month ${month} foreign income total is missing ${currency}`,
      );
  }

  return {
    available: !missing,
    records,
    pendingRecords,
    excludedRecords,
    foreignRecords,
    foreignTotals,
    totalCents: total,
    knownTotalCents: known,
    complete: value?.complete === true,
    notes: missing
      ? ["收入资料未提供，本月收入保持待核。"]
      : stringList(value?.notes, `month ${month} income.notes`),
  };
}

function normalizeMonth(
  raw: Json,
  resolver: AccountResolver,
  source: SafeSource,
): LedgerMonth {
  const value = requiredObject(raw, "months[]");
  const month = requiredString(value.month, "month");
  if (!MONTH_RE.test(month)) throw new Error(`invalid month: ${month}`);
  const household = requiredObject(value.household, `month ${month} household`);
  const companyAvailable =
    value.company !== undefined && value.company !== null;
  const agencyAvailable = value.agency !== undefined && value.agency !== null;
  const company = optionalObject(value.company, `month ${month} company`) ?? {};
  const agency = optionalObject(value.agency, `month ${month} agency`) ?? {};
  const funding = optionalObject(value.funding, `month ${month} funding`) ?? {};
  const householdRecords = normalizeRecordList(
    household.records,
    "household",
    month,
    resolver,
    source,
  );
  const companyRecords = normalizeOptionalRecordList(
    company.records,
    "company",
    month,
    resolver,
    source,
  );
  const agencyRecords = normalizeOptionalRecordList(
    agency.records,
    "agency",
    month,
    resolver,
    source,
  );
  const fundingRecords = normalizeOptionalRecordList(
    funding.records,
    "funding",
    month,
    resolver,
    source,
  );
  const foreign = normalizeOptionalRecordList(
    value.foreign,
    "foreignHousehold",
    month,
    resolver,
    source,
  );

  const householdNet = requiredCents(
    household.net_cents,
    `month ${month} household.net_cents`,
  );
  if (householdNet !== sum(householdRecords)) {
    throw new Error(
      `month ${month} household net total does not match records`,
    );
  }
  const companyNet = optionalCents(
    company.net_cents,
    `month ${month} company.net_cents`,
  );
  if (companyNet !== null && companyNet !== sum(companyRecords)) {
    throw new Error(`month ${month} company total does not match records`);
  }
  const agencyPaid = optionalCents(
    agency.paid_cents,
    `month ${month} agency.paid_cents`,
  );
  const agencyReceived = optionalCents(
    agency.received_cents,
    `month ${month} agency.received_cents`,
  );
  const calculatedPaid = sum(agencyRecords.filter((row) => row.cents > 0));
  const calculatedReceived = -sum(agencyRecords.filter((row) => row.cents < 0));
  if (agencyPaid !== null && agencyPaid !== calculatedPaid) {
    throw new Error(`month ${month} agency paid total does not match records`);
  }
  if (
    agencyPaid === null
      ? agencyReceived !== null
      : agencyReceived !== calculatedReceived
  ) {
    throw new Error(`month ${month} agency received total is inconsistent`);
  }

  return {
    month,
    status: requiredString(value.status, `month ${month} status`),
    notes: stringList(value.notes, `month ${month} notes`),
    coverage: value.coverage === undefined ? null : value.coverage,
    household: { netCents: householdNet, records: householdRecords },
    mortgage: mortgageSummary(
      householdRecords,
      requiredCents(
        value.mortgage_funding_cents,
        `month ${month} mortgage_funding_cents`,
      ),
    ),
    company: {
      available: companyAvailable,
      netCents: companyNet,
      records: companyRecords,
      notes: optionalStringList(company.notes, `month ${month} company.notes`),
    },
    agency: {
      available: agencyAvailable,
      paidCents: agencyPaid,
      receivedCents: agencyReceived,
      records: agencyRecords,
      notes: optionalStringList(agency.notes, `month ${month} agency.notes`),
    },
    funding: {
      records: fundingRecords,
      notes: optionalStringList(funding.notes, `month ${month} funding.notes`),
    },
    foreign,
    pending: requiredArray(value.pending, `month ${month} pending`).map(
      (item, index) => {
        const pending = requiredObject(
          item,
          `month ${month} pending[${index}]`,
        );
        return {
          label: requiredString(
            pending.label,
            `month ${month} pending[${index}].label`,
          ),
          cents: optionalCents(
            pending.cents,
            `month ${month} pending[${index}].cents`,
          ),
          detail: optionalString(pending.detail) ?? "",
        };
      },
    ),
    income: normalizeIncome(value.income, month, resolver, source),
  };
}

export function stableRecordId(
  month: string,
  scope: LedgerScope,
  originalId: string,
): string {
  return `${month}:${scope}:${originalId}`;
}

export function normalizeDashboardPayload(
  raw: Json,
  options: {
    resolver?: AccountResolver;
    source: SafeSource;
  },
): DashboardPayload {
  const value = requiredObject(raw, "dashboard payload");
  if (value.schema_version !== 1) throw new Error("schema_version must be 1");
  const rawMonths = requiredArray(value.months, "months");
  if (!rawMonths.length) throw new Error("months must be a non-empty array");
  const resolver = options.resolver ?? createAccountResolver();
  const months = rawMonths.map((item) =>
    normalizeMonth(item, resolver, options.source),
  );
  const seen = new Set<string>();
  for (const month of months) {
    if (seen.has(month.month))
      throw new Error(`duplicate month: ${month.month}`);
    seen.add(month.month);
  }
  const seenTransactions = new Set<string>();
  for (const record of allTransactions({ months })) {
    if (seenTransactions.has(record.id))
      throw new Error(`duplicate stable transaction id: ${record.id}`);
    seenTransactions.add(record.id);
  }
  months.sort((a, b) => a.month.localeCompare(b.month));
  return {
    schemaVersion: 1,
    months,
    defaultMonths: months.map((month) => month.month),
  };
}

export function sum(rows: readonly Pick<LedgerRecord, "cents">[]): number {
  return rows.reduce((total, row) => {
    const next = total + row.cents;
    if (!Number.isSafeInteger(next))
      throw new Error("ledger sum exceeds the JavaScript safe-integer range");
    return next;
  }, 0);
}

export function allTransactions(
  data: Pick<DashboardPayload, "months">,
): LedgerRecord[] {
  const rows: LedgerRecord[] = [];
  for (const month of data.months) {
    rows.push(
      ...month.household.records,
      ...month.company.records,
      ...month.agency.records,
      ...month.funding.records,
      ...month.foreign,
      ...month.income.records,
      ...month.income.pendingRecords,
      ...month.income.excludedRecords,
      ...month.income.foreignRecords,
    );
  }
  return rows;
}

function accountFilterValues(
  account: string,
  resolver: AccountResolver,
): string[] {
  const value = account.trim();
  if (!value) return [];
  return [resolver.key(value)];
}

function normalizeAccountSelection(
  values: string[] | undefined,
  resolver: AccountResolver,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    for (const key of accountFilterValues(value, resolver)) {
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

function baseFilters(
  filters: TransactionFilters | undefined,
  resolver: AccountResolver,
) {
  const value = filters ?? {};
  const from = value.from && isValidDate(value.from) ? value.from : undefined;
  const to = value.to && isValidDate(value.to) ? value.to : undefined;
  return {
    from,
    to,
    owners: value.owners ?? [],
    accounts: normalizeAccountSelection(value.accounts, resolver),
  };
}

function baseMatch(
  record: LedgerRecord,
  filters: ReturnType<typeof baseFilters>,
): boolean {
  if (filters.from && record.date < filters.from) return false;
  if (filters.to && record.date > filters.to) return false;
  if (filters.owners.length) {
    const key = ownerKey(record.owner);
    if (!filters.owners.includes(key)) return false;
  }
  if (filters.accounts.length && !filters.accounts.includes(record.accountKey))
    return false;
  return true;
}

export function filteredTransactions(
  data: Pick<DashboardPayload, "months">,
  filters: TransactionFilters = {},
  resolver: AccountResolver = createAccountResolver(),
): LedgerRecord[] {
  const base = baseFilters(filters, resolver);
  const scopes = filters.scopes ?? [];
  const categories = filters.categories ?? [];
  const selectedMonths = filters.months ?? [];
  const search = filters.search?.trim().toLowerCase() ?? "";
  const status = filters.status ?? "all";
  const sort = filters.sort ?? "date-desc";
  return allTransactions(data)
    .filter((record) => {
      if (selectedMonths.length && !selectedMonths.includes(record.month))
        return false;
      if (!baseMatch(record, base)) return false;
      if (scopes.length && !scopes.includes(record.scope)) return false;
      if (categories.length && !categories.includes(record.category))
        return false;
      const amount =
        record.direction === "income" ? record.cents : Math.abs(record.cents);
      if (
        filters.min !== null &&
        filters.min !== undefined &&
        amount < filters.min
      )
        return false;
      if (
        filters.max !== null &&
        filters.max !== undefined &&
        amount > filters.max
      )
        return false;
      if (
        status === "identified" &&
        (record.scope === "pendingIncome" || record.scope === "excludedIncome")
      )
        return false;
      if (
        status === "pending" &&
        record.scope !== "pendingIncome" &&
        record.status !== "pending"
      )
        return false;
      if (status === "excluded" && record.scope !== "excludedIncome")
        return false;
      if (search) {
        const text = [
          record.id,
          record.date,
          record.category,
          record.merchant,
          record.description,
          record.account,
          record.owner,
        ]
          .join(" ")
          .toLowerCase();
        if (!text.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "date-asc" && a.date !== b.date)
        return a.date < b.date ? -1 : 1;
      if (sort === "date-desc" && a.date !== b.date)
        return a.date > b.date ? -1 : 1;
      const amountA = Math.abs(a.cents);
      const amountB = Math.abs(b.cents);
      if (sort === "amount-asc" && amountA !== amountB)
        return amountA - amountB;
      if (amountB !== amountA) return amountB - amountA;
      return a.id.localeCompare(b.id);
    });
}

export function summarizeOverview(
  data: Pick<DashboardPayload, "months">,
  options: { excludeMortgage?: boolean } = {},
): {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  savingsRate: number | null;
  incomeComplete: boolean;
  incomeRecognized: boolean;
  incomeMissing: boolean;
  incomeUnknown: boolean;
  foreign: Record<
    string,
    {
      incomeCents: number;
      expenseCents: number;
      balanceCents: number;
      estimated: boolean;
    }
  >;
  months: string[];
} {
  const excludeMortgage = options.excludeMortgage !== false;
  const income: LedgerRecord[] = [];
  const expenses: LedgerRecord[] = [];
  const foreignIncome: LedgerRecord[] = [];
  const foreignExpenses: LedgerRecord[] = [];
  for (const month of data.months) {
    income.push(...month.income.records);
    foreignIncome.push(...month.income.foreignRecords);
    expenses.push(
      ...month.household.records.filter(
        (row) => !excludeMortgage || !isMortgage(row),
      ),
    );
    foreignExpenses.push(...month.foreign);
  }
  const cnyIncome = sum(income);
  const cnyExpense = sum(expenses);
  const complete =
    data.months.length > 0 &&
    data.months.every((month) => month.income.complete);
  const missing = data.months.some((month) => !month.income.available);
  const foreign: Record<
    string,
    {
      incomeCents: number;
      expenseCents: number;
      balanceCents: number;
      estimated: boolean;
    }
  > = {};
  for (const row of [...foreignIncome, ...foreignExpenses]) {
    const item = (foreign[row.currency] ??= {
      incomeCents: 0,
      expenseCents: 0,
      balanceCents: 0,
      estimated: true,
    });
    if (row.direction === "income") item.incomeCents += row.cents;
    else item.expenseCents += row.cents;
  }
  for (const item of Object.values(foreign)) {
    item.balanceCents = item.incomeCents - item.expenseCents;
    item.estimated =
      !complete || item.incomeCents <= 0 || item.expenseCents <= 0;
  }
  return {
    incomeCents: cnyIncome,
    expenseCents: cnyExpense,
    balanceCents: cnyIncome - cnyExpense,
    savingsRate:
      complete && cnyIncome > 0 ? (cnyIncome - cnyExpense) / cnyIncome : null,
    incomeComplete: complete,
    incomeRecognized: income.length > 0,
    incomeMissing: missing,
    incomeUnknown: missing || !complete || income.length === 0,
    foreign,
    months: data.months.map((month) => month.month),
  };
}

export function groupSum(
  rows: readonly LedgerRecord[],
  keyFn: (row: LedgerRecord) => string,
  sortOrder: "amount" | "key" = "amount",
): Array<{ key: string; cents: number; rows: LedgerRecord[] }> {
  const grouped = new Map<
    string,
    { key: string; cents: number; rows: LedgerRecord[] }
  >();
  for (const row of rows) {
    const key = keyFn(row);
    const item = grouped.get(key) ?? { key, cents: 0, rows: [] };
    item.cents = sum([...item.rows, row]);
    item.rows.push(row);
    grouped.set(key, item);
  }
  return [...grouped.values()].sort((a, b) =>
    sortOrder === "key"
      ? a.key.localeCompare(b.key)
      : b.cents - a.cents || a.key.localeCompare(b.key),
  );
}

export function compareMonths(
  data: Pick<DashboardPayload, "months">,
  selected: string[],
  scope: "household" | "company",
): Array<{
  month: string;
  incomeCents: number | null;
  expenseCents: number | null;
  knownExpenseCents: number;
  balanceCents: number | null;
  savingsRate: number | null;
  incomeUnknown: boolean;
  complete: boolean;
  categories: Array<{ key: string; cents: number; rows: LedgerRecord[] }>;
}> {
  const selectedSet = new Set(selected);
  return data.months
    .filter((month) => selectedSet.has(month.month))
    .map((month) => {
      const records =
        scope === "company"
          ? month.company.records.filter((row) => row.currency === "CNY")
          : month.household.records.filter(
              (row) => row.currency === "CNY" && !isMortgage(row),
            );
      const income =
        scope === "company"
          ? []
          : month.income.records.filter((row) => row.currency === "CNY");
      const incomeTotal = sum(income);
      const expense = sum(records);
      const companyUnknown =
        scope === "company" && month.company.netCents === null;
      const incomeUnknown =
        scope === "company" ||
        !month.income.available ||
        !month.income.complete;
      return {
        month: month.month,
        incomeCents: scope === "company" ? null : incomeTotal,
        expenseCents: companyUnknown ? null : expense,
        knownExpenseCents: expense,
        balanceCents: incomeUnknown ? null : incomeTotal - expense,
        savingsRate:
          scope === "company" || !month.income.complete || incomeTotal <= 0
            ? null
            : (incomeTotal - expense) / incomeTotal,
        incomeUnknown,
        complete: !companyUnknown,
        categories: groupSum(records, (row) => row.category),
      };
    });
}

export function compareForeign(
  data: Pick<DashboardPayload, "months">,
  selected: string[],
): {
  months: string[];
  rows: Array<{
    currency: string;
    monthly: Array<{
      month: string;
      incomeCents: number | null;
      expenseCents: number | null;
      differenceCents: number | null;
    }>;
    incomeCents: number | null;
    expenseCents: number | null;
    differenceCents: number | null;
  }>;
} {
  const selectedSet = new Set(selected);
  const months = data.months.filter((month) => selectedSet.has(month.month));
  const currencies = new Set<string>();
  for (const month of data.months) {
    for (const row of [...month.income.foreignRecords, ...month.foreign])
      currencies.add(row.currency);
  }
  return {
    months: months.map((month) => month.month),
    rows: [...currencies].sort().map((currency) => {
      const monthly = months.map((month) => {
        const incomeRows = month.income.foreignRecords.filter(
          (row) => row.currency === currency,
        );
        const expenseRows = month.foreign.filter(
          (row) => row.currency === currency,
        );
        const incomeCents = incomeRows.length
          ? sum(incomeRows)
          : month.income.available && month.income.complete
            ? 0
            : null;
        const expenseCents = expenseRows.length ? sum(expenseRows) : 0;
        return {
          month: month.month,
          incomeCents,
          expenseCents,
          differenceCents:
            incomeCents !== null && expenseCents !== null
              ? incomeCents - expenseCents
              : null,
        };
      });
      const incomeValues = monthly.filter((row) => row.incomeCents !== null);
      const expenseValues = monthly.filter((row) => row.expenseCents !== null);
      const incomeCents = incomeValues.length
        ? sum(incomeValues.map((row) => ({ cents: row.incomeCents as number })))
        : null;
      const expenseCents = expenseValues.length
        ? sum(
            expenseValues.map((row) => ({ cents: row.expenseCents as number })),
          )
        : null;
      return {
        currency,
        monthly,
        incomeCents,
        expenseCents,
        differenceCents:
          incomeCents !== null && expenseCents !== null
            ? incomeCents - expenseCents
            : null,
      };
    }),
  };
}

export function isLedgerScope(value: string): value is LedgerScope {
  return scopeSet.has(value);
}
