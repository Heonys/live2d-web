import { expect, test } from '@playwright/test'

const durationMinutes = Number(process.env.LIVE2D_SOAK_MINUTES ?? 120)

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

test('keeps a runtime healthy during a long OBS-like session', async ({ context, page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  const cdp = await context.newCDPSession(page)
  await page.goto('/e2e')
  await expect(page.locator('#e2e-status')).toHaveText('ready')
  const heapSamples: number[] = []

  for (let minute = 0; minute < durationMinutes; minute++) {
    await page.waitForTimeout(60_000)
    if ((minute + 1) % 10 === 0) {
      const motionError = await page.evaluate(() => window.__live2dWebE2E?.motion())
      expect(motionError).toBeUndefined()
    }
    if ((minute + 1) % 30 === 0) {
      const result = await page.evaluate(() => window.__live2dWebE2E?.cycle(1))
      expect(result?.canvases).toBe(1)
    }
    await cdp.send('HeapProfiler.collectGarbage')
    const heap = await cdp.send('Runtime.getHeapUsage')
    heapSamples.push(heap.usedSize)
    await expect(page.locator('#e2e-status')).toHaveText('ready')
    await expect(page.locator('#e2e-character canvas')).toHaveCount(1)
  }

  if (heapSamples.length >= 30) {
    const stableWindow = heapSamples.slice(10, 20)
    const finalWindow = heapSamples.slice(-10)
    expect(median(finalWindow)).toBeLessThanOrEqual(median(stableWindow) * 1.1)
  }

  await page.evaluate(() => window.__live2dWebE2E?.stop())
  await expect(page.locator('#e2e-character canvas')).toHaveCount(0)
  expect(errors).toEqual([])
})
