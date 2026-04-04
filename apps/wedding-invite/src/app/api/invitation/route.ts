import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

// Ensure this route is always dynamic and never cached by Next.js
export const dynamic = "force-dynamic";

const relationshipCategoryLabel: Record<string, string> = {
  friend: "朋友",
  classmate: "同学",
  junior_high_classmate: "初中同学",
  high_school_classmate: "高中同学",
  relative: "亲戚",
  colleague: "同事",
  other: "其他",
};

const relationshipSideLabel: Record<string, string> = {
  bride: "新娘这边",
  groom: "新郎这边",
  groom_father: "新郎爸爸这边",
  groom_mother: "新郎妈妈这边",
  bride_father: "新娘爸爸这边",
  bride_mother: "新娘妈妈这边",
  groom_family: "男方亲友",
  bride_family: "女方亲友",
  both: "共同好友",
  other: "其他",
};

const E2E_CODE_PREFIX = "e2e-code:";
const E2E_FALLBACK_PREFIX = "e2e-fallback:";

function isMissingInvitationsRelation(error: unknown): boolean {
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

  return parts.join(" | ").includes('relation "invitations" does not exist');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function decodeNoDatabaseFallback(code: string): { name: string; memorySnippet: string } | null {
  if (!code.startsWith(E2E_FALLBACK_PREFIX)) {
    return null;
  }

  try {
    const raw = code.slice(E2E_FALLBACK_PREFIX.length);
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      name?: unknown;
      memorySnippet?: unknown;
    };
    if (typeof parsed.name !== "string" || typeof parsed.memorySnippet !== "string") {
      return null;
    }

    return {
      name: parsed.name,
      memorySnippet: parsed.memorySnippet,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
    }

    const noCacheHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    };

    const noDatabaseFallback = decodeNoDatabaseFallback(code);
    if (noDatabaseFallback) {
      return NextResponse.json({
        success: true,
        data: {
          inviteCode: code,
          guestName: noDatabaseFallback.name,
          relationshipSide: "其他",
          relationshipCategory: "其他",
          relationshipNote: "E2E 无数据库回退路径",
          memorySnippet: noDatabaseFallback.memorySnippet,
          customOpening: `亲爱的${noDatabaseFallback.name}，欢迎来参加我们的婚礼。`,
          maxGuestCount: 1,
        },
      }, { headers: noCacheHeaders });
    }

    const payload = await getPayloadClient();
    let invitationResult:
      | {
          docs: Array<Record<string, unknown>>;
        }
      | undefined;
    try {
      invitationResult = await payload.find({
        collection: "invitations",
        where: { inviteCode: { equals: code } },
        depth: 1,
        limit: 1,
        overrideAccess: true,
      });
    } catch (error) {
      if (!isMissingInvitationsRelation(error)) {
        throw error;
      }

      const guestResult = await payload.find({
        collection: "guests",
        where: { phone: { equals: `${E2E_CODE_PREFIX}${code}` } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
      });

      const guest = guestResult.docs[0] as
        | {
            name?: string;
            relationshipSide?: string;
            relationshipCategory?: string;
            relationshipNote?: string;
            memorySnippet?: string;
            invitationCopy?: string;
          }
        | undefined;
      if (!guest) {
        return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
      }

      const side = typeof guest.relationshipSide === "string" ? guest.relationshipSide : "other";
      const category =
        typeof guest.relationshipCategory === "string" ? guest.relationshipCategory : "other";

      return NextResponse.json({
        success: true,
        data: {
          inviteCode: code,
          guestName: typeof guest.name === "string" ? guest.name : "贵宾",
          relationshipSide: relationshipSideLabel[side] || "其他",
          relationshipCategory: relationshipCategoryLabel[category] || "其他",
          relationshipNote: typeof guest.relationshipNote === "string" ? guest.relationshipNote : "",
          memorySnippet: typeof guest.memorySnippet === "string" ? guest.memorySnippet : "",
          customOpening:
            (typeof guest.invitationCopy === "string" && guest.invitationCopy) ||
            (typeof guest.name === "string" ? `亲爱的${guest.name}，欢迎来参加我们的婚礼。` : ""),
          maxGuestCount: 1,
        },
      }, { headers: noCacheHeaders });
    }

    const invitation = asRecord(invitationResult?.docs[0]);
    if (!invitation) {
      return NextResponse.json({ success: false, error: "Invitation not found" }, { status: 404 });
    }

    const guest = asRecord(invitation.guest);
    if (!guest) {
      return NextResponse.json({ success: false, error: "Guest not found" }, { status: 404 });
    }

    const side = typeof guest.relationshipSide === "string" ? guest.relationshipSide : "other";
    const category =
      typeof guest.relationshipCategory === "string" ? guest.relationshipCategory : "other";

    // Guest.invitationCopy takes priority over Invitation.customOpening.
    // Users typically edit the "邀请词" field on the Guest record in Payload admin,
    // so we must prefer that value to avoid stale text.
    const customOpening =
      (typeof guest.invitationCopy === "string" && guest.invitationCopy) ||
      (typeof invitation.customOpening === "string" && invitation.customOpening) ||
      "";

    const responseData = {
      success: true,
      data: {
        inviteCode: invitation.inviteCode,
        guestName: typeof guest.name === "string" ? guest.name : "贵宾",
        relationshipSide: relationshipSideLabel[side] || "其他",
        relationshipCategory: relationshipCategoryLabel[category] || "其他",
        relationshipNote:
          typeof guest.relationshipNote === "string" ? guest.relationshipNote : "",
        memorySnippet: typeof guest.memorySnippet === "string" ? guest.memorySnippet : "",
        customOpening,
        maxGuestCount:
          typeof invitation.maxGuestCount === "number" ? invitation.maxGuestCount : 1,
      },
    };

    return NextResponse.json(responseData, {
      headers: noCacheHeaders,
    });
  } catch (error) {
    console.error("Failed to fetch invitation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invitation" },
      { status: 500 }
    );
  }
}
