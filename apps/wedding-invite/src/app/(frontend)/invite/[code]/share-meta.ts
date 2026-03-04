import { getPayloadClient } from "@/lib/payload/client";

const roleLabelByRelationshipSide: Record<string, string> = {
  bride: "新娘",
  groom: "新郎",
  groom_father: "新郎",
  groom_mother: "新郎",
  bride_father: "新娘",
  bride_mother: "新娘",
  groom_family: "新郎",
  bride_family: "新娘",
  both: "新郎新娘",
  other: "新郎新娘",
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
    hostRole: "新郎新娘",
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
  return "诚邀您见证我们的幸福时刻，查看婚礼时间、地点与回执安排。";
}
