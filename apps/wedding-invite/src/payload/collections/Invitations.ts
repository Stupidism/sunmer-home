import type { CollectionConfig } from "payload";
import { revalidatePath } from "next/cache";
import { isCMSAdmin } from "../access/isCMSAdmin";

function makeInviteCode(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${normalized || "guest"}-${suffix}`;
}

function buildShareLink(inviteCode: string): string {
  const site = process.env.WEDDING_INVITE_SITE_URL || "https://wedding.sunmer.xyz";
  return `${site.replace(/\/$/, "")}/invite/${encodeURIComponent(inviteCode)}`;
}

export const Invitations: CollectionConfig = {
  slug: "invitations",
  admin: {
    useAsTitle: "title",
    group: "婚礼业务",
    defaultColumns: ["title", "guest", "maxGuestCount", "status", "updatedAt"],
  },
  access: {
    create: isCMSAdmin,
    read: isCMSAdmin,
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data) {
          return data;
        }

        if (!data.inviteCode) {
          let guestName = "guest";
          const guestValue = data.guest;
          if (guestValue && typeof guestValue === "object" && "name" in guestValue) {
            const v = (guestValue as { name?: unknown }).name;
            guestName = typeof v === "string" ? v : guestName;
          } else if (typeof guestValue === "string" || typeof guestValue === "number") {
            try {
              const guest = await req.payload.findByID({
                collection: "guests",
                id: guestValue,
                depth: 0,
                overrideAccess: true,
              });
              const v = (guest as { name?: unknown }).name;
              guestName = typeof v === "string" ? v : guestName;
            } catch {
              guestName = "guest";
            }
          }

          data.inviteCode = makeInviteCode(guestName);
        }

        if (typeof data.inviteCode === "string" && data.inviteCode.trim()) {
          data.shareLink = buildShareLink(data.inviteCode.trim());
        }

        return data;
      },
    ],
    afterChange: [
      ({ doc }) => {
        try {
          const inviteCode = typeof doc.inviteCode === "string" ? doc.inviteCode : null;
          if (inviteCode) {
            revalidatePath(`/invite/${inviteCode}`);
          }
          // Also revalidate the home page in case it lists invitations
          revalidatePath("/");
        } catch (error) {
          console.warn("[Invitations afterChange] revalidation failed:", error);
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "title",
      label: "邀请标题",
      type: "text",
      required: true,
    },
    {
      name: "guest",
      label: "对应宾客",
      type: "relationship",
      relationTo: "guests",
      required: true,
      unique: true,
    },
    {
      name: "inviteCode",
      label: "邀请码",
      type: "text",
      required: true,
      unique: true,
      admin: {
        description: "可用于生成个性化邀请链接 /invite/...",
      },
    },
    {
      name: "shareLink",
      label: "分享链接",
      type: "text",
      admin: {
        readOnly: true,
        description: "将该链接分享给宾客，链接会带上唯一邀请码",
      },
    },
    {
      name: "maxGuestCount",
      label: "最大确认人数",
      type: "number",
      required: true,
      defaultValue: 1,
      min: 1,
      max: 10,
    },
    {
      name: "status",
      label: "邀请状态",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "草稿", value: "draft" },
        { label: "已发送", value: "sent" },
        { label: "已回复", value: "responded" },
      ],
    },
    {
      name: "customOpening",
      label: "定制开场语",
      type: "textarea",
    },
  ],
};
