import { test, expect, login, TEST_BABY_ID } from './fixtures'

const MOCK_PARSE_RESPONSE = {
  items: [
    {
      action: 'create',
      type: 'BOTTLE',
      startTime: '2026-03-27T10:00:00+08:00',
      endTime: '2026-03-27T10:15:00+08:00',
      milkAmount: 80,
      milkSource: 'BREAST_MILK',
      duration: 15,
      hasPoop: null,
      hasPee: null,
      poopColor: null,
      peeAmount: null,
      spitUpType: null,
      supplementType: null,
      count: null,
      notes: null,
      skipReason: null,
      originalTexts: ['瓶喂母乳80毫升'],
    },
    {
      action: 'create',
      type: 'DIAPER',
      startTime: '2026-03-27T10:30:00+08:00',
      endTime: '2026-03-27T10:30:00+08:00',
      milkAmount: null,
      milkSource: null,
      duration: null,
      hasPoop: true,
      hasPee: false,
      poopColor: 'YELLOW',
      peeAmount: null,
      spitUpType: null,
      supplementType: null,
      count: null,
      notes: null,
      skipReason: null,
      originalTexts: ['换尿布有大便黄色'],
    },
    {
      action: 'skip',
      type: 'SLEEP',
      startTime: '2026-03-27T10:30:00+08:00',
      endTime: null,
      milkAmount: null,
      milkSource: null,
      duration: null,
      hasPoop: null,
      hasPee: null,
      poopColor: null,
      peeAmount: null,
      spitUpType: null,
      supplementType: null,
      count: null,
      notes: null,
      skipReason: '无法识别活动类型',
      originalTexts: ['这是一段无法解析的乱码'],
    },
  ],
}

const MOCK_CONFIRM_RESPONSE = {
  created: [
    { id: 'new-1', type: 'BOTTLE', originalTexts: ['瓶喂母乳80毫升'] },
    { id: 'new-2', type: 'DIAPER', originalTexts: ['换尿布有大便黄色'] },
  ],
  updated: [],
  skipped: [],
  errors: [],
}

test.describe('Batch Import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to batch import page from drawer', async ({ page }) => {
    await page.getByTestId('drawer-trigger').click()
    const batchLink = page.getByTestId('drawer-link-batch-import')
    await expect(batchLink).toBeVisible()
    await batchLink.evaluate((el) => {
      ;(el as HTMLAnchorElement).click()
    })
    await expect(page).toHaveURL(new RegExp(`/b/${TEST_BABY_ID}/batch-import`))
  })

  test('should show input step with textarea and disabled parse button', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    const textarea = page.getByTestId('batch-input-textarea')
    await expect(textarea).toBeVisible()

    const parseBtn = page.getByTestId('batch-parse-btn')
    await expect(parseBtn).toBeVisible()
    await expect(parseBtn).toBeDisabled()
  })

  test('should enable parse button when text is entered', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    await page.getByTestId('batch-input-textarea').fill('瓶喂母乳80毫升')
    await expect(page.getByTestId('batch-parse-btn')).toBeEnabled()
  })

  test('full flow: input -> parse -> review -> confirm', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    // Mock batch-parse POST and PUT
    await page.route('**/api/app/batch-parse**', async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PARSE_RESPONSE),
        })
      } else if (method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_CONFIRM_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })

    // Step 1: Input text
    const textarea = page.getByTestId('batch-input-textarea')
    await textarea.fill('瓶喂母乳80毫升\n换尿布有大便黄色\n这是一段无法解析的乱码')

    await page.screenshot({ path: 'test-results/batch-import-step1-input.png', fullPage: true })

    // Click parse
    await page.getByTestId('batch-parse-btn').click()

    // Step 2: Wait for review step
    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })

    // Verify parsed results
    await expect(page.getByTestId('batch-result-item-0')).toContainText('瓶喂母乳80毫升')
    await expect(page.getByTestId('batch-result-item-1')).toContainText('换尿布有大便黄色')
    // Third item should show skip reason
    await expect(page.getByTestId('batch-result-item-2')).toContainText('无法识别活动类型')

    // Verify checkbox state: first two checked, third is skip (no checkbox)
    await expect(page.getByTestId('batch-check-0')).toBeVisible()
    await expect(page.getByTestId('batch-check-1')).toBeVisible()

    // Confirm button shows checked count
    const confirmBtn = page.getByTestId('batch-confirm-btn')
    await expect(confirmBtn).toContainText('确认导入 (2)')

    await page.screenshot({ path: 'test-results/batch-import-step2-review.png', fullPage: true })

    // Uncheck first item
    await page.getByTestId('batch-check-0').click()
    await expect(confirmBtn).toContainText('确认导入 (1)')

    await page.screenshot({ path: 'test-results/batch-import-step2-uncheck.png', fullPage: true })

    // Re-check
    await page.getByTestId('batch-check-0').click()
    await expect(confirmBtn).toContainText('确认导入 (2)')

    // Click confirm
    await confirmBtn.click()

    // Step 3: Wait for done
    await expect(page.getByTestId('batch-done-card')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('batch-done-card')).toContainText('新建 2 条')

    await page.screenshot({ path: 'test-results/batch-import-step3-done.png', fullPage: true })

    // Click continue, back to input
    await page.getByTestId('batch-reset-btn').click()
    await expect(page.getByTestId('batch-input-textarea')).toBeVisible()
  })

  test('toggle all button should select/deselect all non-skip items', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    await page.route('**/api/app/batch-parse**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PARSE_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByTestId('batch-input-textarea').fill('瓶喂母乳80毫升\n换尿布\n乱码')
    await page.getByTestId('batch-parse-btn').click()
    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })

    // Click deselect all
    await page.getByTestId('batch-toggle-all').click()
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (0)')

    // Click select all
    await page.getByTestId('batch-toggle-all').click()
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (2)')
  })

  test('should parse timestamp+description format from chat logs', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    await page.route('**/api/app/batch-parse**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        const entries = body.entries as Array<{ text: string; localTime: string }>
        if (entries && entries.length === 2) {
          if (entries[0].localTime.includes('08:30') && entries[1].localTime.includes('09:00')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                items: [
                  {
                    action: 'create',
                    type: 'BOTTLE',
                    startTime: '2026-03-27T08:30:00+08:00',
                    endTime: '2026-03-27T08:45:00+08:00',
                    milkAmount: 80,
                    milkSource: 'BREAST_MILK',
                    duration: 15,
                    hasPoop: null, hasPee: null, poopColor: null, peeAmount: null,
                    spitUpType: null, supplementType: null, count: null, notes: null,
                    skipReason: null,
                    originalTexts: ['宝宝喝了80毫升奶'],
                  },
                  {
                    action: 'create',
                    type: 'SLEEP',
                    startTime: '2026-03-27T09:00:00+08:00',
                    endTime: null,
                    milkAmount: null, milkSource: null,
                    duration: null,
                    hasPoop: null, hasPee: null, poopColor: null, peeAmount: null,
                    spitUpType: null, supplementType: null, count: null, notes: null,
                    skipReason: null,
                    originalTexts: ['宝宝睡觉了'],
                  },
                ],
              }),
            })
            return
          }
        }
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Unexpected request format' }),
        })
      } else {
        await route.continue()
      }
    })

    const chatLog = [
      '【宝宝每日数据记录】',
      '2026/3/27 08:30',
      '宝宝喝了80毫升奶',
      '2026/3/27 09:00',
      '宝宝睡觉了',
    ].join('\n')

    await page.getByTestId('batch-input-textarea').fill(chatLog)

    await page.screenshot({ path: 'test-results/batch-import-timestamp-input.png', fullPage: true })

    await page.getByTestId('batch-parse-btn').click()

    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('batch-result-item-0')).toContainText('宝宝喝了80毫升奶')
    await expect(page.getByTestId('batch-result-item-1')).toContainText('宝宝睡觉了')
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (2)')

    await page.screenshot({ path: 'test-results/batch-import-timestamp-review.png', fullPage: true })
  })

  test('back button should return to input step', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    await page.route('**/api/app/batch-parse**', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PARSE_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByTestId('batch-input-textarea').fill('瓶喂母乳80毫升')
    await page.getByTestId('batch-parse-btn').click()
    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })

    // Click back
    await page.getByTestId('batch-back-btn').click()
    await expect(page.getByTestId('batch-input-textarea')).toBeVisible()
    await expect(page.getByTestId('batch-input-textarea')).toHaveValue('瓶喂母乳80毫升')
  })
})
