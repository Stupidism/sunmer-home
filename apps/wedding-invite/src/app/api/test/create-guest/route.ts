import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getPayloadClient } from "@/lib/payload/client";

type CreateGuestBody = {
  name?: string;
  memorySnippet?: string;
  relationshipNote?: string;
};

type InvitationRecord = {
  id?: string;
  shareLink?: string;
  inviteCode?: string;
  guest?: { id?: string; name?: string; memorySnippet?: string } | string;
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

    const pickExistingInvitation = async () => {
      const result = await payload.find({
        collection: "invitations",
        where: { inviteCode: { exists: true } },
        sort: "-updatedAt",
        limit: 1,
        depth: 1,
        overrideAccess: true,
      });

      return result.docs[0] as InvitationRecord | undefined;
    };

    let guest:
      | {
          id: string;
          name?: string;
          memorySnippet?: string;
        }
      | undefined;

    let creationError: unknown;
    try {
      guest = (await payload.create({
        collection: "guests",
        data: {
          id: randomUUID(),
          name,
          memorySnippet,
          relationshipNote: relationshipNote || "E2E created guest",
          relationshipCategory: "friend",
          relationshipSide: "groom",
          isSingle: true,
          hasChildren: false,
        },
        overrideAccess: true,
      })) as { id: string; name?: string; memorySnippet?: string };
    } catch (error) {
      creationError = error;
    }

    let invitation: { shareLink?: string; inviteCode?: string } | undefined;
    let lastError: unknown;

    for (let attempt = 0; guest && attempt < 20; attempt += 1) {
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

    if (guest && !invitation?.inviteCode && !invitation?.shareLink) {
      try {
        const createdInvitation = (await payload.create({
          collection: "invitations",
          data: {
            id: randomUUID(),
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

    if (!invitation?.inviteCode && !invitation?.shareLink) {
      const existingInvitation = await pickExistingInvitation();
      if (existingInvitation) {
        const existingGuest =
          existingInvitation.guest && typeof existingInvitation.guest === "object"
            ? existingInvitation.guest
            : undefined;

        return NextResponse.json({
          success: true,
          guestId: existingGuest?.id || guest?.id || null,
          guestName: existingGuest?.name || guest?.name || name,
          memorySnippet: existingGuest?.memorySnippet || guest?.memorySnippet || memorySnippet,
          shareLink: existingInvitation.shareLink || null,
          inviteCode: existingInvitation.inviteCode || null,
          fallback: true,
          warning:
            creationError instanceof Error
              ? creationError.message
              : lastError instanceof Error
                ? lastError.message
                : null,
        });
      }

      if (lastError) {
        throw lastError;
      }

      if (creationError) {
        throw creationError;
      }
    }

    return NextResponse.json({
      success: true,
      guestId: guest?.id || null,
      guestName: guest?.name || name,
      memorySnippet: guest?.memorySnippet || memorySnippet,
      shareLink: invitation?.shareLink || null,
      inviteCode: invitation?.inviteCode || null,
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
