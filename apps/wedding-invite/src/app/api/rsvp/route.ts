import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

function toGuestName(guest: unknown): string {
  if (!guest || typeof guest !== "object") {
    return "未知宾客";
  }

  const value = (guest as { name?: unknown }).name;
  return typeof value === "string" && value.trim() ? value : "未知宾客";
}

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

function isNoDatabaseFallbackCode(code: string): boolean {
  return code.startsWith(E2E_FALLBACK_PREFIX);
}

export async function GET() {
  return NextResponse.json({ success: false, error: "Not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const guestCount = Number.parseInt(String(body.guestCount), 10) || 1;
    const guestName = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const status =
      body.status === "not_attending" || body.status === "pending"
        ? body.status
        : "attending";
    const arrivalPlan =
      body.arrivalPlan === "arrive_early" ||
      body.arrivalPlan === "leave_late" ||
      body.arrivalPlan === "both"
        ? body.arrivalPlan
        : "same_day";
    const needsHotel = Boolean(body.needsHotel);
    const hotelNights =
      body.hotelNights === "before" || body.hotelNights === "after" || body.hotelNights === "both"
        ? body.hotelNights
        : "none";
    const transportPreference =
      body.transportPreference === "far_combo" ? "far_combo" : "near_rideshare_hsr";
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

    if (!guestName) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // Walk-in RSVP: no invite code provided (submitted from homepage)
    if (!inviteCode) {
      const payload = await getPayloadClient();

      // Create a walk-in guest record
      const guest = await payload.create({
        collection: "guests",
        data: {
          name: guestName,
          phone,
          relationshipNote: "主页直接填写",
        },
        overrideAccess: true,
      });

      // Wait for the auto-created invitation (created asynchronously by Guests afterChange hook)
      let invitationId: string | number | undefined;
      for (let attempt = 0; attempt < 10; attempt++) {
        const invitations = await payload.find({
          collection: "invitations",
          limit: 1,
          where: { guest: { equals: guest.id } },
          overrideAccess: true,
        });
        const doc = invitations.docs[0];
        if (doc) {
          invitationId = doc.id;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (invitationId !== undefined) {
        await payload.create({
          collection: "rsvps",
          data: {
            displayTitle: `${guestName}-${new Date().toISOString().slice(0, 10)}`,
            guest: guest.id,
            invitation: invitationId,
            status,
            confirmedGuestCount: guestCount,
            phone,
            message,
            arrivalPlan,
            needsHotel,
            hotelNights,
            transportPreference,
            respondedAt: new Date().toISOString(),
          },
          overrideAccess: true,
        });

        await payload.update({
          collection: "invitations",
          id: invitationId,
          data: { status: "responded" },
          overrideAccess: true,
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            id: guest.id,
            name: guestName,
            guest_count: guestCount,
            phone,
            message,
            arrivalPlan,
            needsHotel,
            hotelNights,
            transportPreference,
            status,
            submitted_at: new Date().toISOString(),
          },
        },
        { status: 201 }
      );
    }

    if (isNoDatabaseFallbackCode(inviteCode)) {
      return NextResponse.json(
        {
          success: true,
          data: {
            id: `fallback-${Date.now()}`,
            name: guestName,
            guest_count: guestCount,
            phone,
            message,
            arrivalPlan,
            needsHotel,
            hotelNights,
            transportPreference,
            status,
            submitted_at: new Date().toISOString(),
            fallback: true,
          },
        },
        { status: 201 }
      );
    }

    const payload = await getPayloadClient();

    let invitationResult:
      | {
          docs: Array<Record<string, unknown>>;
        }
      | undefined;
    let missingInvitationsRelation = false;
    try {
      invitationResult = await payload.find({
        collection: "invitations",
        limit: 1,
        where: { inviteCode: { equals: inviteCode } },
        overrideAccess: true,
      });
    } catch (error) {
      if (!isMissingInvitationsRelation(error)) {
        throw error;
      }
      missingInvitationsRelation = true;
    }

    if (missingInvitationsRelation) {
      const guestResult = await payload.find({
        collection: "guests",
        limit: 1,
        where: { phone: { equals: `${E2E_CODE_PREFIX}${inviteCode}` } },
        overrideAccess: true,
      });
      const guest = guestResult.docs[0] as { id?: string; name?: string } | undefined;
      if (!guest?.id) {
        return NextResponse.json(
          { success: false, error: "Invitation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            id: `fallback-${guest.id}`,
            name: guest.name || guestName || "未知宾客",
            guest_count: guestCount,
            phone,
            message,
            arrivalPlan,
            needsHotel,
            hotelNights,
            transportPreference,
            status,
            submitted_at: new Date().toISOString(),
            fallback: true,
          },
        },
        { status: 201 }
      );
    }

    const invitationDoc = asRecord(invitationResult?.docs[0]);
    if (!invitationDoc) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    const invitationGuest = invitationDoc.guest;
    const invitationGuestRecord = asRecord(invitationGuest);
    const guestId =
      invitationGuestRecord
        ? invitationGuestRecord.id
        : invitationGuest;

    if (guestId === undefined || guestId === null || guestId === "") {
      return NextResponse.json(
        { success: false, error: "Invalid invitation guest" },
        { status: 400 }
      );
    }

    const guestNameFromInvite =
      invitationGuestRecord
        ? toGuestName(invitationGuest)
        : guestName;

    const maxGuestCount = Number(invitationDoc.maxGuestCount ?? 1);
    const invitationIdRaw = invitationDoc.id;
    if (
      (typeof invitationIdRaw !== "string" && typeof invitationIdRaw !== "number") ||
      invitationIdRaw === ""
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation id" },
        { status: 400 }
      );
    }
    const invitationId = invitationIdRaw;
    if (guestCount > maxGuestCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Guest count exceeds limit (${maxGuestCount})`,
        },
        { status: 400 }
      );
    }

    const existingRSVPResult = await payload.find({
      collection: "rsvps",
      limit: 1,
      where: { invitation: { equals: invitationId } },
      overrideAccess: true,
    });

    const rsvpData = {
      displayTitle: `${guestNameFromInvite}-${new Date().toISOString().slice(0, 10)}`,
      guest: guestId,
      invitation: invitationId,
      status,
      confirmedGuestCount: guestCount,
      phone,
      message,
      arrivalPlan,
      needsHotel,
      hotelNights,
      transportPreference,
      respondedAt: new Date().toISOString(),
    };

    const existingRSVP = existingRSVPResult.docs[0];
    const rsvp = existingRSVP
      ? await payload.update({
          collection: "rsvps",
          id: existingRSVP.id,
          data: rsvpData,
          overrideAccess: true,
        })
      : await payload.create({
          collection: "rsvps",
          data: rsvpData,
          overrideAccess: true,
        });

    await payload.update({
      collection: "invitations",
      id: invitationId,
      data: {
        status: "responded",
      },
      overrideAccess: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rsvp.id,
          name: guestNameFromInvite,
          guest_count: guestCount,
          phone,
          message,
          arrivalPlan,
          needsHotel,
          hotelNights,
          transportPreference,
          status,
          submitted_at: rsvp.respondedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create RSVP:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save RSVP" },
      { status: 500 }
    );
  }
}
