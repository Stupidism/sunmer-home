import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload/client";

const E2E_FALLBACK_PREFIX = "e2e-fallback:";

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
        { status: 400 },
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

      await payload.create({
        collection: "rsvps",
        data: {
          displayTitle: `${guestName}-${new Date().toISOString().slice(0, 10)}`,
          guest: guest.id,
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

      // Update guest status to responded
      await payload.update({
        collection: "guests",
        id: guest.id,
        data: { status: "responded" },
        overrideAccess: true,
      });

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
        { status: 201 },
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
        { status: 201 },
      );
    }

    const payload = await getPayloadClient();

    const guestResult = await payload.find({
      collection: "guests",
      limit: 1,
      where: { inviteCode: { equals: inviteCode } },
      overrideAccess: true,
    });

    const guest = guestResult.docs[0] as Record<string, unknown> | undefined;
    if (!guest) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 },
      );
    }

    const guestId = guest.id;
    if (guestId === undefined || guestId === null || guestId === "") {
      return NextResponse.json(
        { success: false, error: "Invalid guest" },
        { status: 400 },
      );
    }

    const guestNameFromRecord =
      typeof guest.name === "string" && guest.name.trim() ? guest.name : guestName;

    const maxGuestCount = Number(guest.maxGuestCount ?? 1);
    if (guestCount > maxGuestCount) {
      return NextResponse.json(
        {
          success: false,
          error: `Guest count exceeds limit (${maxGuestCount})`,
        },
        { status: 400 },
      );
    }

    const existingRSVPResult = await payload.find({
      collection: "rsvps",
      limit: 1,
      where: { guest: { equals: guestId } },
      overrideAccess: true,
    });

    const rsvpData = {
      displayTitle: `${guestNameFromRecord}-${new Date().toISOString().slice(0, 10)}`,
      guest: guestId,
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

    // Update guest status to responded
    await payload.update({
      collection: "guests",
      id: guestId,
      data: { status: "responded" },
      overrideAccess: true,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: rsvp.id,
          name: guestNameFromRecord,
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
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create RSVP:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save RSVP" },
      { status: 500 },
    );
  }
}
