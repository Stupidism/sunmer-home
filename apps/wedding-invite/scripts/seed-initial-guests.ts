import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import config from "../payload.config";
import { getPayload } from "payload";

type GuestDraft = {
  group: string;
  name: string;
  companions: string[];
  estimatedGuestCount: number;
  isSingle: boolean;
  hasChildren: boolean;
  childrenCount: number;
  relationshipCategory:
    | "friend"
    | "classmate"
    | "junior_high_classmate"
    | "high_school_classmate"
    | "relative"
    | "colleague"
    | "other";
  relationshipSide:
    | "groom"
    | "bride"
    | "groom_father"
    | "groom_mother"
    | "bride_father"
    | "bride_mother"
    | "groom_family"
    | "bride_family"
    | "both"
    | "other";
  relationshipNote: string;
};

function normalizeRelationID(value: unknown): string | number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return trimmed;
  }

  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function makeInviteCode(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${normalized || "guest"}-${randomBytes(3).toString("hex")}`;
}

async function main() {
  const payload = await getPayload({ config });
  const dataPath = path.resolve(__dirname, "../data/guest-draft-list.json");
  const raw = await readFile(dataPath, "utf8");
  const list = JSON.parse(raw) as GuestDraft[];
  const invitationSnapshot = await payload.find({
    collection: "invitations",
    depth: 0,
    limit: 1000,
    overrideAccess: true,
  });
  const invitations = invitationSnapshot.docs as Array<{
    id: number | string;
    guest?: unknown;
    title?: unknown;
    inviteCode?: unknown;
  }>;

  let guestCreated = 0;
  let guestUpdated = 0;
  let invitationCreated = 0;
  let invitationUpdated = 0;

  for (const item of list) {
    const existingGuest = await payload.find({
      collection: "guests",
      where: { name: { equals: item.name } },
      limit: 1,
      overrideAccess: true,
    });

    const memorySnippet =
      item.companions.length > 0
        ? `${item.group}阶段的朋友，计划同行：${item.companions.join("、")}`
        : `${item.group}阶段的朋友`;

    const guestData = {
      name: item.name,
      isSingle: item.isSingle,
      hasChildren: item.hasChildren,
      childrenCount: item.childrenCount,
      relationshipCategory: item.relationshipCategory,
      relationshipSide: item.relationshipSide,
      relationshipNote: item.relationshipNote,
      memorySnippet,
      invitationCopy: `亲爱的${item.name}，${memorySnippet}`,
    };

    const guest =
      existingGuest.docs.length > 0
        ? await payload.update({
            collection: "guests",
            id: existingGuest.docs[0].id,
            data: guestData,
            overrideAccess: true,
          })
        : await payload.create({
            collection: "guests",
            data: guestData,
            overrideAccess: true,
          });

    if (existingGuest.docs.length > 0) {
      guestUpdated += 1;
    } else {
      guestCreated += 1;
    }

    const guestID = normalizeRelationID(guest.id);
    if (guestID === null) {
      throw new Error(`[seed-initial-guests] invalid guest id for ${item.name}`);
    }

    const expectedTitle = `${item.name} 的邀请函`;
    const existingInvitation =
      invitations.find((doc) => normalizeRelationID(doc.guest) === guestID) ||
      invitations.find((doc) => doc.title === expectedTitle);

    const invitationData = {
      title: expectedTitle,
      guest: guestID,
      inviteCode:
        (typeof existingInvitation?.inviteCode === "string" && existingInvitation.inviteCode) ||
        makeInviteCode(item.name),
      maxGuestCount: Math.max(1, item.estimatedGuestCount),
      status: "sent" as const,
      customOpening: `亲爱的${item.name}，诚挚邀请您来参加我们的婚礼。`,
    };

    if (existingInvitation) {
      const updatedInvitation = await payload.update({
        collection: "invitations",
        id: existingInvitation.id,
        data: invitationData,
        overrideAccess: true,
      });
      const idx = invitations.findIndex((doc) => doc.id === existingInvitation.id);
      if (idx >= 0) {
        invitations[idx] = updatedInvitation as typeof invitations[number];
      }
      invitationUpdated += 1;
    } else {
      const createdInvitation = await payload.create({
        collection: "invitations",
        data: invitationData,
        overrideAccess: true,
      });
      invitations.push(createdInvitation as typeof invitations[number]);
      invitationCreated += 1;
    }
  }

  console.log(
    `[seed-initial-guests] done: guests(created=${guestCreated}, updated=${guestUpdated}), invitations(created=${invitationCreated}, updated=${invitationUpdated})`
  );

  if (payload.db && typeof payload.db.destroy === "function") {
    await payload.db.destroy();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("[seed-initial-guests] failed:", error);
    process.exit(1);
  });
