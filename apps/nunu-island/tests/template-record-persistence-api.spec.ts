import { expect, test } from '@playwright/test'

const TEMPLATE_ID = 'gratitude-journal'

test('template record API persists answers to database', async ({ page }) => {
  const marker = `e2e-preview-${Date.now()}`
  const payload = {
    templateId: TEMPLATE_ID,
    templateTitle: marker,
    answers: [
      {
        questionId: 'preview-api-check',
        value: marker,
      },
    ],
  }

  const createResponse = await page.request.post('/api/content/template-records', {
    data: payload,
    timeout: 60000,
  })
  expect(createResponse.ok()).toBeTruthy()

  const listResponse = await page.request.get(`/api/content/template-records?templateId=${TEMPLATE_ID}`, {
    timeout: 60000,
  })
  expect(listResponse.ok()).toBeTruthy()

  const listPayload = (await listResponse.json()) as {
    records?: Array<{
      templateTitle?: string
      answers?: Array<{ questionId?: string; value?: string | string[] | number }>
    }>
  }

  const records = Array.isArray(listPayload.records) ? listPayload.records : []
  const matched = records.find((record) => {
    if (record.templateTitle !== marker || !Array.isArray(record.answers)) {
      return false
    }

    return record.answers.some(
      (answer) => answer?.questionId === 'preview-api-check' && answer?.value === marker
    )
  })

  expect(Boolean(matched)).toBeTruthy()
})
