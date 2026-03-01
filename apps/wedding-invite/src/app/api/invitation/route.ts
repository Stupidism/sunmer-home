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

const E2E_CODE_PREFIX = "e2e-code:";

function isMissingInvitationsRelation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes('relation "invitations" does not exist');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Code is required" }, { status: 400 });
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
            typeof guest.name === "string" ? `亲爱的${guest.name}，欢迎来参加我们的婚礼。` : "",
          maxGuestCount: 1,
        },
      });
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

    return NextResponse.json({
      success: true,
      data: {
        inviteCode: invitation.inviteCode,
        guestName: typeof guest.name === "string" ? guest.name : "贵宾",
        relationshipSide: relationshipSideLabel[side] || "其他",
        relationshipCategory: relationshipCategoryLabel[category] || "其他",
        relationshipNote:
          typeof guest.relationshipNote === "string" ? guest.relationshipNote : "",
        memorySnippet: typeof guest.memorySnippet === "string" ? guest.memorySnippet : "",
        customOpening:
          typeof invitation.customOpening === "string" ? invitation.customOpening : "",
        maxGuestCount:
          typeof invitation.maxGuestCount === "number" ? invitation.maxGuestCount : 1,
      },
    });
  } catch (error) {
    console.error("Failed to fetch invitation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch invitation" },
      { status: 500 }
    );
  }
}
