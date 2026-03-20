import { test, expect, login, TEST_ACTIVITY_ID } from './fixtures'

test.describe('Activity Change Date', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('改日期按钮可见且可点击', async ({ page }) => {
    await page.goto(`/?modal=activity&id=${TEST_ACTIVITY_ID}`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    const changeDateButton = dialog.getByRole('button', { name: '改日期' })
    await expect(changeDateButton).toBeVisible()
    await expect(changeDateButton).toBeEnabled()
  })

  test('选择新日期后活动日期被更新且弹窗关闭', async ({ page }) => {
    await page.goto(`/?modal=activity&id=${TEST_ACTIVITY_ID}`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // 读取当前显示的日期文本
    const dateText = dialog.locator('p.text-xl').first()
    const originalDateText = await dateText.textContent()

    // 计算目标日期（昨天）
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const targetDateValue = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, '0'),
      String(yesterday.getDate()).padStart(2, '0'),
    ].join('-')

    // 拦截 PATCH 请求，验证请求体
    const patchPromise = page.waitForRequest((req) =>
      req.method() === 'PATCH' && req.url().includes(`/activities/${TEST_ACTIVITY_ID}`)
    )

    // 通过隐藏的 date input 设置日期并触发 change 事件
    const dateInput = dialog.locator('input[type="date"]')
    await dateInput.fill(targetDateValue)

    // 等待 PATCH 请求发出
    const patchRequest = await patchPromise
    const body = patchRequest.postDataJSON()

    // 验证请求体包含正确的 startTime（日期部分应为昨天）
    expect(body.startTime).toBeDefined()
    const sentDate = new Date(body.startTime)
    expect(sentDate.getFullYear()).toBe(yesterday.getFullYear())
    expect(sentDate.getMonth()).toBe(yesterday.getMonth())
    expect(sentDate.getDate()).toBe(yesterday.getDate())

    // 验证弹窗关闭（成功回调会关闭弹窗）
    await expect(dialog).not.toBeVisible({ timeout: 10000 })
  })

  test('改日期时 endTime 也应同步更新', async ({ page }) => {
    await page.goto(`/?modal=activity&id=${TEST_ACTIVITY_ID}`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // 目标日期（前天）
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - 2)
    const targetDateValue = [
      targetDate.getFullYear(),
      String(targetDate.getMonth() + 1).padStart(2, '0'),
      String(targetDate.getDate()).padStart(2, '0'),
    ].join('-')

    // 拦截 PATCH 请求
    const patchPromise = page.waitForRequest((req) =>
      req.method() === 'PATCH' && req.url().includes(`/activities/${TEST_ACTIVITY_ID}`)
    )

    const dateInput = dialog.locator('input[type="date"]')
    await dateInput.fill(targetDateValue)

    const patchRequest = await patchPromise
    const body = patchRequest.postDataJSON()

    // 测试活动有 endTime（seed 数据设置了 endTime），验证 endTime 也被更新
    expect(body.endTime).toBeDefined()
    const sentEndDate = new Date(body.endTime)
    expect(sentEndDate.getFullYear()).toBe(targetDate.getFullYear())
    expect(sentEndDate.getMonth()).toBe(targetDate.getMonth())
    // endTime 的日期应该和 startTime 相同（因为 BOTTLE 活动 start/end 在同一天）
    expect(sentEndDate.getDate()).toBe(targetDate.getDate())
  })

  test('改日期后重新打开弹窗应显示新日期', async ({ page }) => {
    await page.goto(`/?modal=activity&id=${TEST_ACTIVITY_ID}`)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })

    // 目标日期（3天前）
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - 3)
    const targetDateValue = [
      targetDate.getFullYear(),
      String(targetDate.getMonth() + 1).padStart(2, '0'),
      String(targetDate.getDate()).padStart(2, '0'),
    ].join('-')

    // 等待 PATCH 请求完成
    const responsePromise = page.waitForResponse((res) =>
      res.request().method() === 'PATCH' && res.url().includes(`/activities/${TEST_ACTIVITY_ID}`) && res.ok()
    )

    const dateInput = dialog.locator('input[type="date"]')
    await dateInput.fill(targetDateValue)

    await responsePromise
    // 弹窗关闭
    await expect(dialog).not.toBeVisible({ timeout: 10000 })

    // 重新打开弹窗
    await page.goto(`/?modal=activity&id=${TEST_ACTIVITY_ID}`)
    const reopenedDialog = page.getByRole('dialog')
    await expect(reopenedDialog).toBeVisible({ timeout: 10000 })

    // 验证显示的日期包含目标日期的月和日
    const dateDisplay = reopenedDialog.locator('p.text-xl').first()
    const displayText = await dateDisplay.textContent()
    // formatDateTimeChinese 格式类似 "3月17日 14:00"
    expect(displayText).toContain(`${targetDate.getMonth() + 1}月${targetDate.getDate()}日`)
  })
})
