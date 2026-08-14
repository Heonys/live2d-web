import type { SampleStatistics } from './lib/metrics'
import type { BenchmarkBackend, BenchmarkMeasurement, BenchmarkResult } from './lib/schema'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import {
  assertHardwareRenderer,
  gitCommit,
  readBenchmarkEnvironment,
} from './lib/environment'
import { writeBenchmarkResult } from './lib/io'
import { summarize } from './lib/metrics'
import { BENCHMARK_SCHEMA_VERSION } from './lib/schema'

interface FrameMetrics {
  frameCount: number
  frameTime: SampleStatistics
  longFrameRatio: number
  medianFps: number
}

declare global {
  interface Window {
    __live2dWebBenchmarkFrames?: number[]
  }
}

const durationMs = Number(process.env.LIVE2D_BENCHMARK_MS ?? 300_000)

async function sampleFrames(page: import('@playwright/test').Page): Promise<FrameMetrics> {
  await page.evaluate(() => window.__live2dWebBenchmarkFrames = [])
  await page.waitForTimeout(durationMs)
  const deltas = await page.evaluate(() => {
    const deltas = (window.__live2dWebBenchmarkFrames ?? [])
      .filter(delta => delta > 0)
    return deltas
  })
  const frameTime = summarize(deltas)
  return {
    frameCount: deltas.length,
    frameTime,
    longFrameRatio: deltas.length
      ? deltas.filter(delta => delta > 33).length / deltas.length
      : 0,
    medianFps: frameTime.p50 ? 1_000 / frameTime.p50 : 0,
  }
}

function measurement(
  backend: BenchmarkBackend,
  core: string,
  metrics: FrameMetrics,
): BenchmarkMeasurement {
  return {
    condition: {
      backend,
      core,
      model: 'hiyori',
      resolution: 1,
      stageCount: 1,
    },
    durationMs,
    firstDrawMs: null,
    frame: { frameDelta: metrics.frameTime },
    gpuDraw: null,
    gpuTimerSupported: false,
    lifecycle: {
      canvas: 0,
      context: 0,
      frameworkReference: 0,
      pendingExpression: 0,
      pendingMotion: 0,
      texture: 0,
    },
    load: {},
    longFrameRatio: metrics.longFrameRatio,
    readyMs: null,
    repetition: 1,
    warmupMs: 5_000,
  }
}

test('cubism-webgl stays within the Pixi performance budget', async ({ page }) => {
  await page.goto('/compare')
  const environment = await readBenchmarkEnvironment(page)
  if (process.env.LIVE2D_REQUIRE_HARDWARE_GPU === '1')
    assertHardwareRenderer(environment.webglRenderer)
  const status = page.getByTestId('comparison-status')
  await expect(status).toContainText('ready')
  await page.waitForTimeout(5_000)
  const cubismWebgl = await sampleFrames(page)

  await page.getByLabel('Backend').selectOption('pixi-v6')
  await expect(status).toContainText('ready')
  await page.waitForTimeout(5_000)
  const pixiV6 = await sampleFrames(page)
  await page.goto('about:blank')

  const hardware = process.env.LIVE2D_REQUIRE_HARDWARE_GPU === '1'
  const result: BenchmarkResult = {
    capturedAt: new Date().toISOString(),
    environment,
    gitCommit: gitCommit(),
    metadata: {
      core: 'per run; see condition.core',
      framework: '5-r.5 / pixi-live2d-display@0.4',
      sampleRef: 'Hiyori',
    },
    runs: [
      measurement('cubism-webgl', '5.3 (core/06)', cubismWebgl),
      measurement('pixi-v6', 'pre-5.3 (core/05)', pixiV6),
    ],
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    suite: hardware ? 'hardware-backends' : 'backends',
  }
  writeBenchmarkResult(
    durationMs === 300_000
      ? 'backend-comparison.latest.json'
      : 'backend-comparison.smoke.latest.json',
    result,
  )

  expect(cubismWebgl.frameCount).toBeGreaterThan(durationMs / 1_000 * 30)
  expect(pixiV6.frameCount).toBeGreaterThan(durationMs / 1_000 * 30)
  expect(cubismWebgl.medianFps).toBeGreaterThanOrEqual(pixiV6.medianFps * 0.95)
  expect(cubismWebgl.longFrameRatio - pixiV6.longFrameRatio)
    .toBeLessThanOrEqual(0.005)
})
