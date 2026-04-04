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

export const Guests: CollectionConfig = {
  slug: "guests",
  admin: {
    useAsTitle: "name",
    group: "婚礼业务",
    defaultColumns: [
      "name",
      "relationshipCategory",
      "relationshipSide",
      "inviteCode",
      "status",
      "maxGuestCount",
      "updatedAt",
    ],
  },
  access: {
    create: isCMSAdmin,
    read: isCMSAdmin,
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  hooks: {
    beforeValidate: [
      async ({ data }) => {
        if (!data) {
          return data;
        }

        if (!data.inviteCode) {
          const guestName =
            typeof data.name === "string" && data.name.trim() ? data.name : "guest";
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
          revalidatePath("/");
        } catch (error) {
          console.warn("[Guests afterChange] revalidation failed:", error);
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "name",
      label: "姓名",
      type: "text",
      required: true,
    },
    {
      name: "phone",
      label: "电话",
      type: "text",
    },
    {
      name: "isSingle",
      label: "是否单身",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "hasChildren",
      label: "是否有小孩",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "childrenCount",
      label: "小孩数量",
      type: "number",
      min: 0,
      admin: {
        condition: (_: unknown, siblingData: Record<string, unknown> | undefined) =>
          Boolean(siblingData?.hasChildren),
      },
    },
    {
      name: "relationshipCategory",
      label: "关系分类",
      type: "select",
      required: true,
      defaultValue: "friend",
      options: [
        { label: "朋友", value: "friend" },
        { label: "同学", value: "classmate" },
        { label: "初中同学", value: "junior_high_classmate" },
        { label: "高中同学", value: "high_school_classmate" },
        { label: "亲戚", value: "relative" },
        { label: "同事", value: "colleague" },
        { label: "其他", value: "other" },
      ],
    },
    {
      name: "relationshipSide",
      label: "关系归属",
      type: "select",
      required: true,
      defaultValue: "groom",
      options: [
        { label: "新郎", value: "groom" },
        { label: "新娘", value: "bride" },
        { label: "新郎爸爸", value: "groom_father" },
        { label: "新郎妈妈", value: "groom_mother" },
        { label: "新娘爸爸", value: "bride_father" },
        { label: "新娘妈妈", value: "bride_mother" },
        { label: "男方亲友", value: "groom_family" },
        { label: "女方亲友", value: "bride_family" },
        { label: "共同好友", value: "both" },
        { label: "其他", value: "other" },
      ],
    },
    {
      name: "relationshipNote",
      label: "关系说明",
      type: "textarea",
      admin: {
        description: "例如：新郎高中同桌 / 新娘舅舅等",
      },
    },
    {
      name: "memorySnippet",
      label: "共同回忆",
      type: "textarea",
      admin: {
        description: "用于生成个性化邀请函文案",
      },
    },
    {
      type: "row",
      fields: [
        {
          name: "invitationCopy",
          label: "邀请词",
          type: "textarea",
          admin: {
            width: "70%",
            description: "发送给宾客的个性化邀请文案，可点击右侧 Polish 自动生成",
          },
        },
        {
          name: "invitationCopyPolishAction",
          label: "邀请词操作",
          type: "ui",
          admin: {
            width: "30%",
            components: {
              Field: "/src/payload/components/PolishInvitationButton#PolishInvitationButton",
            },
          },
        },
      ],
    },
    // --- Fields merged from Invitations collection ---
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
  ],
};
