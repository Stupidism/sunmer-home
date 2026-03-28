import { test, expect, login, TEST_BABY_ID } from './fixtures'

const MOCK_PARSE_RESPONSE = {
  results: [
    {
      originalText: '瓶喂母乳80毫升',
      parsed: {
        type: 'BOTTLE',
        startTimeISO: '2026-03-27T10:00:00.000Z',
        endTimeISO: '2026-03-27T10:15:00.000Z',
        milkAmount: 80,
        milkSource: 'BREAST_MILK',
        hasPoop: null,
        hasPee: null,
        poopColor: null,
        peeAmount: null,
        spitUpType: null,
        count: null,
        notes: null,
        confidence: 0.95,
      },
    },
    {
      originalText: '换尿布有大便黄色',
      parsed: {
        type: 'DIAPER',
        startTimeISO: '2026-03-27T10:30:00.000Z',
        endTimeISO: '2026-03-27T10:30:00.000Z',
        milkAmount: null,
        milkSource: null,
        hasPoop: true,
        hasPee: false,
        poopColor: 'YELLOW',
        peeAmount: null,
        spitUpType: null,
        count: null,
        notes: null,
        confidence: 0.9,
      },
    },
    {
      originalText: '这是一段无法解析的乱码',
      error: '无法识别活动类型',
    },
  ],
}

const MOCK_CREATE_RESPONSE = {
  created: [
    { id: 'new-1', type: 'BOTTLE', originalText: '瓶喂母乳80毫升' },
    { id: 'new-2', type: 'DIAPER', originalText: '换尿布有大便黄色' },
  ],
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

    // Mock batch-parse POST (解析)
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
          body: JSON.stringify(MOCK_CREATE_RESPONSE),
        })
      } else {
        await route.continue()
      }
    })

    // Step 1: 输入文本
    const textarea = page.getByTestId('batch-input-textarea')
    await textarea.fill('瓶喂母乳80毫升\n换尿布有大便黄色\n这是一段无法解析的乱码')

    // 截图：输入步骤
    await page.screenshot({ path: 'test-results/batch-import-step1-input.png', fullPage: true })

    // 点击解析
    await page.getByTestId('batch-parse-btn').click()

    // Step 2: 等待进入 review 步骤
    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })

    // 验证解析结果显示
    await expect(page.getByTestId('batch-result-item-0')).toContainText('瓶喂母乳80毫升')
    await expect(page.getByTestId('batch-result-item-1')).toContainText('换尿布有大便黄色')
    // 第三条应该显示错误
    await expect(page.getByTestId('batch-result-item-2')).toContainText('无法识别活动类型')

    // 验证 checkbox 状态：前两条默认选中，第三条失败无 checkbox
    await expect(page.getByTestId('batch-check-0')).toBeVisible()
    await expect(page.getByTestId('batch-check-1')).toBeVisible()

    // 确认按钮显示选中数量
    const confirmBtn = page.getByTestId('batch-confirm-btn')
    await expect(confirmBtn).toContainText('确认导入 (2)')

    // 截图：审核步骤
    await page.screenshot({ path: 'test-results/batch-import-step2-review.png', fullPage: true })

    // 取消勾选第一条
    await page.getByTestId('batch-check-0').click()
    await expect(confirmBtn).toContainText('确认导入 (1)')

    // 截图：取消勾选后
    await page.screenshot({ path: 'test-results/batch-import-step2-uncheck.png', fullPage: true })

    // 重新勾选
    await page.getByTestId('batch-check-0').click()
    await expect(confirmBtn).toContainText('确认导入 (2)')

    // 点击确认导入
    await confirmBtn.click()

    // Step 3: 等待完成步骤
    await expect(page.getByTestId('batch-done-card')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('batch-done-card')).toContainText('成功导入 2 条记录')

    // 截图：完成步骤
    await page.screenshot({ path: 'test-results/batch-import-step3-done.png', fullPage: true })

    // 点击继续导入，回到输入步骤
    await page.getByTestId('batch-reset-btn').click()
    await expect(page.getByTestId('batch-input-textarea')).toBeVisible()
  })

  test('toggle all button should select/deselect all parsed items', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    // Mock
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

    // 点击取消全选
    await page.getByTestId('batch-toggle-all').click()
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (0)')

    // 点击全选
    await page.getByTestId('batch-toggle-all').click()
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (2)')
  })

  test('should parse timestamp+description format from chat logs', async ({ page }) => {
    await page.goto(`/b/${TEST_BABY_ID}/batch-import`)

    // Mock - verify entries have per-record localTime
    await page.route('**/api/app/batch-parse**', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        // Verify entries format with individual timestamps
        const entries = body.entries as Array<{ text: string; localTime: string }>
        if (entries && entries.length === 2) {
          // Check first entry has timestamp from paste
          if (entries[0].localTime.includes('08:30') && entries[1].localTime.includes('09:00')) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                results: [
                  {
                    originalText: '宝宝喝了80毫升奶',
                    parsed: {
                      type: 'BOTTLE',
                      startTimeISO: '2026-03-27T00:30:00.000Z',
                      endTimeISO: '2026-03-27T00:45:00.000Z',
                      milkAmount: 80,
                      milkSource: 'BREAST_MILK',
                      hasPoop: null, hasPee: null, poopColor: null, peeAmount: null,
                      spitUpType: null, count: null, notes: null,
                      confidence: 0.95,
                    },
                  },
                  {
                    originalText: '宝宝睡觉了',
                    parsed: {
                      type: 'SLEEP',
                      startTimeISO: '2026-03-27T01:00:00.000Z',
                      endTimeISO: null,
                      milkAmount: null, milkSource: null,
                      hasPoop: null, hasPee: null, poopColor: null, peeAmount: null,
                      spitUpType: null, count: null, notes: null,
                      confidence: 0.9,
                    },
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

    // 粘贴带时间戳的聊天记录格式
    const chatLog = [
      '【宝宝每日数据记录】',
      '2026/3/27 08:30',
      '宝宝喝了80毫升奶',
      '2026/3/27 09:00',
      '宝宝睡觉了',
    ].join('\n')

    await page.getByTestId('batch-input-textarea').fill(chatLog)

    // 截图：带时间戳格式的输入
    await page.screenshot({ path: 'test-results/batch-import-timestamp-input.png', fullPage: true })

    await page.getByTestId('batch-parse-btn').click()

    // 验证解析结果
    await expect(page.getByTestId('batch-result-item-0')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('batch-result-item-0')).toContainText('宝宝喝了80毫升奶')
    await expect(page.getByTestId('batch-result-item-1')).toContainText('宝宝睡觉了')
    await expect(page.getByTestId('batch-confirm-btn')).toContainText('确认导入 (2)')

    // 截图：时间戳格式的审核界面
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

    // 点击返回修改
    await page.getByTestId('batch-back-btn').click()
    await expect(page.getByTestId('batch-input-textarea')).toBeVisible()
    // 原来的文本应该还在
    await expect(page.getByTestId('batch-input-textarea')).toHaveValue('瓶喂母乳80毫升')
  })
})
