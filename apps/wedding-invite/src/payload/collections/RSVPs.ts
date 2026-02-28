import type { CollectionConfig } from "payload";
import { isCMSAdmin } from "../access/isCMSAdmin";

export const RSVPs: CollectionConfig = {
  slug: "rsvps",
  admin: {
    useAsTitle: "displayTitle",
    group: "婚礼业务",
    defaultColumns: [
      "displayTitle",
      "status",
      "confirmedGuestCount",
      "respondedAt",
      "updatedAt",
    ],
  },
  access: {
    create: isCMSAdmin,
    read: ({ req }) => Boolean(req.user),
    update: isCMSAdmin,
    delete: isCMSAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) {
          return data;
        }

        const title = typeof data.displayTitle === "string" ? data.displayTitle : "";
        if (!title) {
          const status = typeof data.status === "string" ? data.status : "pending";
          const count =
            typeof data.confirmedGuestCount === "number" ? data.confirmedGuestCount : 1;
          data.displayTitle = `RSVP-${status}-${count}`;
        }

        if (!data.respondedAt) {
          data.respondedAt = new Date().toISOString();
        }

        return data;
      },
    ],
  },
  fields: [
    {
      name: "displayTitle",
      label: "标题",
      type: "text",
      required: true,
      admin: {
        description: "后台展示标题，默认自动生成",
      },
    },
    {
      name: "guest",
      label: "宾客",
      type: "relationship",
      relationTo: "guests",
      required: true,
    },
    {
      name: "invitation",
      label: "邀请函",
      type: "relationship",
      relationTo: "invitations",
      required: true,
    },
    {
      name: "status",
      label: "回复状态",
      type: "select",
      required: true,
      defaultValue: "attending",
      options: [
        { label: "参加", value: "attending" },
        { label: "不参加", value: "not_attending" },
        { label: "待定", value: "pending" },
      ],
    },
    {
      name: "confirmedGuestCount",
      label: "确认人数",
      type: "number",
      required: true,
      defaultValue: 1,
      min: 1,
      max: 10,
    },
    {
      name: "phone",
      label: "联系电话",
      type: "text",
    },
    {
      name: "message",
      label: "祝福语",
      type: "textarea",
    },
    {
      name: "respondedAt",
      label: "回复时间",
      type: "date",
      required: true,
    },
  ],
};
