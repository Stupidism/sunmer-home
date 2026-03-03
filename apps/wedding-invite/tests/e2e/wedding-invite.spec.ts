import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL || "wedding-e2e-admin@example.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD || "Passw0rd!123456";

async function loginPayloadAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: /log ?in/i }).click();
  await expect(page).toHaveURL(/\/admin(\/)?$/);
}

test("guest creation to personalized invite and RSVP flow", async ({ page }) => {
  test.setTimeout(120_000);

  const suffix = Date.now().toString().slice(-6);
  const guestName = `E2E宾客${suffix}`;
  const memorySnippet = `这是和${guestName}的独特回忆：一起在校园雨夜聊到天亮。`;

  await loginPayloadAdmin(page);

  const createGuestResponse = await page.request.post("/api/test/create-guest", {
    data: {
      name: guestName,
      memorySnippet,
      relationshipNote: "E2E 自动化：新郎同学",
    },
  });
  const createGuestBody = (await createGuestResponse.json()) as {
    success?: boolean;
    guestId?: string;
    guestName?: string;
    noDatabaseFallback?: boolean;
    shareLink?: string | null;
    inviteCode?: string | null;
    error?: string;
  };
  expect(createGuestResponse.ok(), createGuestBody.error || "create guest failed").toBeTruthy();

  const usingNoDatabaseFallback = Boolean(createGuestBody.noDatabaseFallback);
  const guestId = createGuestBody.guestId;
  if (!usingNoDatabaseFallback) {
    expect(guestId).toBeTruthy();
    if (!guestId) {
      throw new Error("Missing guest id from API response");
    }

    const expectedGuestName =
      (typeof createGuestBody.guestName === "string" && createGuestBody.guestName) || guestName;
    await page.goto("/admin/collections/guests");
    await expect(page.getByText(expectedGuestName)).toBeVisible();
  }

  const shareLink =
    (typeof createGuestBody.shareLink === "string" && createGuestBody.shareLink.trim()) ||
    (typeof createGuestBody.inviteCode === "string" && createGuestBody.inviteCode.trim()
      ? `/invite/${encodeURIComponent(createGuestBody.inviteCode)}`
      : "");
  expect(shareLink).toBeTruthy();

  expect(shareLink).toMatch(/\/(invite\/|\?code=)/);

  await page.goto(shareLink);

  await expect(page.getByRole("heading", { name: "我们的回忆" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新郎新娘" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "宝宝" })).toBeVisible();
  await expect(page.getByText("麋鹿保护区 · 丹顶鹤保护区")).toBeVisible();
  await expect(page.getByText("黄海森林公园")).toBeVisible();
  await expect(page.getByText("婚礼地点：港汇国际大酒店")).toBeVisible();
  await expect(page.locator("#details").getByText("近距离：顺风车 / 高铁")).toBeVisible();
  await expect(page.locator("#details").getByText(/远距离：高铁\+顺风车/)).toBeVisible();

  const inviteCodeFromLink = (() => {
    try {
      const parsed = new URL(shareLink, page.url());
      const pathMatch = parsed.pathname.match(/\/invite\/([^/]+)$/);
      if (pathMatch?.[1]) {
        return decodeURIComponent(pathMatch[1]);
      }

      return parsed.searchParams.get("code") || "";
    } catch {
      return "";
    }
  })();
  const inviteCode =
    (typeof createGuestBody.inviteCode === "string" && createGuestBody.inviteCode) || inviteCodeFromLink;

  expect(inviteCode).toBeTruthy();

  const rsvpResponse = await page.request.post("/api/rsvp", {
    data: {
      inviteCode,
      name: guestName,
      status: "attending",
      guestCount: 1,
      phone: "13800138000",
      message: "祝你们新婚快乐，宝宝健康成长！",
      arrivalPlan: "both",
      needsHotel: true,
      hotelNights: "both",
      transportPreference: "far_combo",
    },
  });

  expect(rsvpResponse.ok()).toBeTruthy();
  const rsvpBody = (await rsvpResponse.json()) as { success?: boolean };
  expect(rsvpBody.success).toBeTruthy();
});
