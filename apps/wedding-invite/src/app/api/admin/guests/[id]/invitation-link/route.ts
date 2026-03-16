import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPayloadClient } from "@/lib/payload/client";

function normalizeRelationID(value: unknown): string | number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value);
  }

  return String(value);
}

function resolvePublicSiteURL(request: Request): string {
  const envSite = (process.env.WEDDING_INVITE_SITE_URL || "").trim();
  const isLocalEnv = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(envSite);

  if (envSite && !isLocalEnv) {
    return envSite.replace(/\/$/, "");
  }

  const requestOrigin = new URL(request.url).origin;
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin);
  if (!isLocalOrigin) {
    return requestOrigin;
  }

  return "https://wedding.sunmer.xyz";
}

function buildShareLink(inviteCode: string, siteURL: string): string {
  return `${siteURL.replace(/\/$/, "")}/invite/${encodeURIComponent(inviteCode)}`;
}

function estimateMaxGuestCount(guest: Record<string, unknown>): number {
  const isSingle = Boolean(guest.isSingle);
  const hasChildren = Boolean(guest.hasChildren);
  const childrenCount = Number(guest.childrenCount || 0);
  const spouseCount = isSingle ? 0 : 1;
  const childCount = hasChildren ? Math.max(0, childrenCount) : 0;
  return Math.max(1, 1 + spouseCount + childCount);
}

function makeDeterministicInviteCode(guestRelationID: string | number): string {
  return `guest-${String(guestRelationID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const siteURL = resolvePublicSiteURL(request);
    const payload = await getPayloadClient();

    const authResult = await payload.auth({ headers: await headers() });
    if (!authResult.user || authResult.user.collection !== "cms-admins") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const guest = (await payload.findByID({
      collection: "guests",
      id,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, unknown>;
    const guestRelationID = normalizeRelationID(guest.id ?? id);

    const invitations = await payload.find({
      collection: "invitations",
      where: { guest: { equals: guestRelationID } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const invitation = invitations.docs[0] as
      | {
          id?: string | number;
          inviteCode?: unknown;
          shareLink?: unknown;
        }
      | undefined;

    if (!invitation) {
      const guestName = typeof guest.name === "string" && guest.name.trim() ? guest.name.trim() : "贵宾";
      const inviteCode = makeDeterministicInviteCode(guestRelationID);
      const shareLink = buildShareLink(inviteCode, siteURL);

      const createdInvitation = await payload.create({
        collection: "invitations",
        data: {
          title: `${guestName} 的邀请函`,
          guest: guestRelationID,
          inviteCode,
          maxGuestCount: estimateMaxGuestCount(guest),
          status: "draft",
          customOpening:
            typeof guest.invitationCopy === "string" && guest.invitationCopy.trim()
              ? guest.invitationCopy.trim()
              : `亲爱的${guestName}，诚挚邀请您参加我们的婚礼。`,
          shareLink,
        },
        overrideAccess: true,
      });

      return NextResponse.json({
        success: true,
        exists: true,
        invitationID: createdInvitation.id ?? null,
        inviteCode,
        shareLink,
      });
    }

    const inviteCode =
      typeof invitation.inviteCode === "string" && invitation.inviteCode.trim()
        ? invitation.inviteCode.trim()
        : null;
    const shareLink = inviteCode ? buildShareLink(inviteCode, siteURL) : null;

    return NextResponse.json({
      success: true,
      exists: true,
      invitationID: invitation.id ?? null,
      inviteCode,
      shareLink,
    });
  } catch (error) {
    console.error("[invitation-link] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch invitation link" },
      { status: 500 },
    );
  }
}
