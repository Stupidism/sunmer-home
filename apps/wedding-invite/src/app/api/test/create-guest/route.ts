import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPayloadClient } from "@/lib/payload/client";

type CreateGuestBody = {
  name?: string;
  memorySnippet?: string;
  relationshipNote?: string;
};

const E2E_FALLBACK_PREFIX = "e2e-fallback:";

function buildNoDatabaseFallbackCode(name: string, memorySnippet: string): string {
  const payload = Buffer.from(JSON.stringify({ name, memorySnippet }), "utf8").toString("base64url");
  return `${E2E_FALLBACK_PREFIX}${payload}`;
}

function isMissingGuestsRelation(error: unknown): boolean {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
    const maybeCause = error.cause;
    if (maybeCause instanceof Error) {
      parts.push(maybeCause.message);
    } else if (maybeCause) {
      parts.push(String(maybeCause));
    }
  } else if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    const detail = (error as { detail?: unknown }).detail;
    const cause = (error as { cause?: unknown }).cause;
    if (typeof message === "string") parts.push(message);
    if (typeof detail === "string") parts.push(detail);
    if (cause instanceof Error) {
      parts.push(cause.message);
    } else if (typeof cause === "string") {
      parts.push(cause);
    }
  } else {
    parts.push(String(error || ""));
  }

  return parts.join(" | ").includes('relation "guests" does not exist');
}

export async function POST(request: NextRequest) {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as CreateGuestBody;
    const name = body.name?.trim();
    const memorySnippet = body.memorySnippet?.trim();
    const relationshipNote = body.relationshipNote?.trim();

    if (!name || !memorySnippet) {
      return NextResponse.json(
        { success: false, error: "name and memorySnippet are required" },
        { status: 400 },
      );
    }

    const payload = await getPayloadClient();

    let guest:
      | {
          id: string;
          name?: string;
          memorySnippet?: string;
          inviteCode?: string;
          shareLink?: string;
        }
      | undefined;

    try {
      guest = (await payload.create({
        collection: "guests",
        data: {
          id: randomUUID(),
          name,
          memorySnippet,
          relationshipNote: relationshipNote || "E2E created guest",
          phone: "",
          relationshipCategory: "friend",
          relationshipSide: "groom",
          isSingle: true,
          hasChildren: false,
          maxGuestCount: 1,
          status: "draft",
        },
        overrideAccess: true,
      })) as {
        id: string;
        name?: string;
        memorySnippet?: string;
        inviteCode?: string;
        shareLink?: string;
      };
    } catch (error) {
      if (isMissingGuestsRelation(error)) {
        const noDatabaseCode = buildNoDatabaseFallbackCode(name, memorySnippet);
        return NextResponse.json({
          success: true,
          guestId: `fallback-${Date.now()}`,
          guestName: name,
          memorySnippet,
          shareLink: `/invite/${encodeURIComponent(noDatabaseCode)}`,
          inviteCode: noDatabaseCode,
          fallback: true,
          noDatabaseFallback: true,
          warning: "guests relation missing, using no-database fallback",
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      guestId: guest.id,
      guestName: guest.name || name,
      memorySnippet: guest.memorySnippet || memorySnippet,
      shareLink: guest.shareLink || null,
      inviteCode: guest.inviteCode || null,
    });
  } catch (error) {
    console.error("Failed to create E2E guest", error);
    const base = error instanceof Error ? error.message : "Failed to create E2E guest";
    const errorWithCause = error as { cause?: unknown; code?: string; detail?: string };
    const causeMessage =
      errorWithCause.cause instanceof Error
        ? errorWithCause.cause.message
        : typeof errorWithCause.cause === "string"
          ? errorWithCause.cause
          : undefined;
    const detailed = [base, causeMessage, errorWithCause.code, errorWithCause.detail]
      .filter((item) => Boolean(item && String(item).trim()))
      .join(" | ");

    return NextResponse.json({ success: false, error: detailed || base }, { status: 500 });
  }
}
