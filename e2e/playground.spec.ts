import { expect, test } from '@playwright/test'

// PIXI destroys and loses every context, but Playwright WebKit defers removing
// rapidly replaced contexts from its per-page budget. Keep 20 cycles while
// filtering only the resulting engine diagnostics; all other errors still fail.
const WEBKIT_CONTEXT_CHURN_MESSAGES = [
  'There are too many active WebGL contexts on this page',
  'INVALID_OPERATION: loseContext: context already lost',
]

test('loads Hiyori and survives repeated mount/unmount', async ({ browserName, page }) => {
  const unexpectedErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      unexpectedErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  await expect(page.locator('[data-live2d-stage] canvas')).toHaveCount(1)

  await page.getByLabel('Framing').selectOption('full')
  const mouthSlider = page.locator('input[type="range"]')
  await mouthSlider.fill('0.8')
  await expect(mouthSlider).toHaveValue('0.8')

  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: 'Unmount stage' }).click()
    await expect(page.locator('[data-live2d-stage] canvas')).toHaveCount(0)
    await page.getByRole('button', { name: 'Mount stage' }).click()
    await expect(page.getByTestId('stage-status')).toContainText('ready')
    await expect(page.locator('[data-live2d-stage] canvas')).toHaveCount(1)
  }

  const actionableErrors = unexpectedErrors.filter(message =>
    browserName !== 'webkit'
    || !WEBKIT_CONTEXT_CHURN_MESSAGES.some(fragment => message.includes(fragment)),
  )
  expect(actionableErrors).toEqual([])
})

test('obeys the mobile backing-buffer policy', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')

  const diagnostics = await page.getByTestId('stage-status').textContent()
  expect(diagnostics).toContain('DPR')
  expect(diagnostics).toContain('MP')
  const canvas = page.locator('[data-live2d-stage] canvas')
  await expect(canvas).toHaveCount(1)
  const bufferPixels = await canvas.evaluate(
    element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height,
  )
  expect(bufferPixels).toBeLessThanOrEqual(1_500_000)
})

test('surfaces WebGL context loss and recreates the stage', async ({ page, browserName }) => {
  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  const supported = await page.locator('[data-live2d-stage] canvas').evaluate((canvas, useExtension) => {
    if (!useExtension) {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      return true
    }
    const gl = (canvas as HTMLCanvasElement).getContext('webgl')
      ?? (canvas as HTMLCanvasElement).getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return Boolean(extension)
  }, browserName === 'chromium')
  test.skip(!supported, 'WEBGL_lose_context is unavailable in this runtime.')

  await expect(page.locator('.error-panel')).toContainText('render-error')
  await page.getByRole('button', { name: 'Retry stage' }).click()
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  await expect(page.locator('[data-live2d-stage] canvas')).toHaveCount(1)
})
