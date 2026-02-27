import { expect, test, type Page } from '@playwright/test'

const TEMPLATE_ID = 'gratitude-journal'

async function answerCurrentQuestion(page: Page): Promise<boolean> {
  const questionArticle = page.locator('article:has(h2)').first()

  if ((await questionArticle.count()) === 0) {
    return false
  }

  const choiceOptions = questionArticle.locator('.space-y-2 > button[type="button"]')
  if ((await choiceOptions.count()) > 0) {
    await choiceOptions.first().click({ force: true })
    return true
  }

  const slider = questionArticle.locator('[role="slider"]')
  if ((await slider.count()) > 0) {
    await slider.first().focus()
    await page.keyboard.press('ArrowRight')
    return true
  }

  const textarea = questionArticle.locator('textarea')
  if ((await textarea.count()) > 0) {
    await textarea.first().fill(`e2e-answer-${Date.now()}`)
    return true
  }

  const textInput = questionArticle.locator('input')
  if ((await textInput.count()) > 0) {
    await textInput.first().fill(`e2e-answer-${Date.now()}`)
    return true
  }

  return false
}

test('template questionnaire persists answers to database', async ({ page }) => {
  const beforeResponse = await page.request.get(`/api/content/template-records?templateId=${TEMPLATE_ID}`)
  expect(beforeResponse.ok()).toBeTruthy()
  const beforePayload = (await beforeResponse.json()) as { records?: Array<{ id: string }> }
  const beforeCount = Array.isArray(beforePayload.records) ? beforePayload.records.length : 0

  await page.goto(`/modules/template-selector/${TEMPLATE_ID}`)

  const maxSteps = 80
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

  await expect(page.getByText('记录完成')).toBeVisible()
  await expect(page.getByText('你的回答已保存到数据库记录。')).toBeVisible()
  await expect(page.locator('text=保存失败')).toHaveCount(0)

  const afterResponse = await page.request.get(`/api/content/template-records?templateId=${TEMPLATE_ID}`)
  expect(afterResponse.ok()).toBeTruthy()

  const afterPayload = (await afterResponse.json()) as {
    records?: Array<{ id: string; templateId: string; answers: unknown[] }>
  }
  const records = Array.isArray(afterPayload.records) ? afterPayload.records : []

  expect(records.length).toBeGreaterThan(beforeCount)
  expect(records[0]?.templateId).toBe(TEMPLATE_ID)
  expect(Array.isArray(records[0]?.answers)).toBeTruthy()
  expect(records[0]?.answers.length).toBeGreaterThan(0)
})
