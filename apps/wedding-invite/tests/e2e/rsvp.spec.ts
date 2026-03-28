import { expect, test } from "@playwright/test";

test.describe("RSVP flow", () => {
  test("create guest via API, fill RSVP form on invite page, and submit", async ({ page }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const guestName = `RSVP测试${suffix}`;
    const memorySnippet = `这是和${guestName}的独特回忆：一起旅行看日出。`;

    // Step 1: Create guest via test API
    const createResponse = await page.request.post("/api/test/create-guest", {
      data: {
        name: guestName,
        memorySnippet,
        relationshipNote: "E2E RSVP 测试",
      },
    });
    expect(createResponse.ok(), `create-guest failed: ${await createResponse.text()}`).toBeTruthy();

    const createBody = (await createResponse.json()) as {
      success?: boolean;
      inviteCode?: string | null;
      shareLink?: string | null;
    };
    expect(createBody.success).toBeTruthy();

    const shareLink =
      (typeof createBody.shareLink === "string" && createBody.shareLink.trim()) ||
      (typeof createBody.inviteCode === "string" && createBody.inviteCode.trim()
        ? `/invite/${encodeURIComponent(createBody.inviteCode)}`
        : "");
    expect(shareLink, "shareLink should be present").toBeTruthy();

    // Step 2: Navigate to invite page
    await page.goto(shareLink);
    await page.waitForLoadState("networkidle");

    // Step 3: Scroll to RSVP section
    const rsvpSection = page.locator("#rsvp");
    await rsvpSection.scrollIntoViewIfNeeded();

    // Step 4: Verify form is visible and name is pre-filled
    const nameInput = page.locator("#name");
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    const nameValue = await nameInput.inputValue();
    expect(nameValue).toContain(guestName.slice(0, 4));

    // Step 5: Select guest count (required field)
    const guestCountTrigger = rsvpSection.locator("button").filter({ hasText: "请选择参加人数" });
    await guestCountTrigger.click();
    await page.locator("[role=option]").filter({ hasText: "1 人" }).click();

    // Step 6: Fill phone (optional)
    const phoneInput = page.locator("#phone");
    await phoneInput.fill("13900001234");

    // Step 7: Fill message (optional)
    const messageInput = page.locator("#message");
    await messageInput.fill("祝新婚快乐，百年好合！");

    // Step 8: Submit the form
    const submitButton = rsvpSection.getByRole("button", { name: /提交回复/ });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 9: Verify success state — "感谢您的回复！" should appear
    await expect(page.getByText("感谢您的回复！")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("期待在婚礼上与您相见")).toBeVisible();
  });

  test("RSVP API returns error for invalid invite code", async ({ request }) => {
    const response = await request.post("/api/rsvp", {
      data: {
        inviteCode: "nonexistent-code-12345",
        name: "无效测试",
        guestCount: 1,
      },
    });

    expect(response.status()).toBe(404);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  test("RSVP API returns error when name is missing", async ({ request }) => {
    const response = await request.post("/api/rsvp", {
      data: {
        inviteCode: "some-code",
        name: "",
        guestCount: 1,
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  test("homepage RSVP form works without invite code", async ({ page }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const guestName = `主页访客${suffix}`;

    // Step 1: Visit homepage (no invite code)
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Step 2: Verify opening invitation text is shown
    await expect(page.getByText("谨定于 2026年5月5日")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("恭候您的光临")).toBeVisible();

    // Step 3: Scroll to RSVP section
    const rsvpSection = page.locator("#rsvp");
    await rsvpSection.scrollIntoViewIfNeeded();

    // Step 4: Fill name (not pre-filled on homepage)
    const nameInput = page.locator("#name");
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.fill(guestName);

    // Step 5: Select guest count
    const guestCountTrigger = rsvpSection.locator("button").filter({ hasText: "请选择参加人数" });
    await guestCountTrigger.click();
    await page.locator("[role=option]").filter({ hasText: "2 人" }).click();

    // Step 6: Fill phone
    await page.locator("#phone").fill("13600001111");

    // Step 7: Fill message
    await page.locator("#message").fill("祝百年好合！");

    // Step 8: Submit button should be enabled (no invite code required)
    const submitButton = rsvpSection.getByRole("button", { name: /提交回复/ });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 9: Verify success
    await expect(page.getByText("感谢您的回复！")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("期待在婚礼上与您相见")).toBeVisible();
  });

  test("RSVP API handles walk-in submission without invite code", async ({ request }) => {
    const suffix = Date.now().toString().slice(-6);
    const guestName = `API直接${suffix}`;

    const response = await request.post("/api/rsvp", {
      data: {
        name: guestName,
        guestCount: 2,
        phone: "13700002222",
        message: "恭喜恭喜！",
        status: "attending",
        inviteCode: "",
      },
    });

    expect(response.ok(), `Walk-in RSVP failed: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as {
      success: boolean;
      data?: { name: string; guest_count: number; status: string };
    };
    expect(body.success).toBe(true);
    expect(body.data!.name).toBe(guestName);
    expect(body.data!.guest_count).toBe(2);
    expect(body.data!.status).toBe("attending");
  });

  test("RSVP API handles full submission with all fields via API", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const guestName = `API全量${suffix}`;

    // Create guest first
    const createResponse = await page.request.post("/api/test/create-guest", {
      data: {
        name: guestName,
        memorySnippet: `${guestName}的回忆`,
        relationshipNote: "E2E API test",
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createBody = (await createResponse.json()) as {
      success?: boolean;
      inviteCode?: string | null;
    };
    const inviteCode = createBody.inviteCode;
    expect(inviteCode).toBeTruthy();

    // Submit RSVP with all fields
    const rsvpResponse = await page.request.post("/api/rsvp", {
      data: {
        inviteCode,
        name: guestName,
        status: "attending",
        guestCount: 1,
        phone: "13800138000",
        message: "祝你们新婚快乐！",
        arrivalPlan: "both",
        needsHotel: true,
        hotelNights: "both",
        transportPreference: "far_combo",
      },
    });

    expect(rsvpResponse.ok(), `RSVP failed: ${await rsvpResponse.text()}`).toBeTruthy();
    const rsvpBody = (await rsvpResponse.json()) as {
      success: boolean;
      data?: {
        name: string;
        status: string;
        guest_count: number;
        arrivalPlan: string;
        needsHotel: boolean;
        hotelNights: string;
        transportPreference: string;
      };
    };
    expect(rsvpBody.success).toBe(true);
    expect(rsvpBody.data).toBeTruthy();
    expect(rsvpBody.data!.status).toBe("attending");
    expect(rsvpBody.data!.arrivalPlan).toBe("both");
    expect(rsvpBody.data!.needsHotel).toBe(true);
    expect(rsvpBody.data!.hotelNights).toBe("both");
    expect(rsvpBody.data!.transportPreference).toBe("far_combo");
  });

  test("RSVP API handles not_attending status", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const guestName = `不参加${suffix}`;

    const createResponse = await page.request.post("/api/test/create-guest", {
      data: {
        name: guestName,
        memorySnippet: `${guestName}的回忆`,
      },
    });
    const createBody = (await createResponse.json()) as {
      success?: boolean;
      inviteCode?: string | null;
    };
    expect(createBody.inviteCode).toBeTruthy();

    const rsvpResponse = await page.request.post("/api/rsvp", {
      data: {
        inviteCode: createBody.inviteCode,
        name: guestName,
        status: "not_attending",
        guestCount: 1,
      },
    });

    expect(rsvpResponse.ok()).toBeTruthy();
    const rsvpBody = (await rsvpResponse.json()) as {
      success: boolean;
      data?: { status: string };
    };
    expect(rsvpBody.success).toBe(true);
    expect(rsvpBody.data!.status).toBe("not_attending");
  });
});
