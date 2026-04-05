import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPayloadClient } from "@/lib/payload/client";

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

    let inviteCode =
      typeof guest.inviteCode === "string" && guest.inviteCode.trim()
        ? guest.inviteCode.trim()
        : null;

    // If no inviteCode yet, generate one and persist it
    if (!inviteCode) {
      inviteCode = makeDeterministicInviteCode(String(guest.id ?? id));

      await payload.update({
        collection: "guests",
        id,
        data: { inviteCode },
        overrideAccess: true,
      });
    }

    const shareLink = buildShareLink(inviteCode, siteURL);

    return NextResponse.json({
      success: true,
      exists: true,
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
