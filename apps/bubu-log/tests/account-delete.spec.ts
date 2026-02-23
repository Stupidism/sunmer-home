import { test, expect, TEST_DELETE_USER, extractCurrentBabyId } from './fixtures'

test.describe('Account Deletion', () => {
  test('should delete account data and prevent future login', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-consent-trial').check()
    await page.getByTestId('login-consent-guardian').check()
    await page.getByTestId('login-consent-overseas').check()
    await page.getByTestId('login-username-input').fill(TEST_DELETE_USER.username)
    await page.getByTestId('login-password-input').fill(TEST_DELETE_USER.password)
    await page.getByTestId('login-submit-btn').click()

    await expect(page).toHaveURL(/\/b\/[^/?#]+(?:\?.*)?$/, { timeout: 10000 })
    const currentUrl = page.url()
    const babyId = extractCurrentBabyId(currentUrl)
    expect(babyId).not.toBeNull()

    await page.goto(`/b/${babyId}/settings`)
    await expect(page.getByRole('heading', { name: '删除账号与数据' })).toBeVisible()

    await page.getByRole('button', { name: '删除账号与数据' }).click()
    await expect(page.getByTestId('bottom-sheet')).toBeVisible()

    await page.getByRole('button', { name: '确认删除' }).click()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/, { timeout: 15000 })

    await page.getByTestId('login-consent-trial').check()
    await page.getByTestId('login-consent-guardian').check()
    await page.getByTestId('login-consent-overseas').check()
    await page.getByTestId('login-username-input').fill(TEST_DELETE_USER.username)
    await page.getByTestId('login-password-input').fill(TEST_DELETE_USER.password)
    await page.getByTestId('login-submit-btn').click()

    await expect(page.getByText('用户名或密码错误')).toBeVisible({ timeout: 5000 })
  })
})
