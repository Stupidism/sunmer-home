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

test.describe("Content revalidation after admin update", () => {
  test("invite page reflects updated customOpening after admin change", async ({ page }) => {
    test.setTimeout(120_000);

    const suffix = Date.now().toString().slice(-6);
    const guestName = `Reval测试${suffix}`;
    const memorySnippet = `这是和${guestName}的测试回忆。`;

    // Step 1: Login to Payload admin (sets auth cookies for API calls)
    await loginPayloadAdmin(page);

    // Step 2: Create guest via test API (auto-creates invitation)
    const createResponse = await page.request.post("/api/test/create-guest", {
      data: {
        name: guestName,
        memorySnippet,
        relationshipNote: "E2E revalidation test",
      },
    });
    expect(createResponse.ok(), `create-guest failed: ${await createResponse.text()}`).toBeTruthy();

    const createBody = (await createResponse.json()) as {
      success?: boolean;
      guestId?: string;
      inviteCode?: string | null;
      shareLink?: string | null;
      noDatabaseFallback?: boolean;
    };
    expect(createBody.success).toBeTruthy();

    // Skip if no-database fallback (revalidation not applicable)
    if (createBody.noDatabaseFallback) {
      test.skip(true, "No database available, skipping revalidation test");
      return;
    }

    const inviteCode = createBody.inviteCode;
    expect(inviteCode, "inviteCode should be present").toBeTruthy();

    const shareLink =
      (typeof createBody.shareLink === "string" && createBody.shareLink.trim()) ||
      `/invite/${encodeURIComponent(inviteCode!)}`;

    // Step 3: Visit invite page and verify initial customOpening via API
    const initialApiResponse = await page.request.get(
      `/api/invitation?code=${encodeURIComponent(inviteCode!)}`,
    );
    expect(initialApiResponse.ok()).toBeTruthy();
    const initialApiBody = (await initialApiResponse.json()) as {
      success: boolean;
      data?: { customOpening?: string };
    };
    const initialOpening = initialApiBody.data?.customOpening;
    expect(initialOpening).toBeTruthy();

    // Visit the page and confirm the opening text is displayed
    await page.goto(shareLink);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(initialOpening!)).toBeVisible({ timeout: 15_000 });

    // Step 4: Update customOpening via Payload REST API (with admin cookies)
    const updatedOpening = `${guestName}，特别邀请你来见证我们的幸福时刻-${suffix}`;

    // Find the invitation by inviteCode via Payload REST API
    const findResponse = await page.request.get(
      `/api/invitations?where[inviteCode][equals]=${encodeURIComponent(inviteCode!)}&depth=0&limit=1`,
    );
    expect(findResponse.ok(), `Find invitation failed: ${await findResponse.text()}`).toBeTruthy();

    const findBody = (await findResponse.json()) as {
      docs?: Array<{ id: string; customOpening?: string }>;
    };
    const invitationId = findBody.docs?.[0]?.id;
    expect(invitationId, "invitation ID should be found").toBeTruthy();

    // Update the invitation's customOpening via Payload REST API
    const updateResponse = await page.request.patch(`/api/invitations/${invitationId}`, {
      data: {
        customOpening: updatedOpening,
      },
    });
    expect(
      updateResponse.ok(),
      `Update invitation failed: ${await updateResponse.text()}`,
    ).toBeTruthy();

    // Step 5: Wait for revalidation, then verify updated content via invitation API
    await page.waitForTimeout(2_000);

    const updatedApiResponse = await page.request.get(
      `/api/invitation?code=${encodeURIComponent(inviteCode!)}`,
    );
    expect(updatedApiResponse.ok()).toBeTruthy();
    const updatedApiBody = (await updatedApiResponse.json()) as {
      success: boolean;
      data?: { customOpening?: string };
    };
    expect(updatedApiBody.data?.customOpening).toBe(updatedOpening);

    // Step 6: Reload the invite page and verify the updated text is displayed
    await page.goto(shareLink);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(updatedOpening)).toBeVisible({ timeout: 15_000 });
  });
});
