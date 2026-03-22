import { expect, test } from '@playwright/test'

const TEMPLATE_ID = 'gratitude-journal'

type RequestDebug = {
  ok: boolean
  status: number
  statusText: string
  body: string
}

async function readResponseDebug(response: Response): Promise<RequestDebug> {
  const status = response.status()
  const statusText = response.statusText()
  const ok = response.ok()
  const body = await response.text()

  return {
    ok,
    status,
    statusText,
    body,
  }
}

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

  let createDebug: RequestDebug | null = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const createResponse = await page.request.post('/api/content/template-records', {
      data: payload,
      timeout: 60000,
    })
    createDebug = await readResponseDebug(createResponse)

    if (createDebug.ok) {
      break
    }

    await page.waitForTimeout(1000 * attempt)
  }

  expect(
    createDebug?.ok,
    `POST /api/content/template-records failed after retries: status=${createDebug?.status} ${createDebug?.statusText}, body=${createDebug?.body ?? '<empty>'}`
  ).toBeTruthy()

  const listResponse = await page.request.get(`/api/content/template-records?templateId=${TEMPLATE_ID}`, {
    timeout: 60000,
  })
  const listDebug = await readResponseDebug(listResponse)
  expect(
    listDebug.ok,
    `GET /api/content/template-records failed: status=${listDebug.status} ${listDebug.statusText}, body=${listDebug.body || '<empty>'}`
  ).toBeTruthy()

  const listPayload = JSON.parse(listDebug.body) as {
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
