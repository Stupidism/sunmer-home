import type { CollectionConfig } from "payload";
import { isCMSAdmin } from "../access/isCMSAdmin";

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
        description: "可用于生成个性化邀请链接 ?code=...",
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
