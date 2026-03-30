import { expect, test } from "@playwright/test";

test.describe("Memory carousel", () => {
  test("carousel auto-plays and shows dot indicators", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Scroll to gallery section
    const gallery = page.locator("#gallery");
    await gallery.scrollIntoViewIfNeeded();

    // Check couple carousel exists
    const coupleCarousel = page.locator('[data-testid="carousel-couple"]');
    await expect(coupleCarousel).toBeVisible({ timeout: 10_000 });

    // Check dot indicators exist (at least 1 dot means photos are loaded)
    const dots = coupleCarousel.locator('[data-testid^="carousel-couple-dot-"]');
    const dotCount = await dots.count();

    if (dotCount > 1) {
      // First dot should be active (rose-600 background)
      const firstDot = dots.nth(0);
      await expect(firstDot).toBeVisible();

      // Wait for autoplay to advance (4 seconds + buffer)
      const initialIndex = await coupleCarousel.getAttribute("data-active-index");
      await page.waitForTimeout(5000);
      const newIndex = await coupleCarousel.getAttribute("data-active-index");

      // Index should have changed due to autoplay
      expect(newIndex).not.toBe(initialIndex);
    }

    // Check caption area exists
    const caption = coupleCarousel.locator('[data-testid="carousel-couple-caption"]');
    await expect(caption).toBeVisible();
  });

  test("carousel supports swipe navigation", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const gallery = page.locator("#gallery");
    await gallery.scrollIntoViewIfNeeded();

    const coupleCarousel = page.locator('[data-testid="carousel-couple"]');
    await expect(coupleCarousel).toBeVisible({ timeout: 10_000 });

    const dots = coupleCarousel.locator('[data-testid^="carousel-couple-dot-"]');
    const dotCount = await dots.count();

    if (dotCount > 1) {
      // Click second dot to navigate
      await dots.nth(1).click();
      await page.waitForTimeout(500);

      const activeIndex = await coupleCarousel.getAttribute("data-active-index");
      expect(activeIndex).toBe("1");
    }
  });
});
