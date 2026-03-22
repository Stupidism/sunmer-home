import { expect, test, type Page } from '@playwright/test'

const TEMPLATE_ID = 'gratitude-journal'

test.setTimeout(300000)

async function answerCurrentQuestion(page: Page): Promise<boolean> {
  const questionArticle = page.locator('article:has(h2):visible').last()

  if ((await questionArticle.count()) === 0) {
    return false
  }

  const choiceOptions = questionArticle.locator('.space-y-2 > button[type="button"]:visible')
  if ((await choiceOptions.count()) > 0) {
    const nonCustomOptions = choiceOptions.filter({ hasNotText: '自定义' })
    if ((await nonCustomOptions.count()) > 0) {
      await nonCustomOptions.first().click({ force: true })
    } else {
      await choiceOptions.first().click({ force: true })
    }
    return true
  }

  const slider = questionArticle.locator('[role="slider"]:visible')
  if ((await slider.count()) > 0) {
    await slider.first().focus()
    await page.keyboard.press('ArrowRight')
    return true
  }

  const textarea = questionArticle.locator('textarea:visible')
  if ((await textarea.count()) > 0) {
    try {
      const field = textarea.first()
      await field.click({ force: true })
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.type(`e2e-answer-${Date.now()}`)
      return true
    } catch {
      return false
    }
  }

  const textInput = questionArticle.locator('input:visible')
  if ((await textInput.count()) > 0) {
    try {
      const field = textInput.first()
      await field.click({ force: true })
      await page.keyboard.press('ControlOrMeta+A')
      await page.keyboard.type(`e2e-answer-${Date.now()}`)
      return true
    } catch {
      return false
    }
  }

  return false
}

test('template questionnaire persists answers to database', async ({ page }) => {
  await page.goto(`/modules/template-selector/${TEMPLATE_ID}`)

  const maxSteps = 240
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.getByText('记录完成').isVisible()) {
      break
    }

    const startButton = page.getByRole('button', { name: '开始' })
    if (await startButton.isVisible()) {
      await startButton.click()
      continue
    }

    await answerCurrentQuestion(page)

    const nextButton = page.locator('section > div.mt-6 button').last()
    await expect(nextButton).toBeVisible()
    if (await nextButton.isDisabled()) {
      await page.waitForTimeout(300)
      continue
    }
    await nextButton.click({ force: true })
  }

  await expect(page.getByText('记录完成')).toBeVisible({ timeout: 120000 })
  await expect(page.getByText('你的回答已保存到数据库记录。')).toBeVisible({ timeout: 120000 })
  await expect(page.locator('text=保存失败')).toHaveCount(0)

  const afterResponse = await page.request.get(`/api/content/template-records?templateId=${TEMPLATE_ID}`, {
    timeout: 60000,
  })
  expect(afterResponse.ok()).toBeTruthy()

  const afterPayload = (await afterResponse.json()) as {
    records?: Array<{ id: string; templateId: string; answers: unknown[] }>
  }
  const records = Array.isArray(afterPayload.records) ? afterPayload.records : []

  expect(records.length).toBeGreaterThan(0)
  expect(records[0]?.templateId).toBe(TEMPLATE_ID)
  expect(Array.isArray(records[0]?.answers)).toBeTruthy()
  expect(records[0]?.answers.length).toBeGreaterThan(0)
})
