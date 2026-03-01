import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

function toGuestName(guest: unknown): string {
  if (!guest || typeof guest !== "object") {
    return "未知宾客";
  }

  const value = (guest as { name?: unknown }).name;
  return typeof value === "string" && value.trim() ? value : "未知宾客";
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

    if (!guestName || !inviteCode) {
      return NextResponse.json(
        { success: false, error: "Name and invite code are required" },
        { status: 400 }
      );
    }

    const payload = await getPayloadClient();

    const invitationResult = await payload.find({
      collection: "invitations",
      limit: 1,
      where: { inviteCode: { equals: inviteCode } },
      overrideAccess: true,
    });

    const invitationDoc = invitationResult.docs[0];
    if (!invitationDoc) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    const invitationGuest = invitationDoc.guest;
    const guestId =
      invitationGuest && typeof invitationGuest === "object"
        ? invitationGuest.id
        : invitationGuest;

    if (guestId === undefined || guestId === null || guestId === "") {
      return NextResponse.json(
        { success: false, error: "Invalid invitation guest" },
        { status: 400 }
      );
    }

    const guestNameFromInvite =
      invitationGuest && typeof invitationGuest === "object"
        ? toGuestName(invitationGuest)
        : guestName;

    const maxGuestCount = Number(invitationDoc.maxGuestCount ?? 1);
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
      where: { invitation: { equals: invitationDoc.id } },
      overrideAccess: true,
    });

    const rsvpData = {
      displayTitle: `${guestNameFromInvite}-${new Date().toISOString().slice(0, 10)}`,
      guest: guestId,
      invitation: invitationDoc.id,
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
      id: invitationDoc.id,
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
