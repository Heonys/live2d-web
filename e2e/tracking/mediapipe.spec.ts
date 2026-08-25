import { Buffer } from 'node:buffer'
import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('runs the real Face Landmarker and releases it cleanly', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.goto('/tracking-e2e')

  const status = page.getByTestId('tracking-status')
  await expect(status).toHaveText('tracked', { timeout: 60_000 })
  await expect(page.getByTestId('tracking-error')).toHaveCount(0)
  await expect(page.getByTestId('tracking-inference')).not.toHaveText('0.00')
  await expect(page.getByTestId('tracking-metrics')).not.toHaveText('', {
    timeout: 60_000,
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
  await expect(status).toHaveText('tracked', { timeout: 60_000 })
  await page.getByRole('button', { name: 'Dispose' }).click()
  await expect(status).toHaveText('disposed')
  expect(pageErrors).toEqual([])
})
