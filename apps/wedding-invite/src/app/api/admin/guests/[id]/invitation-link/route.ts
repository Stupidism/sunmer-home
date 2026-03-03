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

function buildShareLink(inviteCode: string): string {
  const site = process.env.WEDDING_INVITE_SITE_URL || "https://wedding.sunmer.xyz";
  return `${site.replace(/\/$/, "")}/invite/${encodeURIComponent(inviteCode)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ success: true, exists: false, shareLink: null, inviteCode: null });
    }

    const inviteCode =
      typeof invitation.inviteCode === "string" && invitation.inviteCode.trim()
        ? invitation.inviteCode.trim()
        : null;
    const shareLink =
      typeof invitation.shareLink === "string" && invitation.shareLink.trim()
        ? invitation.shareLink.trim()
        : inviteCode
          ? buildShareLink(inviteCode)
          : null;

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
