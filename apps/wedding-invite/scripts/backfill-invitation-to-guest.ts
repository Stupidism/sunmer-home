/**
 * backfill-invitation-to-guest.ts
 *
 * One-time migration: copies invitation data from the legacy `invitations`
 * table (which is being removed from the Payload config) into the
 * corresponding `guests` rows.
 *
 * Fields copied:
 *   invitations.invite_code   -> guests.invite_code
 *   invitations.share_link    -> guests.share_link
 *   invitations.max_guest_count -> guests.max_guest_count
 *   invitations.status        -> guests.status
 *   invitations.custom_opening -> guests.invitation_copy
 *
 * Idempotent: if a guest already has a non-empty invite_code the row is
 * skipped (unless --force is passed).
 *
 * Usage:
 *   pnpm --filter wedding-invite backfill:invitation-to-guest
 *   pnpm --filter wedding-invite backfill:invitation-to-guest --force
 */

import config from "../payload.config";
import { getPayload } from "payload";

const FORCE = process.argv.includes("--force");

interface InvitationRow {
  id: number;
  guest_id: number;
  invite_code: string | null;
  share_link: string | null;
  max_guest_count: number | null;
  status: string | null;
  custom_opening: string | null;
}

async function main() {
  const payload = await getPayload({ config });

  // Use raw SQL via the db adapter to read the legacy invitations table,
  // because the Invitations collection has been removed from Payload config.
  const drizzle = (payload.db as unknown as { drizzle: { execute: (sql: unknown) => Promise<unknown> } }).drizzle;

  if (!drizzle?.execute) {
    throw new Error(
      "Could not access drizzle.execute – check that the Payload DB adapter exposes it.",
    );
  }

  // Drizzle's execute with sql tagged template from drizzle-orm
  const { sql } = await import("drizzle-orm");

  const result = await drizzle.execute(
    sql`SELECT id, guest_id, invite_code, share_link, max_guest_count, status, custom_opening FROM invitations`,
  );

  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as InvitationRow[];

  if (rows.length === 0) {
    console.log("[backfill] No rows found in invitations table. Nothing to do.");
    await destroyDB(payload);
    return;
  }

  console.log(`[backfill] Found ${rows.length} invitation(s) to migrate.`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const guestId = row.guest_id;
    if (!guestId) {
      console.warn(`[backfill] Skipping invitation ${row.id}: no guest_id`);
      skipped += 1;
      continue;
    }

    try {
      const guest = (await payload.findByID({
        collection: "guests",
        id: guestId,
        depth: 0,
        overrideAccess: true,
      })) as Record<string, unknown>;

      // Idempotent check: skip if guest already has an inviteCode (unless --force)
      if (!FORCE && typeof guest.inviteCode === "string" && guest.inviteCode.trim()) {
        console.log(
          `[backfill] Skipping guest ${guestId} (${guest.name}): already has inviteCode "${guest.inviteCode}"`,
        );
        skipped += 1;
        continue;
      }

      const data: Record<string, unknown> = {};

      if (row.invite_code) {
        data.inviteCode = row.invite_code;
      }
      if (row.share_link) {
        data.shareLink = row.share_link;
      }
      if (row.max_guest_count != null) {
        data.maxGuestCount = row.max_guest_count;
      }
      if (row.status) {
        data.status = row.status;
      }
      if (row.custom_opening) {
        // customOpening -> invitationCopy (only if guest doesn't already have one)
        const existingCopy =
          typeof guest.invitationCopy === "string" && guest.invitationCopy.trim();
        if (!existingCopy || FORCE) {
          data.invitationCopy = row.custom_opening;
        }
      }

      if (Object.keys(data).length === 0) {
        console.log(`[backfill] Skipping guest ${guestId} (${guest.name}): no data to update`);
        skipped += 1;
        continue;
      }

      await payload.update({
        collection: "guests",
        id: guestId,
        data,
        overrideAccess: true,
      });

      console.log(
        `[backfill] Updated guest ${guestId} (${guest.name}) with fields: ${Object.keys(data).join(", ")}`,
      );
      updated += 1;
    } catch (error) {
      console.error(`[backfill] Failed to update guest ${guestId}:`, error);
      failed += 1;
    }
  }

  console.log(
    `[backfill] Done: updated=${updated}, skipped=${skipped}, failed=${failed}`,
  );

  await destroyDB(payload);
}

async function destroyDB(payload: { db: { destroy?: () => Promise<void> } }) {
  if (payload.db && typeof payload.db.destroy === "function") {
    await payload.db.destroy();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exit(1);
  });
