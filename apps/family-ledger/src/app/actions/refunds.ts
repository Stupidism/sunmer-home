"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/auth";
import { confirmPurpose, createRefundLink } from "@/server/repository";

const evidenceSchema = z.object({
  note: z.string().trim().min(3).max(2000),
  source: z.string().trim().min(1).max(200),
});

const refundLinkSchema = z.object({
  expenseTransactionId: z.string().min(1).max(300),
  refundTransactionId: z.string().min(1).max(300),
  allocationCents: z.number().int().positive().safe(),
  status: z.enum(["pending", "confirmed"]),
  evidence: evidenceSchema,
});

const purposeSchema = z.object({
  transactionId: z.string().min(1).max(300),
  purpose: z.string().trim().min(1).max(500),
  evidence: evidenceSchema,
});

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("not authorized");
  return user;
}

export async function createRefundLinkAction(
  input: unknown,
): Promise<{ ok: true; created: boolean } | { ok: false; error: string }> {
  try {
    const user = await requireAdmin();
    const value = refundLinkSchema.parse(input);
    const result = await createRefundLink(value, user.username);
    revalidatePath("/");
    return { ok: true, ...result };
  } catch (error) {
    const message =
      error instanceof Error &&
      [
        "both transactions must already exist in the ledger",
        "an original gross expense must be positive and a refund must be negative",
        "refunds must be linked only within the same supported scope",
        "a refund link cannot convert between currencies",
        "allocation must be positive and no larger than either absolute transaction amount",
        "refund allocation exceeds an original transaction amount",
        "a different link already exists for this expense/refund pair",
      ].includes(error.message)
        ? error.message
        : null;
    return {
      ok: false,
      error: message
        ? `无法保存：${message}`
        : "无法保存退款关联；请检查交易、币种、范围和剩余可分配金额。",
    };
  }
}

export async function confirmPurposeAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireAdmin();
    const value = purposeSchema.parse(input);
    await confirmPurpose(value, user.username);
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "无法保存用途确认。" };
  }
}
