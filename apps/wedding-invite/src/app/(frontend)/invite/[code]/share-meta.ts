import { getPayloadClient } from "@/lib/payload/client";

const roleLabelByRelationshipSide: Record<string, string> = {
  bride: "洪丽暖",
  groom: "孙逢",
  groom_father: "孙逢",
  groom_mother: "孙逢",
  bride_father: "洪丽暖",
  bride_mother: "洪丽暖",
  groom_family: "孙逢",
  bride_family: "洪丽暖",
  both: "孙逢和洪丽暖",
  other: "孙逢和洪丽暖",
};

export function decodeInviteCode(code: string): string {
  try {
    return decodeURIComponent(code);
  } catch {
    return code;
  }
}

function guessGuestNameFromCode(code: string): string | null {
  const decoded = decodeInviteCode(code).trim();
  if (!decoded) {
    return null;
  }

  const parts = decoded.split("-");
  if (parts.length >= 2 && /^[a-z0-9]{4,8}$/i.test(parts[parts.length - 1])) {
    const guessed = parts.slice(0, -1).join("-").trim();
    return guessed || null;
  }

  return decoded;
}

export async function getInviteShareMeta(code: string): Promise<{ guestName: string; hostRole: string }> {
  const decodedCode = decodeInviteCode(code);
  const fallback = {
    guestName: guessGuestNameFromCode(decodedCode) || "贵宾",
    hostRole: "孙逢和洪丽暖",
  };

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "invitations",
      where: { inviteCode: { equals: decodedCode } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    });

    const invitation = result.docs[0] as
      | {
          guest?: {
            name?: unknown;
            relationshipSide?: unknown;
          };
        }
      | undefined;

    const guestName =
      invitation?.guest && typeof invitation.guest.name === "string" && invitation.guest.name.trim()
        ? invitation.guest.name.trim()
        : null;
    if (!guestName) {
      return fallback;
    }

    const relationshipSide =
      invitation?.guest && typeof invitation.guest.relationshipSide === "string"
        ? invitation.guest.relationshipSide
        : "other";

    return {
      guestName,
      hostRole: roleLabelByRelationshipSide[relationshipSide] || fallback.hostRole,
    };
  } catch (error) {
    console.warn("[invite/[code]] share meta lookup failed:", error);
    return fallback;
  }
}

export function buildInviteShareTitle(guestName: string, hostRole: string): string {
  return `${guestName} ${hostRole}邀请你参加婚礼`;
}

export function buildInviteShareDescription(): string {
  return "孙逢与洪丽暖诚邀您见证我们的幸福时刻，查看婚礼时间、地点与回执安排。";
}

export async function getInviteShareImageURL(siteURL: string): Promise<string> {
  const fallbackURL = `${siteURL.replace(/\/$/, "")}/api/share-image`;

  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "memory-photos",
      where: {
        and: [{ category: { equals: "couple" } }, { url: { exists: true } }],
      },
      sort: "-updatedAt",
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });

    const photo = result.docs[0] as { url?: unknown } | undefined;
    if (photo && typeof photo.url === "string" && /^https?:\/\//.test(photo.url)) {
      return photo.url;
    }
  } catch (error) {
    console.warn("[invite/[code]] share image lookup failed:", error);
  }

  return fallbackURL;
}
