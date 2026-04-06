import { test, expect, login, TEST_BABY_ID } from './fixtures'

test.describe('Supplement - Probiotics & Prebiotics (SUN-11)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should show all 4 supplement types in the form', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}?modal=supplement`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    await expect(page.getByTestId('supplement-type-AD')).toBeVisible()
    await expect(page.getByTestId('supplement-type-D3')).toBeVisible()
    await expect(page.getByTestId('supplement-type-PROBIOTICS')).toBeVisible()
    await expect(page.getByTestId('supplement-type-PREBIOTICS')).toBeVisible()
  })

  test('should create a PROBIOTICS supplement activity', async ({ page }) => {
    // Use a random past time to avoid conflicts with previous test runs
    const uniqueTime = new Date(Date.now() - Math.floor(Math.random() * 3600_000)).toISOString()
    await page.goto(
      `/b/${TEST_BABY_ID}?modal=supplement&supplementType=PROBIOTICS&startTime=${encodeURIComponent(uniqueTime)}`
    )

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('supplement-type-PROBIOTICS')).toHaveClass(/bg-green-500/)

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/app/activities') && r.request().method() === 'POST',
      { timeout: 15000 }
    )

    await page.getByTestId('supplement-submit').click()

    const response = await responsePromise
    // Accept 200/201 (created) or 409 (conflict with existing) — both prove the enum value works
    expect([200, 201, 409]).toContain(response.status())

    const body = await response.json()
    if (response.status() < 400) {
      expect(body.supplementType).toBe('PROBIOTICS')
    } else {
      expect(body.conflictingActivity?.supplementType).toBe('PROBIOTICS')
    }
  })

  test('should create a PREBIOTICS supplement activity', async ({ page }) => {
    const uniqueTime = new Date(Date.now() - Math.floor(Math.random() * 3600_000)).toISOString()
    await page.goto(
      `/b/${TEST_BABY_ID}?modal=supplement&supplementType=PREBIOTICS&startTime=${encodeURIComponent(uniqueTime)}`
    )

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('supplement-type-PREBIOTICS')).toHaveClass(/bg-teal-500/)

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/app/activities') && r.request().method() === 'POST',
      { timeout: 15000 }
    )

    await page.getByTestId('supplement-submit').click()

    const response = await responsePromise
    expect([200, 201, 409]).toContain(response.status())

    const body = await response.json()
    if (response.status() < 400) {
      expect(body.supplementType).toBe('PREBIOTICS')
    } else {
      expect(body.conflictingActivity?.supplementType).toBe('PREBIOTICS')
    }
  })

  test('should select PROBIOTICS type and show correct styling', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}?modal=supplement`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Default is AD
    await expect(page.getByTestId('supplement-type-AD')).toHaveClass(/bg-orange-500/)

    // Click PROBIOTICS
    await page.getByTestId('supplement-type-PROBIOTICS').click()
    await expect(page.getByTestId('supplement-type-PROBIOTICS')).toHaveClass(/bg-green-500/)
    // AD should no longer be selected
    await expect(page.getByTestId('supplement-type-AD')).not.toHaveClass(/bg-orange-500/)
  })

  test('should select PREBIOTICS type and show correct styling', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}?modal=supplement`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // Click PREBIOTICS
    await page.getByTestId('supplement-type-PREBIOTICS').click()
    await expect(page.getByTestId('supplement-type-PREBIOTICS')).toHaveClass(/bg-teal-500/)
    // AD should no longer be selected
    await expect(page.getByTestId('supplement-type-AD')).not.toHaveClass(/bg-orange-500/)
  })
})
