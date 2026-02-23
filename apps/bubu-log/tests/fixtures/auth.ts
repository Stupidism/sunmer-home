import { test as base, Page, expect } from '@playwright/test'

// 测试账户信息（与 seed-test-data.ts 保持一致）
export const TEST_USER = {
  username: 'e2e-test-user',
  password: 'test123456',
  email: 'e2e-test@example.com',
}

export const TEST_DELETE_USER = {
  username: 'e2e-delete-user',
  password: 'delete123456',
  email: 'e2e-delete@example.com',
}

export const TEST_ACTIVITY_ID = 'e2e-test-activity-id'
export const TEST_ACTIVITY_ID_BABY2 = 'e2e-test-activity-id-baby2'
export const TEST_BABY_ID = 'e2e-test-baby-id'
export const TEST_BABY_ID_2 = 'e2e-test-baby-id-2'
export const TEST_DELETE_BABY_ID = 'e2e-delete-baby-id'

export function extractCurrentBabyId(url: string): string | null {
  const match = url.match(/\/b\/([^/?#]+)/)
  return match?.[1] ?? null
}

/**
 * 登录到应用
 * @param page Playwright Page 对象
 * @param username 用户名（默认使用测试账户）
 * @param password 密码（默认使用测试账户密码）
 */
export async function login(
  page: Page,
  username = TEST_USER.username,
  password = TEST_USER.password
) {
  // 导航到登录页
  await page.goto('/login')

  // 填写登录表单
  await page.getByTestId('login-consent-trial').check()
  await page.getByTestId('login-consent-guardian').check()
  await page.getByTestId('login-consent-overseas').check()
  await page.getByTestId('login-username-input').fill(username)
  await page.getByTestId('login-password-input').fill(password)

  // 点击登录按钮
  await page.getByTestId('login-submit-btn').click()

  // 等待登录完成并跳转到 baby-scope 首页
  await expect(page).toHaveURL(/\/b\/[^/?#]+(?:\?.*)?$/, { timeout: 10000 })
  
  // 确认已登录（检查页面上是否有抽屉菜单入口）
  await expect(page.getByTestId('drawer-trigger')).toBeVisible({ timeout: 5000 })
}

/**
 * 确保已登录状态
 * 如果未登录则执行登录
 */
export async function ensureLoggedIn(page: Page) {
  // 检查当前是否在登录页
  if (page.url().includes('/login')) {
    await login(page)
    return
  }

  // 尝试访问首页
  await page.goto('/')
  
  // 如果被重定向到登录页，则执行登录
  if (page.url().includes('/login')) {
    await login(page)
  }
}

/**
 * 扩展的测试 fixture，自动处理登录
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, fixtureRunner) => {
    await login(page)
    await fixtureRunner(page)
  },
})

export { expect } from '@playwright/test'
