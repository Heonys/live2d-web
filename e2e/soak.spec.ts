import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const durationMinutes = Number(process.env.LIVE2D_SOAK_MINUTES ?? 120)
const expressionModel = readFileSync(
  new URL('./fixtures/cubism-webgl/hiyori-expression.model3.json', import.meta.url),
  'utf8',
)
const positiveExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/angle-positive.exp3.json', import.meta.url),
  'utf8',
)
const negativeExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/angle-negative.exp3.json', import.meta.url),
  'utf8',
)

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

test('keeps the 0.4 Hiyori candidate healthy during a long session', async ({
  context,
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  const cdp = await context.newCDPSession(page)
  await page.route('**/e2e-expression.model3.json', route => route.fulfill({
    body: expressionModel,
    contentType: 'application/json',
  }))
  await page.route('**/e2e-fixtures/angle-positive.exp3.json', route => route.fulfill({
    body: positiveExpression,
    contentType: 'application/json',
  }))
  await page.route('**/e2e-fixtures/angle-negative.exp3.json', route => route.fulfill({
    body: negativeExpression,
    contentType: 'application/json',
  }))
  await page.goto('/e2e')
  await expect(page.locator('#e2e-status')).toHaveText('ready')
  const heapSamples: number[] = []
  const exerciseCounts = {
    fixtureCycles: 0,
    motionPresets: 0,
    recreates: 0,
    sequences: 0,
  }

  for (let minute = 0; minute < durationMinutes; minute++) {
    await page.waitForTimeout(60_000)
    const elapsedMinutes = minute + 1
    if (elapsedMinutes % 5 === 0) {
      const result = await page.evaluate(() => window.__live2dWebE2E?.soakSequence())
      expect(result).toEqual({ completedSteps: 2, status: 'completed' })
      exerciseCounts.sequences++
    }
    if (elapsedMinutes % 10 === 0) {
      const presets: Array<number | null> = [null, 0, 500]
      const preset = presets[(elapsedMinutes / 10 - 1) % presets.length]
      const result = await page.evaluate(fadeMs =>
        window.__live2dWebE2E?.soakMotion(fadeMs ?? undefined), preset)
      expect(result).toBe('completed')
      exerciseCounts.motionPresets++
    }
    if (elapsedMinutes % 15 === 0) {
      const result = await page.evaluate(() =>
        window.__live2dWebE2E?.soakFixtureCycle())
      expect(result).toEqual({ canvases: 1, finite: true })
      exerciseCounts.fixtureCycles++
    }
    if (elapsedMinutes % 30 === 0) {
      const result = await page.evaluate(() => window.__live2dWebE2E?.cycle(1))
      expect(result?.canvases).toBe(1)
      exerciseCounts.recreates++
    }
    await cdp.send('HeapProfiler.collectGarbage')
    const heap = await cdp.send('Runtime.getHeapUsage')
    heapSamples.push(heap.usedSize)
    await expect(page.locator('#e2e-status')).toHaveText('ready')
    await expect(page.locator('#e2e-character canvas')).toHaveCount(1)
    await expect.poll(() => page.evaluate(() =>
      window.__live2dWebE2E?.motionPlaying() ?? false)).toBe(true)
  }

  if (heapSamples.length >= 30) {
    const stableWindow = heapSamples.slice(10, 20)
    const finalWindow = heapSamples.slice(-10)
    expect(median(finalWindow)).toBeLessThanOrEqual(median(stableWindow) * 1.1)
  }

  const summaryPath = testInfo.outputPath('soak-summary.json')
  await writeFile(summaryPath, Buffer.from(JSON.stringify({
    durationMinutes,
    errors,
    exerciseCounts,
    heapMiB: heapSamples.map(bytes => Number((bytes / 1024 / 1024).toFixed(2))),
  }, null, 2)))
  await testInfo.attach('soak-summary', {
    contentType: 'application/json',
    path: summaryPath,
  })

  await page.evaluate(() => window.__live2dWebE2E?.stop())
  await expect(page.locator('#e2e-character canvas')).toHaveCount(0)
  expect(errors).toEqual([])
})
