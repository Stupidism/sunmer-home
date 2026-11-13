import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  validateRefundLink,
  type RefundCandidate,
  type RefundLinkLike,
} from "../src/lib/domain/refunds";
import { getPool, withTransaction } from "../src/server/db/pool";
import { DASHBOARD_WRITE_LOCK, publishDashboardSnapshot } from "../src/server/repository";

const sourceSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
const groupSchema = z.object({
  expense_id: z.string().min(1),
  refund_ids: z.array(z.string().min(1)).min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  scope: z.enum(["household", "company", "agency", "foreignHousehold"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  gross_cents: z.number().int().positive().safe(),
  refund_cents: z.number().int().positive().safe(),
  net_cents: z.number().int().safe(),
  account: z.string(),
  kind: z.string().min(1),
});
const fileSchema = z.object({
  version: z.number().int().positive(),
  actor: z.string().min(1),
  basis: z.string().min(1),
  reviewed_at: z.string().min(1),
  sources: z.array(sourceSchema).min(1),
  groups: z.array(groupSchema).min(1),
});

function parseArgs(argv: string[]) {
  let file = "",
    dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue;
    if (argv[i] === "--file") file = argv[++i] ?? "";
    else if (argv[i] === "--dry-run") dryRun = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!file)
    throw new Error(
      "usage: pnpm import-refund-links -- --file refund-evidence.json [--dry-run]",
    );
  return { file, dryRun };
}

interface TransactionRow {
  stable_id: string;
  original_id: string;
  month: string;
  scope: "household" | "company" | "agency" | "foreignHousehold";
  cents: string;
  currency: string;
  account: string;
  transaction_date: string;
  raw: Record<string, unknown>;
}
interface LinkRow {
  expense_transaction_id: string;
  refund_transaction_id: string;
  allocation_cents: string;
  currency: string;
  status: "pending" | "confirmed";
  evidence: Record<string, unknown>;
  created_by: string;
}

function candidate(row: TransactionRow): RefundCandidate {
  return {
    id: row.stable_id,
    originalId: row.original_id,
    month: row.month,
    scope: row.scope,
    cents: Number(row.cents),
    currency: row.currency,
    date: row.transaction_date,
    merchant: typeof row.raw.merchant === "string" ? row.raw.merchant : "",
  };
}
function link(row: LinkRow): RefundLinkLike {
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bytes = await readFile(args.file);
  const parsed = fileSchema.parse(JSON.parse(bytes.toString("utf8")));
  for (const source of parsed.sources) {
    const sourceBytes = await readFile(source.path);
    if (
      createHash("sha256").update(sourceBytes).digest("hex").toLowerCase() !==
      source.sha256.toLowerCase()
    )
      throw new Error("evidence source hash mismatch");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const result = await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      DASHBOARD_WRITE_LOCK,
    ]);
    const ids = unique(
      parsed.groups.flatMap((g) => [g.expense_id, ...g.refund_ids]),
    );
    const rows = await client.query<TransactionRow>(
      `SELECT stable_id, original_id, month, scope, cents::text, currency, account,
      to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date, raw
      FROM family_ledger.transactions WHERE stable_id = ANY($1::text[]) OR original_id = ANY($1::text[]) ORDER BY stable_id FOR UPDATE`,
      [ids],
    );
    const allCandidates = rows.rows.map(candidate);
    const existingResult =
      await client.query<LinkRow>(`SELECT expense_transaction_id, refund_transaction_id,
      allocation_cents::text, currency, status, evidence, created_by FROM family_ledger.refund_links ORDER BY id FOR UPDATE`);
    const existing = existingResult.rows.map(link);
    let created = 0,
      idempotent = 0;
    for (const group of parsed.groups) {
      const expense = resolve(
        rows.rows,
        group.expense_id,
        group.month,
        group.scope,
      );
      const refundRows = group.refund_ids.map((id) =>
        resolve(rows.rows, id, undefined, group.scope),
      );
      if (
        expense.cents !== String(group.gross_cents) ||
        expense.currency !== group.currency ||
        expense.account !== group.account
      )
        throw new Error(
          "original identity/account/currency/gross verification failed",
        );
      if (
        refundRows.some(
          (r) =>
            r.currency !== group.currency ||
            r.account !== group.account ||
            Number(r.cents) >= 0,
        )
      )
        throw new Error("refund identity/account/currency verification failed");
      const refundTotal = refundRows.reduce(
        (n, r) => n + Math.abs(Number(r.cents)),
        0,
      );
      if (
        refundTotal !== group.refund_cents ||
        group.gross_cents - refundTotal !== group.net_cents
      )
        throw new Error("refund group sum verification failed");
      for (const refund of refundRows) {
        const draft = {
          expenseTransactionId: expense.stable_id,
          refundTransactionId: refund.stable_id,
          allocationCents: Math.abs(Number(refund.cents)),
          currency: group.currency,
          status: "confirmed" as const,
          evidence: {
            import_source: args.file,
            evidence_sources: parsed.sources,
            actor_source: parsed.actor,
            basis: parsed.basis,
            reviewed_at: parsed.reviewed_at,
            kind: group.kind,
            version: parsed.version,
          },
        };
        const checked = validateRefundLink(draft, allCandidates, existing);
        if (!checked.ok) throw new Error(checked.message);
        if (checked.idempotent) {
          idempotent++;
          continue;
        }
        existing.push(draft);
        created++;
        if (!args.dryRun)
          await client.query(
            `INSERT INTO family_ledger.refund_links
          (expense_transaction_id, refund_transaction_id, allocation_cents, currency, evidence, status, created_by, confirmed_by)
          VALUES ($1,$2,$3,$4,$5::jsonb,'confirmed',$6,$6)`,
            [
              draft.expenseTransactionId,
              draft.refundTransactionId,
              draft.allocationCents,
              draft.currency,
              JSON.stringify(draft.evidence),
              parsed.actor,
            ],
          );
      }
    }
    if (args.dryRun) throw new DryRunResult(created, idempotent);
    const snapshot = await client.query("SELECT name FROM family_ledger.dashboard_snapshots WHERE name='published'");
    if (created || !snapshot.rowCount) await publishDashboardSnapshot(client, parsed.actor);
    return { created, idempotent };
  }).catch((error: unknown) => {
    if (error instanceof DryRunResult)
      return { created: error.created, idempotent: error.idempotent };
    throw error;
  });
  console.log(
    JSON.stringify({
      dryRun: args.dryRun,
      groups: parsed.groups.length,
      links: result.created + result.idempotent,
      created: result.created,
      idempotent: result.idempotent,
      verification: "PASS",
    }),
  );
}

class DryRunResult extends Error {
  constructor(
    public created: number,
    public idempotent: number,
  ) {
    super("dry run rollback");
  }
}
function resolve(
  rows: TransactionRow[],
  id: string,
  month?: string,
  scope?: string,
): TransactionRow {
  const matches = rows.filter(
    (r) =>
      (r.stable_id === id || r.original_id === id) &&
      (!month || r.month === month) &&
      (!scope || r.scope === scope),
  );
  if (matches.length !== 1)
    throw new Error("stable transaction identity did not resolve uniquely");
  return matches[0];
}
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "refund import failed",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
