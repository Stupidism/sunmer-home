import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

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

const E2E_FALLBACK_PREFIX = "e2e-fallback:";

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

    const noDatabaseFallback = decodeNoDatabaseFallback(code);
    if (noDatabaseFallback) {
      return NextResponse.json(
        {
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
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const payload = await getPayloadClient();

    const guestResult = await payload.find({
      collection: "guests",
      where: { inviteCode: { equals: code } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    });

    const guest = guestResult.docs[0] as Record<string, unknown> | undefined;
    if (!guest) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const side = typeof guest.relationshipSide === "string" ? guest.relationshipSide : "other";
    const category =
      typeof guest.relationshipCategory === "string" ? guest.relationshipCategory : "other";

    return NextResponse.json(
      {
        success: true,
        data: {
          inviteCode: guest.inviteCode,
          guestName: typeof guest.name === "string" ? guest.name : "贵宾",
          relationshipSide: relationshipSideLabel[side] || "其他",
          relationshipCategory: relationshipCategoryLabel[category] || "其他",
          relationshipNote:
            typeof guest.relationshipNote === "string" ? guest.relationshipNote : "",
          memorySnippet: typeof guest.memorySnippet === "string" ? guest.memorySnippet : "",
          customOpening:
            typeof guest.invitationCopy === "string" ? guest.invitationCopy : "",
          maxGuestCount:
            typeof guest.maxGuestCount === "number" ? guest.maxGuestCount : 1,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to fetch invitation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invitation" },
      { status: 500 },
    );
  }
}
