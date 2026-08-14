import type { Page } from '@playwright/test'
import type {
  BenchmarkPageController,
  BenchmarkPageSnapshot,
} from '../../apps/playground/src/benchmark/contracts'
import type { BenchmarkCondition, BenchmarkMeasurement } from './schema'
import { expect } from '@playwright/test'
import { createMeasurement } from './schema'

export async function openBenchmark(page: Page, condition: BenchmarkCondition) {
  const query = new URLSearchParams({
    model: condition.model,
    resolution: String(condition.resolution),
    stageCount: String(condition.stageCount),
  })
  await page.goto(`/benchmark?${query}`)
  await expect(page.getByTestId('benchmark-status')).toHaveText('ready', {
    timeout: 60_000,
  })
  return snapshot(page)
}

export function snapshot(page: Page) {
  return page.evaluate(() => {
    const benchmark = window.__live2dModelBenchmark
    if (!benchmark)
      throw new Error('Benchmark controller is unavailable.')
    return benchmark.snapshot()
  }) as Promise<BenchmarkPageSnapshot>
}

export function resetFrameSamples(page: Page) {
  return page.evaluate(() => {
    const benchmark = window.__live2dModelBenchmark
    if (!benchmark)
      throw new Error('Benchmark controller is unavailable.')
    benchmark.resetFrameSamples()
  })
}

export function exercise(page: Page) {
  return page.evaluate(() => {
    const benchmark = window.__live2dModelBenchmark
    if (!benchmark)
      throw new Error('Benchmark controller is unavailable.')
    return benchmark.exercise()
  })
}

export function mount(page: Page) {
  return page.evaluate(() => {
    const benchmark = window.__live2dModelBenchmark
    if (!benchmark)
      throw new Error('Benchmark controller is unavailable.')
    return benchmark.mount()
  }) as Promise<BenchmarkPageSnapshot>
}

export function dispose(page: Page) {
  return page.evaluate(() => {
    const benchmark = window.__live2dModelBenchmark
    if (!benchmark)
      throw new Error('Benchmark controller is unavailable.')
    return benchmark.dispose()
  }) as Promise<BenchmarkPageSnapshot>
}

export function assertReleased(snapshot: BenchmarkPageSnapshot) {
  for (const [resource, count] of Object.entries(snapshot.diagnostics.resources))
    expect(count, `${resource} must be released`).toBe(0)
}

export async function captureMeasurement(
  page: Page,
  condition: BenchmarkCondition,
  repetition: number,
  durationMs: number,
  warmupMs: number,
): Promise<BenchmarkMeasurement> {
  await openBenchmark(page, condition)
  await exercise(page)
  await page.waitForTimeout(warmupMs)
  await resetFrameSamples(page)
  await page.waitForTimeout(durationMs)
  const active = await snapshot(page)
  const released = await dispose(page)
  assertReleased(released)
  const measurement = createMeasurement(
    condition,
    repetition,
    active.readyMs,
    active.diagnostics,
  )
  measurement.durationMs = durationMs
  measurement.lifecycle = released.diagnostics.resources
  measurement.warmupMs = warmupMs
  return measurement
}

export type { BenchmarkPageController }
