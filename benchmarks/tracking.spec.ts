import type { Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

interface TrackingBenchmarkResult {
  canvasCount: number
  effectiveFps: number
  finiteParameters: boolean
  frameOver33Ratio: number
  frameP95: number
  inferenceP50: number
  inferenceP95: number
  roundTripP95: number
  skippedRatio: number
}

const mainInferenceBaselines: Record<string, number> = {
  chromium: 13.4,
  firefox: 197,
  // Re-measured from the untouched v0.5.0 tag on this machine before the
  // 0.6 comparison. WebKit's timer is quantized to whole milliseconds.
  webkit: 17,
}
const timerResolutionToleranceMs = 1

async function measure(page: Page, execution: 'main' | 'worker') {
  await page.goto(`/benchmark/tracking?execution=${execution}`)
  await expect(page.getByTestId('tracking-benchmark-status')).toHaveText('ready')
  await expect(page.getByTestId('tracking-benchmark-error')).toHaveCount(0)
  return JSON.parse(
    await page.getByTestId('tracking-benchmark-result').textContent() ?? '',
  ) as TrackingBenchmarkResult
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

test('compares main and Worker tracking while Hiyori renders', async ({ browserName, page }) => {
  const runs = {
    main: [] as TrackingBenchmarkResult[],
    worker: [] as TrackingBenchmarkResult[],
  }
  for (let repetition = 0; repetition < 3; repetition++) {
    runs.main.push(await measure(page, 'main'))
    runs.worker.push(await measure(page, 'worker'))
  }

  for (const run of [...runs.main, ...runs.worker]) {
    expect(run.canvasCount).toBe(1)
    expect(run.finiteParameters).toBe(true)
    expect(run.inferenceP95).toBeGreaterThan(0)
  }
  const summary = {
    browserName,
    main: {
      frameOver33Ratio: median(runs.main.map(run => run.frameOver33Ratio)),
      frameP95: median(runs.main.map(run => run.frameP95)),
      inferenceP50: median(runs.main.map(run => run.inferenceP50)),
      inferenceP95: median(runs.main.map(run => run.inferenceP95)),
    },
    worker: {
      effectiveFps: median(runs.worker.map(run => run.effectiveFps)),
      frameOver33Ratio: median(runs.worker.map(run => run.frameOver33Ratio)),
      frameP95: median(runs.worker.map(run => run.frameP95)),
      inferenceP50: median(runs.worker.map(run => run.inferenceP50)),
      inferenceP95: median(runs.worker.map(run => run.inferenceP95)),
      roundTripP95: median(runs.worker.map(run => run.roundTripP95)),
      skippedRatio: median(runs.worker.map(run => run.skippedRatio)),
    },
  }
  const output = path.resolve('benchmark-results', `tracking.${browserName}.json`)
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify({ runs, summary }, null, 2)}\n`)

  expect(summary.main.inferenceP95).toBeLessThanOrEqual(
    mainInferenceBaselines[browserName] * 1.1 + timerResolutionToleranceMs,
  )
  expect(summary.worker.frameP95).toBeLessThanOrEqual(33)
  expect(summary.worker.frameOver33Ratio).toBeLessThanOrEqual(0.05)
  // Anchored to the recorded baseline, not this run's own main measurement: a
  // budget derived from the same run widens in step with a joint regression
  // and can never fail.
  expect(summary.worker.roundTripP95).toBeLessThanOrEqual(
    mainInferenceBaselines[browserName] * 1.1 + timerResolutionToleranceMs + 34,
  )
})
