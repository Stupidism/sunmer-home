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
      name: "arrivalPlan",
      label: "行程安排",
      type: "select",
      defaultValue: "same_day",
      options: [
        { label: "婚礼当天到达", value: "same_day" },
        { label: "会提前到达", value: "arrive_early" },
        { label: "会晚点离开", value: "leave_late" },
        { label: "提前到达且晚点离开", value: "both" },
      ],
    },
    {
      name: "needsHotel",
      label: "是否需要酒店住宿",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "hotelNights",
      label: "住宿晚数偏好",
      type: "select",
      defaultValue: "none",
      options: [
        { label: "不需要住宿", value: "none" },
        { label: "前一晚", value: "before" },
        { label: "后一晚", value: "after" },
        { label: "前后两晚", value: "both" },
      ],
    },
    {
      name: "transportPreference",
      label: "推荐出行方式偏好",
      type: "select",
      defaultValue: "near_rideshare_hsr",
      options: [
        { label: "近距离：顺风车 / 高铁", value: "near_rideshare_hsr" },
        {
          label: "远距离：高铁+顺风车 或 飞机到上海后转车",
          value: "far_combo",
        },
      ],
    },
    {
      name: "respondedAt",
      label: "回复时间",
      type: "date",
      required: true,
    },
  ],
};
