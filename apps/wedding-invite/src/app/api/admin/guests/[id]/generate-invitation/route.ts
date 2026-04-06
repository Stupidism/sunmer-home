import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getPayloadClient } from "@/lib/payload/client";

function makeDeterministicInviteCode(guestRelationID: string | number): string {
  return `guest-${String(guestRelationID)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

function estimateMaxGuestCount(guest: Record<string, unknown>): number {
  const isSingle = Boolean(guest.isSingle);
  const hasChildren = Boolean(guest.hasChildren);
  const childrenCount = Number(guest.childrenCount || 0);
  const spouseCount = isSingle ? 0 : 1;
  const childCount = hasChildren ? Math.max(0, childrenCount) : 0;
  return Math.max(1, 1 + spouseCount + childCount);
}

async function generateInvitationCopyWithDeepSeek(input: {
  guestName: string;
  relationshipNote: string;
  memorySnippet: string;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return `亲爱的${input.guestName}，${input.memorySnippet}`;
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const prompt = `背景：\n1) 这是我和伴侣给宾客发送的婚礼邀请词，不是第三方旁白，也不是获奖感言。\n2) 下方"共同回忆"是素材池，里面可能包含碎碎念、近况问候、以及对对方未来的祝福。\n3) 你的任务不是逐句润色原文，而是基于这些素材重新写一段适合邀请函首页的邀请词。\n\n请基于下面信息生成邀请词，要求：\n- 使用第一人称邀请口吻（如"我们诚挚邀请你/您"）；\n- 必须包含宾客称呼与邀请意图，重点突出"邀请来参加婚礼"；\n- 可以引用共同回忆中的细节，但"近况问候/未来祝福"内容占比不要太大（建议不超过 30%）；\n- 语气真诚自然，不浮夸，不说教；\n- 严禁第三人称祝福句式（例如"祝他们幸福美满、携手到老"）；\n- 严禁把新人写成"他/她/他们"；\n- 输出 60~130 字，纯中文纯文本，不要加引号。\n\n宾客：${input.guestName}\n关系：${input.relationshipNote || "朋友"}\n共同回忆素材：${input.memorySnippet}`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: "你是婚礼文案编辑，擅长将口语化回忆润色成温暖、得体、可直接发送给宾客的中文文本。",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || `亲爱的${input.guestName}，${input.memorySnippet}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = await getPayloadClient();

    const authResult = await payload.auth({ headers: await headers() });
    if (!authResult.user || authResult.user.collection !== "cms-admins") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const guest = (await payload.findByID({
      collection: "guests",
      id,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, unknown>;

    const guestName = typeof guest.name === "string" ? guest.name : "贵宾";
    const relationshipNote = typeof guest.relationshipNote === "string" ? guest.relationshipNote : "";
    const rawMemory = typeof guest.memorySnippet === "string" ? guest.memorySnippet.trim() : "";
    const memoryInput = rawMemory || `和${guestName}一路走来，有很多值得珍藏的回忆。`;

    let invitationCopy =
      typeof guest.invitationCopy === "string" && (guest.invitationCopy as string).trim()
        ? (guest.invitationCopy as string).trim()
        : `亲爱的${guestName}，${memoryInput}`;
    let aiUsed = false;
    try {
      invitationCopy = await generateInvitationCopyWithDeepSeek({
        guestName,
        relationshipNote,
        memorySnippet: memoryInput,
      });
      aiUsed = invitationCopy !== `亲爱的${guestName}，${memoryInput}`;
    } catch (error) {
      console.warn("[generate-invitation] DeepSeek polishing skipped:", error);
    }

    const inviteCode =
      (typeof guest.inviteCode === "string" && guest.inviteCode) ||
      makeDeterministicInviteCode(String(guest.id ?? id));

    // Preserve "responded" status – only advance to "sent" from "draft"
    const currentStatus = typeof guest.status === "string" ? guest.status : "draft";
    const newStatus = currentStatus === "responded" ? "responded" : "sent";

    await payload.update({
      collection: "guests",
      id,
      data: {
        invitationCopy,
        inviteCode,
        maxGuestCount: Math.min(10, estimateMaxGuestCount(guest)),
        status: newStatus,
      },
      overrideAccess: true,
    });

    return NextResponse.json({
      success: true,
      aiUsed,
      guestName,
      inviteCode,
      invitationCopy,
    });
  } catch (error) {
    console.error("[generate-invitation] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate invitation",
      },
      { status: 500 },
    );
  }
}
