import type { LedgerRecord, LedgerScope } from "./types";

export const REFUND_LINK_SCOPES: readonly LedgerScope[] = [
  "household",
  "company",
  "agency",
  "foreignHousehold",
];

export interface RefundCandidate {
  id: string;
  originalId: string;
  month: string;
  scope: LedgerScope;
  cents: number;
  currency: string;
  date: string;
  merchant: string;
}

export type RefundLinkStatus = "pending" | "confirmed";

export interface RefundLinkLike {
  expenseTransactionId: string;
  refundTransactionId: string;
  allocationCents: number;
  currency: string;
  status: RefundLinkStatus;
  evidence: Record<string, unknown>;
  createdBy?: string;
}

export interface RefundLinkDraft extends Omit<RefundLinkLike, "status"> {
  status?: RefundLinkStatus;
}

export type RefundValidation =
  | {
      ok: true;
      idempotent: boolean;
      expense: RefundCandidate;
      refund: RefundCandidate;
    }
  | {
      ok: false;
      code:
        | "not-found"
        | "invalid-sign"
        | "scope-mismatch"
        | "currency-mismatch"
        | "invalid-allocation"
        | "over-allocation"
        | "conflicting-duplicate";
      message: string;
    };

function candidate(record: LedgerRecord): RefundCandidate {
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

export function listRefundCandidates(
  records: readonly LedgerRecord[],
): Record<
  "household" | "company" | "agency" | "foreignHousehold",
  RefundCandidate[]
> {
  const result = {
    household: [] as RefundCandidate[],
    company: [] as RefundCandidate[],
    agency: [] as RefundCandidate[],
    foreignHousehold: [] as RefundCandidate[],
  };
  for (const record of records) {
    if (
      record.cents < 0 &&
      (REFUND_LINK_SCOPES as readonly string[]).includes(record.scope)
    ) {
      if (
        record.scope === "household" ||
        record.scope === "company" ||
        record.scope === "agency" ||
        record.scope === "foreignHousehold"
      ) {
        result[record.scope].push(candidate(record));
      }
    }
  }
  return result;
}

function sameEvidence(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}

export function validateRefundLink(
  draft: RefundLinkDraft,
  transactions: readonly RefundCandidate[],
  existingLinks: readonly RefundLinkLike[] = [],
): RefundValidation {
  const byId = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const expense = byId.get(draft.expenseTransactionId);
  const refund = byId.get(draft.refundTransactionId);
  if (!expense || !refund) {
    return {
      ok: false,
      code: "not-found",
      message: "both transactions must already exist in the ledger",
    };
  }
  if (expense.cents <= 0 || refund.cents >= 0) {
    return {
      ok: false,
      code: "invalid-sign",
      message:
        "an original gross expense must be positive and a refund must be negative",
    };
  }
  if (
    expense.scope !== refund.scope ||
    !REFUND_LINK_SCOPES.includes(expense.scope)
  ) {
    return {
      ok: false,
      code: "scope-mismatch",
      message: "refunds must be linked only within the same supported scope",
    };
  }
  if (
    expense.currency !== refund.currency ||
    draft.currency !== expense.currency
  ) {
    return {
      ok: false,
      code: "currency-mismatch",
      message: "a refund link cannot convert between currencies",
    };
  }
  if (
    !Number.isSafeInteger(draft.allocationCents) ||
    draft.allocationCents <= 0 ||
    draft.allocationCents > Math.abs(expense.cents) ||
    draft.allocationCents > Math.abs(refund.cents)
  ) {
    return {
      ok: false,
      code: "invalid-allocation",
      message:
        "allocation must be positive and no larger than either absolute transaction amount",
    };
  }

  const duplicate = existingLinks.find(
    (link) =>
      link.expenseTransactionId === draft.expenseTransactionId &&
      link.refundTransactionId === draft.refundTransactionId,
  );
  if (duplicate) {
    const identical =
      duplicate.allocationCents === draft.allocationCents &&
      duplicate.currency === draft.currency &&
      (duplicate.status ?? "pending") === (draft.status ?? "pending") &&
      sameEvidence(duplicate.evidence, draft.evidence);
    if (identical) return { ok: true, idempotent: true, expense, refund };
    return {
      ok: false,
      code: "conflicting-duplicate",
      message: "a different link already exists for this expense/refund pair",
    };
  }

  const relevant = existingLinks.filter(
    (link) =>
      link.expenseTransactionId === expense.id ||
      link.refundTransactionId === refund.id,
  );
  const expenseAllocated = relevant
    .filter((link) => link.expenseTransactionId === expense.id)
    .reduce((total, link) => total + link.allocationCents, 0);
  const refundAllocated = relevant
    .filter((link) => link.refundTransactionId === refund.id)
    .reduce((total, link) => total + link.allocationCents, 0);
  if (
    expenseAllocated + draft.allocationCents > Math.abs(expense.cents) ||
    refundAllocated + draft.allocationCents > Math.abs(refund.cents)
  ) {
    return {
      ok: false,
      code: "over-allocation",
      message: "refund allocation exceeds an original transaction amount",
    };
  }
  return { ok: true, idempotent: false, expense, refund };
}

export interface RefundScopeSummary {
  scope: "household" | "company" | "agency" | "foreignHousehold";
  currencies: Record<
    string,
    {
      grossCents: number;
      originalRefundCents: number;
      originalNetCents: number;
      confirmedAllocationCents: number;
      pendingAllocationCents: number;
      unallocatedRefundCents: number;
      confirmedAdjustedNetCents: number;
      expenses: Array<{
        id: string;
        amountCents: number;
        currency: string;
        confirmedCents: number;
        pendingCents: number;
        allocatedCents: number;
        allocationState: "none" | "pending" | "partial" | "full";
      }>;
      refunds: Array<{
        id: string;
        month: string;
        amountCents: number;
        currency: string;
        confirmedCents: number;
        pendingCents: number;
        allocatedCents: number;
        allocationState: "unknown" | "pending" | "partial" | "full";
      }>;
    }
  >;
}

export interface RefundSummary {
  scopes: RefundScopeSummary[];
  confirmedByArrivalMonth: Record<
    string,
    Record<
      "household" | "company" | "agency" | "foreignHousehold",
      Record<string, number>
    >
  >;
  pendingByArrivalMonth: Record<
    string,
    Record<
      "household" | "company" | "agency" | "foreignHousehold",
      Record<string, number>
    >
  >;
}

/** Ranking-only view: links explain remaining cost and never mutate cashflow totals. */
export function rankExpensesAfterConfirmedRefunds(
  expenses: readonly LedgerRecord[],
  links: readonly RefundLinkLike[],
): Array<{
  record: LedgerRecord;
  confirmedCents: number;
  remainingCents: number;
}> {
  return expenses
    .filter((record) => record.cents > 0)
    .map((record) => {
      const confirmedCents = links
        .filter(
          (link) =>
            link.status === "confirmed" &&
            link.expenseTransactionId === record.id,
        )
        .reduce((total, link) => total + link.allocationCents, 0);
      return {
        record,
        confirmedCents,
        remainingCents: Math.max(0, record.cents - confirmedCents),
      };
    })
    .sort(
      (a, b) =>
        b.remainingCents - a.remainingCents ||
        a.record.id.localeCompare(b.record.id),
    );
}

function allocationState<T extends "none" | "unknown">(
  amount: number,
  confirmed: number,
  pending: number,
  emptyState: T,
): T | "pending" | "partial" | "full" {
  if (confirmed >= amount) return "full";
  if (confirmed > 0) return "partial";
  if (pending > 0) return "pending";
  return emptyState;
}

export function summarizeRefunds(
  records: readonly LedgerRecord[],
  links: readonly RefundLinkLike[],
): RefundSummary {
  const scopes: RefundScopeSummary[] = [];
  const confirmedByArrivalMonth: RefundSummary["confirmedByArrivalMonth"] = {};
  const pendingByArrivalMonth: RefundSummary["pendingByArrivalMonth"] = {};

  for (const scope of REFUND_LINK_SCOPES) {
    if (
      scope !== "household" &&
      scope !== "company" &&
      scope !== "agency" &&
      scope !== "foreignHousehold"
    )
      continue;
    const scoped = records.filter((record) => record.scope === scope);
    const expenses = scoped.filter((record) => record.cents > 0);
    const refunds = scoped.filter((record) => record.cents < 0);
    const expenseIds = new Set(expenses.map((expense) => expense.id));
    const refundIds = new Set(refunds.map((refund) => refund.id));
    const scopedLinks = links.filter(
      (link) =>
        expenseIds.has(link.expenseTransactionId) &&
        refundIds.has(link.refundTransactionId),
    );
    const currencies = new Set(
      [...expenses, ...refunds].map((record) => record.currency),
    );

    const currencySummaries: RefundScopeSummary["currencies"] = {};
    for (const currency of currencies) {
      const currencyExpenses = expenses.filter(
        (expense) => expense.currency === currency,
      );
      const currencyRefunds = refunds.filter(
        (refund) => refund.currency === currency,
      );
      const currencyLinks = scopedLinks.filter(
        (link) => link.currency === currency,
      );
      for (const link of currencyLinks) {
        const expense = currencyExpenses.find(
          (row) => row.id === link.expenseTransactionId,
        );
        const refund = currencyRefunds.find(
          (row) => row.id === link.refundTransactionId,
        );
        if (
          !expense ||
          !refund ||
          link.currency !== expense.currency ||
          link.currency !== refund.currency ||
          !Number.isSafeInteger(link.allocationCents) ||
          link.allocationCents <= 0
        ) {
          throw new Error(
            `invalid stored refund link for ${link.expenseTransactionId}`,
          );
        }
      }
      const gross = safeSum(currencyExpenses.map((row) => row.cents));
      const originalRefund = -safeSum(currencyRefunds.map((row) => row.cents));
      const confirmed = safeSum(
        currencyLinks
          .filter((link) => (link.status ?? "pending") === "confirmed")
          .map((link) => link.allocationCents),
      );
      const pending = safeSum(
        currencyLinks
          .filter((link) => (link.status ?? "pending") === "pending")
          .map((link) => link.allocationCents),
      );

      currencySummaries[currency] = {
        grossCents: gross,
        originalRefundCents: originalRefund,
        originalNetCents: safeSum([gross, -originalRefund]),
        confirmedAllocationCents: confirmed,
        pendingAllocationCents: pending,
        unallocatedRefundCents: safeSum([originalRefund, -confirmed, -pending]),
        confirmedAdjustedNetCents: safeSum([gross, -confirmed]),
        expenses: currencyExpenses.map((expense) => {
          const relevant = currencyLinks.filter(
            (link) => link.expenseTransactionId === expense.id,
          );
          const confirmedCents = safeSum(
            relevant
              .filter((link) => (link.status ?? "pending") === "confirmed")
              .map((link) => link.allocationCents),
          );
          const pendingCents = safeSum(
            relevant
              .filter((link) => (link.status ?? "pending") === "pending")
              .map((link) => link.allocationCents),
          );
          return {
            id: expense.id,
            amountCents: expense.cents,
            currency,
            confirmedCents,
            pendingCents,
            allocatedCents: safeSum([confirmedCents, pendingCents]),
            allocationState: allocationState(
              expense.cents,
              confirmedCents,
              pendingCents,
              "none",
            ),
          };
        }),
        refunds: currencyRefunds.map((refund) => {
          const relevant = currencyLinks.filter(
            (link) => link.refundTransactionId === refund.id,
          );
          const confirmedCents = safeSum(
            relevant
              .filter((link) => (link.status ?? "pending") === "confirmed")
              .map((link) => link.allocationCents),
          );
          const pendingCents = safeSum(
            relevant
              .filter((link) => (link.status ?? "pending") === "pending")
              .map((link) => link.allocationCents),
          );
          return {
            id: refund.id,
            month: refund.month,
            amountCents: Math.abs(refund.cents),
            currency,
            confirmedCents,
            pendingCents,
            allocatedCents: safeSum([confirmedCents, pendingCents]),
            allocationState: allocationState(
              Math.abs(refund.cents),
              confirmedCents,
              pendingCents,
              "unknown",
            ),
          };
        }),
      };

      for (const link of currencyLinks) {
        const refund = currencyRefunds.find(
          (record) => record.id === link.refundTransactionId,
        );
        if (!refund) continue;
        const target =
          (link.status ?? "pending") === "confirmed"
            ? confirmedByArrivalMonth
            : pendingByArrivalMonth;
        const monthRecord = (target[refund.month] ??= {
          household: {},
          company: {},
          agency: {},
          foreignHousehold: {},
        });
        monthRecord[scope][currency] = safeSum([
          monthRecord[scope][currency] ?? 0,
          link.allocationCents,
        ]);
      }
    }

    scopes.push({ scope, currencies: currencySummaries });
  }

  return { scopes, confirmedByArrivalMonth, pendingByArrivalMonth };
}

function safeSum(values: number[]): number {
  return values.reduce((total, value) => {
    const next = total + value;
    if (!Number.isSafeInteger(next))
      throw new Error(
        "refund summary exceeds the JavaScript safe-integer range",
      );
    return next;
  }, 0);
}
