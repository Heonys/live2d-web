import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'

interface FrameMetrics {
  frameCount: number
  longFrameRatio: number
  medianFps: number
}

const durationMs = Number(process.env.LIVE2D_BENCHMARK_MS ?? 300_000)

async function sampleFrames(page: import('@playwright/test').Page): Promise<FrameMetrics> {
  await page.evaluate(() => window.__live2dWebBenchmarkFrames = [])
  await page.waitForTimeout(durationMs)
  return page.evaluate(() => {
    const deltas = (window.__live2dWebBenchmarkFrames ?? [])
      .filter(delta => delta > 0)
    deltas.sort((left, right) => left - right)
    const medianDelta = deltas[Math.floor(deltas.length / 2)] ?? Infinity
    return {
      frameCount: deltas.length,
      longFrameRatio: deltas.filter(delta => delta > 33).length / deltas.length,
      medianFps: 1_000 / medianDelta,
    }
  })
}

test('cubism-webgl stays within the Pixi performance budget', async ({ page }) => {
  await page.goto('/compare')
  const status = page.getByTestId('comparison-status')
  await expect(status).toContainText('ready')
  await page.waitForTimeout(5_000)
  const cubismWebgl = await sampleFrames(page)

  await page.getByLabel('Backend').selectOption('pixi-v6')
  await expect(status).toContainText('ready')
  await page.waitForTimeout(5_000)
  const pixiV6 = await sampleFrames(page)

  const result = {
    capturedAt: new Date().toISOString(),
    conditions: {
      canvasResolution: 1,
      cubismWebglCore: 'core/06 (Cubism 5.3)',
      maxFps: 60,
      model: 'Hiyori',
      pixiV6Core: 'core/05 (pre-5.3)',
      viewport: '1200x900',
    },
    durationMs,
    cubismWebgl,
    pixiV6,
  }
  const outputDirectory = path.resolve('benchmark-results')
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(
    path.join(outputDirectory, 'backend-comparison.latest.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  )

  expect(cubismWebgl.frameCount).toBeGreaterThan(durationMs / 1_000 * 30)
  expect(pixiV6.frameCount).toBeGreaterThan(durationMs / 1_000 * 30)
  expect(cubismWebgl.medianFps).toBeGreaterThanOrEqual(pixiV6.medianFps * 0.95)
  expect(cubismWebgl.longFrameRatio - pixiV6.longFrameRatio)
    .toBeLessThanOrEqual(0.005)
})
