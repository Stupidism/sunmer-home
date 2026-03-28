import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  /* 忽略 fixtures 目录 */
  testIgnore: ['**/fixtures/**'],
  /* 测试结果输出目录 */
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3210',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    /* 设置默认超时 */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  /* 全局超时 */
  timeout: 60000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec next dev --port 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
