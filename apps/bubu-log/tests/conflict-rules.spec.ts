import { test, expect, login } from './fixtures'

function getSeedBottleWindow() {
  const now = new Date()
  const start = new Date(now)
  start.setHours(now.getHours() - 2, 0, 0, 0)
  const end = new Date(start)
  end.setMinutes(start.getMinutes() + 17)
  return { start, end }
}

test.describe('Activity Conflict Rules', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('breastfeed overlaps with bottle and conflict modal confirm/cancel both work', async ({ page }) => {
    const { start, end } = getSeedBottleWindow()
    const params = new URLSearchParams({
      modal: 'breastfeed',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    })

    await page.goto(`/?${params.toString()}`)
    await page.getByRole('button', { name: '确认记录' }).click()

    const overlapModal = page.getByTestId('overlap-confirm-modal')
    await expect(overlapModal).toBeVisible()

    await page.getByTestId('overlap-cancel-btn').click()
    await expect(overlapModal).not.toBeVisible()

    await page.goto(`/?${params.toString()}`)
    await page.getByRole('button', { name: '确认记录' }).click()
    await expect(overlapModal).toBeVisible()

    await page.getByTestId('overlap-confirm-btn').click()
    await expect(page).not.toHaveURL(/modal=breastfeed/)
  })

  test('sleep conflicts with head lift but not with outdoor', async ({ page }) => {
    const sleepStart = new Date()
    sleepStart.setHours(sleepStart.getHours() - 6, 0, 0, 0)
    const sleepEnd = new Date(sleepStart)
    sleepEnd.setHours(sleepStart.getHours() + 1, 0, 0, 0)

    const createSleepResponse = await page.request.post('/api/app/activities', {
      data: {
        type: 'SLEEP',
        startTime: sleepStart.toISOString(),
        endTime: sleepEnd.toISOString(),
      },
    })
    expect(createSleepResponse.ok()).toBeTruthy()

    const overlapStart = new Date(sleepStart)
    overlapStart.setMinutes(overlapStart.getMinutes() + 10)
    const overlapEnd = new Date(overlapStart)
    overlapEnd.setMinutes(overlapStart.getMinutes() + 10)

    const headLiftParams = new URLSearchParams({
      modal: 'head_lift',
      startTime: overlapStart.toISOString(),
      endTime: overlapEnd.toISOString(),
    })

    await page.goto(`/?${headLiftParams.toString()}`)
    await page.getByRole('button', { name: '确认记录' }).click()
    const overlapModal = page.getByTestId('overlap-confirm-modal')
    await expect(overlapModal).toBeVisible()
    await page.getByTestId('overlap-cancel-btn').click()
    await expect(overlapModal).not.toBeVisible()

    const outdoorParams = new URLSearchParams({
      modal: 'outdoor',
      startTime: overlapStart.toISOString(),
      endTime: overlapEnd.toISOString(),
    })
    await page.goto(`/?${outdoorParams.toString()}`)
    await page.getByRole('button', { name: '确认记录' }).click()
    await expect(overlapModal).not.toBeVisible()
    await expect(page).not.toHaveURL(/modal=outdoor/)
  })
})
