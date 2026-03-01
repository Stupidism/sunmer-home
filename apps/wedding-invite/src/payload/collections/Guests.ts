import type { CollectionConfig } from "payload";
import { isCMSAdmin } from "../access/isCMSAdmin";

export const Guests: CollectionConfig = {
  slug: "guests",
  admin: {
    useAsTitle: "name",
    group: "婚礼业务",
    defaultColumns: [
      "name",
      "relationshipCategory",
      "relationshipSide",
      "isSingle",
      "hasChildren",
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
    afterChange: [
      async ({ doc, req }) => {
        const guestID = doc.id;
        const guestName = doc.name;

        void (async () => {
          for (let attempt = 0; attempt < 20; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 50 : 150));

            const existingInvitation = await req.payload.find({
              collection: "invitations",
              where: { guest: { equals: guestID } },
              limit: 1,
              overrideAccess: true,
            });

            if (existingInvitation.docs.length > 0) {
              return;
            }

            try {
              await req.payload.create({
                collection: "invitations",
                data: {
                  title: `${guestName} 的邀请函`,
                  guest: guestID,
                  maxGuestCount: 1,
                  status: "draft",
                  customOpening: `亲爱的${guestName}，欢迎来参加我们的婚礼。`,
                },
                overrideAccess: true,
              });
              return;
            } catch (error) {
              if (attempt === 19) {
                console.error("Failed to auto-create invitation", { guestID, error });
              }
            }
          }
        })();

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
        condition: (_, siblingData) => Boolean(siblingData?.hasChildren),
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
  ],
};
