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

  let guestCreated = 0;
  let guestUpdated = 0;

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

    const existingDoc = existingGuest.docs[0] as
      | { id: string | number; inviteCode?: string }
      | undefined;

    const inviteCode =
      (typeof existingDoc?.inviteCode === "string" && existingDoc.inviteCode) ||
      makeInviteCode(item.name);

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
      inviteCode,
      maxGuestCount: Math.max(1, item.estimatedGuestCount),
      status: "sent" as const,
    };

    if (existingDoc) {
      await payload.update({
        collection: "guests",
        id: existingDoc.id,
        data: guestData,
        overrideAccess: true,
      });
      guestUpdated += 1;
    } else {
      await payload.create({
        collection: "guests",
        data: guestData,
        overrideAccess: true,
      });
      guestCreated += 1;
    }
  }

  console.log(
    `[seed-initial-guests] done: guests(created=${guestCreated}, updated=${guestUpdated})`,
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
