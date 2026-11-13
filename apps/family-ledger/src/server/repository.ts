import { allTransactions, isMortgage, sum } from "@/lib/domain/monthly";
import {
  listRefundCandidates,
  summarizeRefunds,
  validateRefundLink,
  type RefundCandidate,
  type RefundLinkLike,
} from "@/lib/domain/refunds";
import type {
  DashboardPayload,
  Json,
  LedgerDirection,
  LedgerMonth,
  LedgerRecord,
  LedgerScope,
  SafeSource,
  PurposeHistory,
  SafeRefundLink,
} from "@/lib/domain/types";
import {
  safeSourceFileLabel,
  sanitizeLedgerJson,
  sanitizeOptionalLedgerJson,
} from "@/lib/domain/sanitize";
import type pg from "pg";
import { getPool, withTransaction } from "./db/pool";
import { emptyClassifications } from "@/lib/domain/classification";
import { constructDashboardSnapshot } from "@/lib/domain/snapshot";
import type { CategoryDefinition, ClassificationScheme, PublishedDashboardSnapshot, RefundOverview, SourceCategoryRule, TaxonomySnapshot, TransactionClassification } from "@/lib/domain/types";

export type QueryClient = pg.Pool | pg.PoolClient;
export const DASHBOARD_WRITE_LOCK = "family_ledger:dashboard-write";

interface TransactionRow {
  stable_id: string;
  month: string;
  original_id: string;
  scope: LedgerScope;
  transaction_date: string;
  cents: string;
  currency: string;
  account: string;
  account_key: string;
  account_label: string;
  raw: Json;
  source_label: string;
  source_sha256: string;
  purpose?: string | null;
}

interface MonthRow {
  month: string;
  report_status: string;
  report_meta: Json;
  coverage: Json | null;
  income_available: boolean;
  income_complete: boolean;
}

function safeText(value: Json | null | undefined): string {
  const sanitized = sanitizeOptionalLedgerJson(value ?? null);
  return typeof sanitized === "string" ? sanitized : "";
}

function optionalText(value: Json | null | undefined): string | undefined {
  const valueText = safeText(value);
  return valueText || undefined;
}

function jsonObject(
  value: Json | null | undefined,
  field: string,
): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function optionalJsonObject(
  value: Json | null | undefined,
  field: string,
): Record<string, Json> | null {
  if (value === null || value === undefined) return null;
  return jsonObject(value, field);
}

function requiredInteger(
  value: Json | null | undefined,
  field: string,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer`);
  }
  return value;
}

function optionalInteger(
  value: Json | null | undefined,
  field: string,
): number | null {
  if (value === null || value === undefined) return null;
  return requiredInteger(value, field);
}

function jsonStrings(value: Json | undefined): string[] {
  if (value === undefined || value === null) return [];
  const sanitized =
    value === undefined ? null : sanitizeOptionalLedgerJson(value);
  if (!Array.isArray(sanitized))
    throw new Error("stored JSON string list is invalid");
  return sanitized.map((item) => {
    if (typeof item !== "string")
      throw new Error("stored JSON string list is invalid");
    return item;
  });
}

function recordDirection(scope: LedgerScope, cents: number): LedgerDirection {
  if (
    scope === "income" ||
    scope === "pendingIncome" ||
    scope === "excludedIncome"
  )
    return "income";
  return cents < 0 ? "refund" : "expense";
}

function toRecord(row: TransactionRow): LedgerRecord {
  const raw = jsonObject(row.raw, `transaction ${row.stable_id} raw`);
  const account = safeText(row.account);
  const owner = safeText(raw.owner) || "未注明归属";
  const cents = Number(row.cents);
  if (!Number.isSafeInteger(cents))
    throw new Error(`stored cents are invalid for ${row.stable_id}`);
  const source: SafeSource = {
    label: safeText(row.source_label),
    sha256: row.source_sha256,
    hashKind: "dashboard-input",
    originalFileLabel: safeSourceFileLabel(raw.source),
  };
  const accountKey = safeText(row.account_key) || account;
  const sourceCategory = safeText(raw.category) || "未分类";
  return {
    id: row.stable_id,
    originalId: row.original_id,
    month: row.month,
    date: row.transaction_date,
    cents,
    currency: row.currency,
    category: sourceCategory,
    sourceCategory,
    classifications: emptyClassifications(),
    merchant: safeText(raw.merchant),
    description: safeText(raw.description),
    account,
    accountKey,
    accountLabel: safeText(row.account_label) || accountKey,
    owner,
    scope: row.scope,
    direction: recordDirection(row.scope, cents),
    status: optionalText(raw.status),
    recurrence: optionalText(raw.recurrence),
    incomeBasis: optionalText(raw.income_basis),
    sourceBasis: optionalText(raw.source_basis),
    basis: optionalText(raw.basis),
    purpose: row.purpose ? safeText(row.purpose) : null,
    source,
  };
}

function safeRefundEvidence(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const safe = sanitizeLedgerJson(value as Json) as Record<string, unknown>;
  const sources = Array.isArray(value.evidence_sources)
    ? value.evidence_sources
    : [];
  safe.evidence_sources = sources.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const label =
      typeof source.path === "string"
        ? source.path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1)
        : undefined;
    const sha256 =
      typeof source.sha256 === "string" && /^[a-f0-9]{64}$/i.test(source.sha256)
        ? source.sha256
        : undefined;
    return label && sha256 ? [{ label: safeText(label), sha256 }] : [];
  });
  return safe;
}

function mortgageFor(
  records: LedgerRecord[],
  raw: Record<string, Json>,
): LedgerMonth["mortgage"] {
  const expected = requiredInteger(
    raw.mortgage_funding_cents,
    "mortgage_funding_cents",
  );
  const rows = records.filter(isMortgage);
  const excluded = sum(rows);
  if (!Number.isSafeInteger(expected) || excluded !== expected) {
    throw new Error(
      `stored mortgage total is inconsistent for ${records[0]?.month ?? "unknown month"}`,
    );
  }
  const reserve = sum(rows.filter((row) => row.sourceCategory !== "房贷月供"));
  const payment = sum(rows.filter((row) => row.sourceCategory === "房贷月供"));
  return {
    excludedCents: excluded,
    reserveCents: reserve,
    paymentCents: payment,
    shortfallCents:
      payment > reserve ? payment - reserve : payment > 0 ? 0 : null,
  };
}

export async function buildDashboardPayload(db: QueryClient = getPool()): Promise<DashboardPayload> {
  const monthResult = await db.query<MonthRow>(
    "SELECT month, report_status, report_meta, coverage, income_available, income_complete FROM family_ledger.months ORDER BY month",
  );
  if (!monthResult.rowCount) {
    return { schemaVersion: 1, months: [], defaultMonths: [] };
  }
  const transactionResult = await db.query<TransactionRow>(
    `SELECT t.stable_id, t.month, t.original_id, t.scope,
            to_char(t.transaction_date, 'YYYY-MM-DD') AS transaction_date,
            t.cents::text AS cents, t.currency, t.account, t.account_key, t.account_label, t.raw,
            i.source_label, i.source_sha256,
            p.purpose
     FROM family_ledger.transactions t
     JOIN family_ledger.imports i ON i.id = t.import_id
     LEFT JOIN family_ledger.purpose_confirmations p
       ON p.transaction_id = t.stable_id AND p.active
     ORDER BY t.month, t.scope, t.original_id`,
  );
  const recordsByMonthScope = new Map<string, LedgerRecord[]>();
  for (const row of transactionResult.rows) {
    const key = `${row.month}\0${row.scope}`;
    const list = recordsByMonthScope.get(key) ?? [];
    list.push(toRecord(row));
    recordsByMonthScope.set(key, list);
  }
  function records(month: string, scope: LedgerScope): LedgerRecord[] {
    return recordsByMonthScope.get(`${month}\0${scope}`) ?? [];
  }

  const months: LedgerMonth[] = monthResult.rows.map((row) => {
    const raw = jsonObject(
      sanitizeLedgerJson(row.report_meta),
      `month ${row.month} report_meta`,
    );
    const rawHousehold = jsonObject(
      raw.household,
      `month ${row.month} household`,
    );
    const rawCompany = optionalJsonObject(
      raw.company,
      `month ${row.month} company`,
    );
    const rawAgency = optionalJsonObject(
      raw.agency,
      `month ${row.month} agency`,
    );
    const rawFunding = optionalJsonObject(
      raw.funding,
      `month ${row.month} funding`,
    );
    const household = records(row.month, "household");
    const company = records(row.month, "company");
    const agency = records(row.month, "agency");
    const funding = records(row.month, "funding");
    const foreign = records(row.month, "foreignHousehold");
    const income = records(row.month, "income");
    const pendingIncome = records(row.month, "pendingIncome");
    const excludedIncome = records(row.month, "excludedIncome");
    const foreignIncome = income.filter((item) => item.currency !== "CNY");
    const rawIncome =
      optionalJsonObject(raw.income, `month ${row.month} income`) ?? {};
    const foreignTotals: Record<string, number> = {};
    const rawForeignTotals = rawIncome.foreign_totals;
    if (
      rawForeignTotals &&
      typeof rawForeignTotals === "object" &&
      !Array.isArray(rawForeignTotals)
    ) {
      for (const [currency, value] of Object.entries(rawForeignTotals)) {
        foreignTotals[currency] = requiredInteger(
          value,
          `month ${row.month} foreign income ${currency}`,
        );
      }
    }
    const rawPending = Array.isArray(raw.pending) ? raw.pending : [];
    return {
      month: row.month,
      status: safeText(row.report_status),
      notes: jsonStrings(raw.notes),
      coverage: sanitizeOptionalLedgerJson(row.coverage),
      household: {
        netCents: requiredInteger(
          rawHousehold.net_cents,
          `month ${row.month} household.net_cents`,
        ),
        records: household,
      },
      mortgage: mortgageFor(household, raw),
      company: {
        available: rawCompany !== null,
        netCents: optionalInteger(
          rawCompany?.net_cents,
          `month ${row.month} company.net_cents`,
        ),
        records: company,
        notes: jsonStrings(rawCompany?.notes),
      },
      agency: {
        available: rawAgency !== null,
        paidCents: optionalInteger(
          rawAgency?.paid_cents,
          `month ${row.month} agency.paid_cents`,
        ),
        receivedCents: optionalInteger(
          rawAgency?.received_cents,
          `month ${row.month} agency.received_cents`,
        ),
        records: agency,
        notes: jsonStrings(rawAgency?.notes),
      },
      funding: {
        records: funding,
        notes: jsonStrings(rawFunding?.notes),
      },
      foreign,
      pending: rawPending.map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error("stored pending item is invalid");
        const value = item as Record<string, Json>;
        return {
          label: safeText(value.label),
          cents: optionalInteger(
            value.cents,
            `month ${row.month} pending cents`,
          ),
          detail: safeText(value.detail),
        };
      }),
      income: {
        available: row.income_available,
        records: income.filter((item) => item.currency === "CNY"),
        pendingRecords: pendingIncome,
        excludedRecords: excludedIncome,
        foreignRecords: foreignIncome,
        foreignTotals,
        totalCents: optionalInteger(
          rawIncome.total_cents,
          `month ${row.month} income.total_cents`,
        ),
        knownTotalCents: requiredInteger(
          rawIncome.known_total_cents ?? 0,
          `month ${row.month} income.known_total_cents`,
        ),
        complete: row.income_complete,
        notes: jsonStrings(rawIncome.notes),
      },
    };
  });

  for (const month of months) {
    if (month.household.netCents !== sum(month.household.records)) {
      throw new Error(
        `stored household total is inconsistent for ${month.month}`,
      );
    }
    if (
      month.company.netCents !== null &&
      month.company.netCents !== sum(month.company.records)
    ) {
      throw new Error(
        `stored company total is inconsistent for ${month.month}`,
      );
    }
    const agencyPaid = sum(
      month.agency.records.filter((item) => item.cents > 0),
    );
    const agencyReceived = -sum(
      month.agency.records.filter((item) => item.cents < 0),
    );
    if (
      month.agency.paidCents !== null &&
      (month.agency.paidCents !== agencyPaid ||
        month.agency.receivedCents !== agencyReceived)
    ) {
      throw new Error(`stored agency total is inconsistent for ${month.month}`);
    }
    for (const [currency, expected] of Object.entries(
      month.income.foreignTotals,
    )) {
      if (
        expected !==
        sum(
          month.income.foreignRecords.filter(
            (item) => item.currency === currency,
          ),
        )
      ) {
        throw new Error(
          `stored foreign income total is inconsistent for ${month.month}`,
        );
      }
    }
    const known = sum(month.income.records);
    if (
      known !== month.income.knownTotalCents ||
      (month.income.records.length
        ? month.income.totalCents !== known
        : month.income.totalCents !== null)
    ) {
      throw new Error(`stored income total is inconsistent for ${month.month}`);
    }
  }

  const classificationResult = await db.query<{
    transaction_id: string;
    scheme: ClassificationScheme;
    category_id: string;
    main_label: string;
    sub_label: string;
    status: TransactionClassification["status"];
    source: TransactionClassification["source"];
  }>(
    `SELECT t.stable_id AS transaction_id, s.code AS scheme,
            c.id AS category_id, c.main_label, c.sub_label,
            COALESCE(a.status, r.status) AS status,
            CASE WHEN a.status = 'override' THEN 'override'
                 WHEN a.transaction_id IS NOT NULL THEN 'assignment'
                 ELSE 'rule' END AS source
     FROM family_ledger.transactions t
     CROSS JOIN family_ledger.classification_schemes s
     LEFT JOIN family_ledger.transaction_classifications a
       ON a.transaction_id = t.stable_id AND a.scheme = s.code
     LEFT JOIN family_ledger.category_rules r
       ON r.scheme = s.code AND r.ledger_scope = t.scope
      AND r.source_label = COALESCE(t.raw->>'category', '未分类')
     JOIN family_ledger.categories c ON c.id = COALESCE(a.category_id, r.category_id)
     WHERE COALESCE(a.category_id, r.category_id) IS NOT NULL`,
  );
  const recordById = new Map(allTransactions({ months }).map((record) => [record.id, record]));
  for (const row of classificationResult.rows) {
    const record = recordById.get(row.transaction_id);
    if (!record) continue;
    record.classifications[row.scheme] = {
      categoryId: row.category_id,
      mainLabel: safeText(row.main_label),
      subLabel: safeText(row.sub_label),
      status: row.status,
      source: row.source,
    };
  }

  return {
    schemaVersion: 1,
    months,
    defaultMonths: months.map((month) => month.month),
  };
}

interface RefundLinkRow {
  expense_transaction_id: string;
  refund_transaction_id: string;
  allocation_cents: string;
  currency: string;
  status: "pending" | "confirmed";
  evidence: Record<string, unknown>;
  created_by: string;
  created_at: Date;
}

function linkLike(row: RefundLinkRow): RefundLinkLike {
  return {
    expenseTransactionId: row.expense_transaction_id,
    refundTransactionId: row.refund_transaction_id,
    allocationCents: Number(row.allocation_cents),
    currency: row.currency,
    status: row.status,
    evidence: row.evidence,
    createdBy: row.created_by,
  };
}

export async function buildRefundOverview(payload: DashboardPayload, db: QueryClient = getPool()): Promise<RefundOverview> {
  const links = await db.query<RefundLinkRow>(
    `SELECT expense_transaction_id, refund_transaction_id, allocation_cents::text,
            currency, status, evidence, created_by, created_at
     FROM family_ledger.refund_links`,
  );
  const records = allTransactions(payload);
  const safeLinks: SafeRefundLink[] = links.rows.map((row) => ({
    expenseTransactionId: row.expense_transaction_id,
    refundTransactionId: row.refund_transaction_id,
    allocationCents: Number(row.allocation_cents),
    currency: row.currency,
    status: row.status,
    evidence: safeRefundEvidence(row.evidence),
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  }));
  return {
    candidates: listRefundCandidates(records),
    summary: summarizeRefunds(records, links.rows.map(linkLike)),
    links: safeLinks,
  };
}

export async function buildPurposeHistory(db: QueryClient = getPool()): Promise<PurposeHistory[]> {
  const result = await db.query<{
    transaction_id: string;
    purpose: string;
    evidence: Json;
    confirmed_by: string;
    confirmed_at: Date;
    active: boolean;
  }>(`SELECT transaction_id, purpose, evidence, confirmed_by, confirmed_at, active
      FROM family_ledger.purpose_confirmations
      ORDER BY confirmed_at DESC`);
  return result.rows.map((row) => ({
    transactionId: row.transaction_id,
    purpose: safeText(row.purpose),
    evidence: sanitizeLedgerJson(row.evidence),
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at.toISOString(),
    active: row.active,
  }));
}

async function buildTaxonomy(db: QueryClient): Promise<TaxonomySnapshot> {
  const result = await db.query<{
    id: string;
    scheme: ClassificationScheme;
    main_label: string;
    sub_label: string;
    state: CategoryDefinition["state"];
    merged_into_id: string | null;
    revision: string;
  }>(`SELECT id, scheme, main_label, sub_label, state, merged_into_id, revision::text
      FROM family_ledger.categories ORDER BY scheme, main_label, sub_label, id`);
  const categories = result.rows.map((row) => ({
    id: row.id,
    scheme: row.scheme,
    mainLabel: safeText(row.main_label),
    subLabel: safeText(row.sub_label),
    state: row.state,
    ...(row.merged_into_id ? { mergedIntoId: row.merged_into_id } : {}),
    revision: Number(row.revision),
  }));
  const schemes = await db.query<{ code: ClassificationScheme; label: string; revision: string }>(
    `SELECT code, label, revision::text FROM family_ledger.classification_schemes ORDER BY code`,
  );
  const rules = await db.query<{
    id: string; scheme: ClassificationScheme; ledger_scope: LedgerScope; source_label: string;
    category_id: string; status: SourceCategoryRule["status"]; revision: string;
  }>(`SELECT id::text, scheme, ledger_scope, source_label, category_id, status, revision::text
      FROM family_ledger.category_rules ORDER BY scheme, ledger_scope, source_label`);
  const audit = await db.query<{
    id: string; scheme: ClassificationScheme; operation: string; category_id: string | null; actor: string;
    before_state: Json | null; after_state: Json | null; affected_counts: Json; created_at: Date;
  }>(`SELECT id::text, scheme, operation, category_id, actor, before_state, after_state, affected_counts, created_at
      FROM family_ledger.category_audit ORDER BY created_at DESC, id DESC LIMIT 200`);
  return {
    schemes: schemes.rows.map((row) => ({ code: row.code, label: safeText(row.label), revision: Number(row.revision) })),
    categories,
    rules: rules.rows.map((row) => ({ id: row.id, scheme: row.scheme, scope: row.ledger_scope, sourceLabel: safeText(row.source_label), categoryId: row.category_id, status: row.status, revision: Number(row.revision) })),
    audit: audit.rows.map((row) => ({ id: row.id, scheme: row.scheme, operation: safeText(row.operation), categoryId: row.category_id,
      actor: safeText(row.actor), before: sanitizeOptionalLedgerJson(row.before_state), after: sanitizeOptionalLedgerJson(row.after_state),
      affected: sanitizeLedgerJson(row.affected_counts), createdAt: row.created_at.toISOString() })),
  };
}

export class DashboardSnapshotNotReadyError extends Error {
  constructor() { super("dashboard snapshot is not ready"); }
}

export async function buildDashboardSnapshot(db: QueryClient, publishedAt = new Date()): Promise<PublishedDashboardSnapshot> {
  const payload = await buildDashboardPayload(db);
  const [refunds, purposeHistory, taxonomy] = await Promise.all([
    buildRefundOverview(payload, db),
    buildPurposeHistory(db),
    buildTaxonomy(db),
  ]);
  return constructDashboardSnapshot({ publishedAt: publishedAt.toISOString(), payload, refunds, purposeHistory, taxonomy });
}

export async function publishDashboardSnapshot(client: pg.PoolClient, actor: string): Promise<PublishedDashboardSnapshot> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [DASHBOARD_WRITE_LOCK]);
  const publishedAt = new Date();
  const snapshot = await buildDashboardSnapshot(client, publishedAt);
  await client.query(
    `INSERT INTO family_ledger.dashboard_snapshots (name, snapshot_version, document, published_at, published_by)
     VALUES ('published', 1, $1::jsonb, $2, $3)
     ON CONFLICT (name) DO UPDATE SET snapshot_version = EXCLUDED.snapshot_version,
       document = EXCLUDED.document, published_at = EXCLUDED.published_at, published_by = EXCLUDED.published_by`,
    [JSON.stringify(snapshot), publishedAt, actor],
  );
  return snapshot;
}

export async function refreshPublishedSnapshot(actor: string): Promise<PublishedDashboardSnapshot> {
  return withTransaction((client) => publishDashboardSnapshot(client, actor));
}

export async function readPublishedSnapshot(db: QueryClient = getPool()): Promise<PublishedDashboardSnapshot> {
  const result = await db.query<{ document: PublishedDashboardSnapshot }>(
    `SELECT document FROM family_ledger.dashboard_snapshots WHERE name = 'published'`,
  );
  if (!result.rows[0]) throw new DashboardSnapshotNotReadyError();
  return result.rows[0].document;
}

export async function getDashboardPayload(): Promise<DashboardPayload> {
  return (await readPublishedSnapshot()).payload;
}

export async function getRefundOverview(payload?: DashboardPayload): Promise<RefundOverview> {
  return payload ? buildRefundOverview(payload) : (await readPublishedSnapshot()).refunds;
}

export async function getPurposeHistory(): Promise<PurposeHistory[]> {
  return (await readPublishedSnapshot()).purposeHistory;
}

export interface RefundLinkInput {
  expenseTransactionId: string;
  refundTransactionId: string;
  allocationCents: number;
  status: "pending" | "confirmed";
  evidence: Record<string, unknown>;
}

function candidateFromRow(row: {
  stable_id: string;
  original_id: string;
  month: string;
  scope: LedgerScope;
  cents: string;
  currency: string;
  transaction_date: string;
  raw: Json;
}): RefundCandidate {
  return {
    id: row.stable_id,
    originalId: row.original_id,
    month: row.month,
    scope: row.scope,
    cents: Number(row.cents),
    currency: row.currency,
    date: row.transaction_date,
    merchant: safeText(
      jsonObject(row.raw, `transaction ${row.stable_id} raw`).merchant,
    ),
  };
}

export async function createRefundLink(
  input: RefundLinkInput,
  actor: string,
): Promise<{ created: boolean }> {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [DASHBOARD_WRITE_LOCK]);
    const rows = await client.query<{
      stable_id: string;
      original_id: string;
      month: string;
      scope: LedgerScope;
      cents: string;
      currency: string;
      transaction_date: string;
      raw: Json;
    }>(
      `SELECT stable_id, original_id, month, scope, cents::text, currency,
              to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date, raw
       FROM family_ledger.transactions
       WHERE stable_id = ANY($1::text[])
       ORDER BY stable_id
       FOR UPDATE`,
      [[input.expenseTransactionId, input.refundTransactionId]],
    );
    const candidates = rows.rows.map(candidateFromRow);
    const original = candidates.find(
      (candidate) => candidate.id === input.expenseTransactionId,
    );
    if (!original) throw new Error("original transaction is missing");
    const existing = await client.query<RefundLinkRow>(
      `SELECT expense_transaction_id, refund_transaction_id, allocation_cents::text,
              currency, status, evidence, created_by, created_at
       FROM family_ledger.refund_links
       WHERE expense_transaction_id = ANY($1::text[])
          OR refund_transaction_id = ANY($1::text[])
       ORDER BY id
       FOR UPDATE`,
      [[input.expenseTransactionId, input.refundTransactionId]],
    );
    const validation = validateRefundLink(
      { ...input, currency: original.currency },
      candidates,
      existing.rows.map(linkLike),
    );
    if (!validation.ok) throw new Error(validation.message);
    if (validation.idempotent) return { created: false };
    await client.query(
      `INSERT INTO family_ledger.refund_links (
        expense_transaction_id, refund_transaction_id, allocation_cents,
        currency, evidence, status, created_by, confirmed_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
      ON CONFLICT (expense_transaction_id, refund_transaction_id) DO NOTHING`,
      [
        input.expenseTransactionId,
        input.refundTransactionId,
        input.allocationCents,
        original.currency,
        JSON.stringify(input.evidence),
        input.status,
        actor,
        input.status === "confirmed" ? actor : null,
      ],
    );
    await publishDashboardSnapshot(client, actor);
    return { created: true };
  });
}

export async function confirmPurpose(
  input: {
    transactionId: string;
    purpose: string;
    evidence: Record<string, unknown>;
  },
  actor: string,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [DASHBOARD_WRITE_LOCK]);
    const transaction = await client.query(
      "SELECT stable_id FROM family_ledger.transactions WHERE stable_id = $1 FOR UPDATE",
      [input.transactionId],
    );
    if (!transaction.rowCount) throw new Error("transaction is missing");
    await client.query(
      "UPDATE family_ledger.purpose_confirmations SET active = false WHERE transaction_id = $1",
      [input.transactionId],
    );
    await client.query(
      `INSERT INTO family_ledger.purpose_confirmations (transaction_id, purpose, evidence, confirmed_by, active)
       VALUES ($1, $2, $3::jsonb, $4, true)`,
      [
        input.transactionId,
        input.purpose,
        JSON.stringify(input.evidence),
        actor,
      ],
    );
    await publishDashboardSnapshot(client, actor);
  });
}
