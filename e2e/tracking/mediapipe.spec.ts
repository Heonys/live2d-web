import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

async function expectTracked(page: Page, status: Locator, timeout: number) {
  await expect(status).toHaveText(/^(?:error|tracked)$/, { timeout })
  if (await status.textContent() === 'error') {
    const message = await page.getByTestId('tracking-error').textContent()
    throw new Error(`Face Landmarker initialization failed: ${message ?? 'unknown error'}`)
  }
}

for (const execution of ['main', 'worker'] as const) {
  test(`runs the real Face Landmarker in ${execution} mode and releases it cleanly`, async ({ browserName, page }) => {
    // Linux WebKit can serialize a worker's WASM compilation with its content
    // process. This is a functional gate, not a CI performance budget, so give
    // WebKit the same initialization room as the slower Firefox runner.
    const startup = browserName === 'chromium' ? 60_000 : 150_000
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto(`/tracking-e2e?execution=${execution}`)

    const status = page.getByTestId('tracking-status')
    await expectTracked(page, status, startup)
    await expect(page.getByTestId('tracking-error')).toHaveCount(0)
    await expect(page.getByTestId('tracking-inference')).not.toHaveText('0.00')
    await expect(page.getByTestId('tracking-metrics')).not.toHaveText('', {
      timeout: startup,
    })
    const metrics = JSON.parse(await page.getByTestId('tracking-metrics').textContent()) as {
      effectiveFps: number
      inferenceP50: number
      inferenceP95: number
      trackingFrameOver33Ratio: number
      trackingFrameP95: number
    }
    const metricsPath = test.info().outputPath('tracking-metrics.json')
    writeFileSync(metricsPath, Buffer.from(JSON.stringify(metrics, null, 2)))
    await test.info().attach('tracking-metrics.json', {
      contentType: 'application/json',
      path: metricsPath,
    })
    expect(metrics.inferenceP50).toBeGreaterThan(0)
    expect(metrics.inferenceP95).toBeGreaterThanOrEqual(metrics.inferenceP50)
    expect(metrics.effectiveFps).toBeGreaterThanOrEqual(10)
    expect(metrics.effectiveFps).toBeLessThanOrEqual(30)

    await page.getByRole('button', { name: 'Detect blank frame' }).click()
    await expect(status).toHaveText('lost')

    await page.getByRole('button', { name: 'Restart' }).click()
    await expectTracked(page, status, startup)
    await page.getByRole('button', { name: 'Dispose' }).click()
    await expect(status).toHaveText('disposed')
    expect(pageErrors).toEqual([])
  })
}
