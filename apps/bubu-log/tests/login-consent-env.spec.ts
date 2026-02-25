import { test, expect } from './fixtures'

test.describe('Login consent gate by environment', () => {
  test('allows submitting login form without consent checkboxes in non-production env', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByTestId('login-submit-btn')).toBeEnabled()
  })
})
