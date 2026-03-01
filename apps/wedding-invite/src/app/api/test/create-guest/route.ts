import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

type CreateGuestBody = {
  name?: string;
  memorySnippet?: string;
  relationshipNote?: string;
};

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
        { status: 400 }
      );
    }

    const payload = await getPayloadClient();
    const guest = await payload.create({
      collection: "guests",
      data: {
        name,
        memorySnippet,
        relationshipNote: relationshipNote || "E2E created guest",
        relationshipCategory: "friend",
        relationshipSide: "groom",
        isSingle: true,
        hasChildren: false,
      },
      overrideAccess: true,
    });

    let invitation: { shareLink?: string; inviteCode?: string } | undefined;
    let lastError: unknown;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const invitations = await payload.find({
          collection: "invitations",
          where: { guest: { equals: guest.id } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        });

        invitation = invitations.docs[0] as { shareLink?: string; inviteCode?: string } | undefined;
        if (invitation?.shareLink || invitation?.inviteCode) {
          break;
        }
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!invitation?.inviteCode && !invitation?.shareLink) {
      try {
        const createdInvitation = (await payload.create({
          collection: "invitations",
          data: {
            title: `${name} 的邀请函`,
            guest: guest.id,
            maxGuestCount: 1,
            status: "draft",
            customOpening: `亲爱的${name}，欢迎来参加我们的婚礼。`,
          },
          overrideAccess: true,
        })) as { shareLink?: string; inviteCode?: string };

        invitation = createdInvitation;
      } catch (error) {
        lastError = error;
      }
    }

    if (!invitation?.inviteCode && !invitation?.shareLink && lastError) {
      throw lastError;
    }

    return NextResponse.json({
      success: true,
      guestId: guest.id,
      shareLink: invitation?.shareLink || null,
      inviteCode: invitation?.inviteCode || null,
    });
  } catch (error) {
    console.error("Failed to create E2E guest", error);
    const message = error instanceof Error ? error.message : "Failed to create E2E guest";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
