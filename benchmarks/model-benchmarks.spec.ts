import type { Browser, BrowserContext, Page } from '@playwright/test'
import type {
  BenchmarkCondition,
  BenchmarkMeasurement,
  BenchmarkResult,
} from './lib/schema'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import {
  assertHardwareRenderer,
  gitCommit,
  readBenchmarkEnvironment,
} from './lib/environment'
import { writeBenchmarkResult } from './lib/io'
import {
  assertReleased,
  captureMeasurement,
  dispose,
  mount,
  openBenchmark,
} from './lib/page'
import { BENCHMARK_SCHEMA_VERSION, createMeasurement } from './lib/schema'

const suite = process.env.LIVE2D_BENCHMARK_SUITE ?? 'smoke'
const models = ['mark', 'hiyori', 'mao', 'rice', 'ren']
const baseURL = 'http://127.0.0.1:3110'

function result(
  selectedSuite: BenchmarkResult['suite'],
  environment: BenchmarkResult['environment'],
  runs: BenchmarkMeasurement[],
): BenchmarkResult {
  return {
    capturedAt: new Date().toISOString(),
    environment,
    gitCommit: gitCommit(),
    metadata: {
      core: '5.3 (core/06)',
      framework: '5-r.5',
      sampleRef: 'CubismWebSamples@5-r.5',
    },
    runs,
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    suite: selectedSuite,
  }
}

test.describe.configure({ mode: 'serial' })

test('model benchmark suite', async ({ browser, page }) => {
  test.setTimeout(2 * 60 * 60_000)
  test.skip(![
    'hardware-matrix',
    'hardware-smoke',
    'matrix',
    'memory',
    'smoke',
    'startup',
  ].includes(suite))

  if (suite === 'hardware-smoke') {
    await runHardwareSuite(page, 'hardware-smoke')
    return
  }
  if (suite === 'hardware-matrix') {
    await runHardwareSuite(page, 'hardware-matrix')
    return
  }

  if (suite === 'startup') {
    await runStartup(browser, page)
    return
  }
  if (suite === 'matrix') {
    await runMatrix(page)
    return
  }
  if (suite === 'memory') {
    await runMemory(page)
    return
  }
  await runSmoke(page)
})

async function runSmoke(page: Page) {
  const durationMs = Number(process.env.LIVE2D_BENCHMARK_MS ?? 10_000)
  const runs: BenchmarkMeasurement[] = []
  for (const model of ['mark', 'hiyori']) {
    runs.push(await captureMeasurement(
      page,
      { model, resolution: 1, stageCount: 1 },
      1,
      durationMs,
      0,
    ))
  }
  for (const run of runs) {
    expect(run.frame.frameDelta.count).toBeGreaterThan(durationMs / 1_000 * 30)
    expect(run.firstDrawMs).not.toBeNull()
  }
  writeBenchmarkResult(
    'model-smoke.latest.json',
    result('smoke', await readBenchmarkEnvironment(page), runs),
  )
}

async function runMatrix(page: Page) {
  const durationMs = Number(process.env.LIVE2D_BENCHMARK_MS ?? 60_000)
  const warmupMs = Number(process.env.LIVE2D_BENCHMARK_WARMUP_MS ?? 5_000)
  const repetitions = Number(process.env.LIVE2D_BENCHMARK_REPETITIONS ?? 3)
  const conditions: BenchmarkCondition[] = [
    ...models.flatMap(model => [1, 2].map(resolution => ({
      model,
      resolution,
      stageCount: 1,
    }))),
    ...['hiyori', 'ren'].flatMap(model => [2, 4].flatMap(stageCount => (
      [1, 2].map(resolution => ({ model, resolution, stageCount }))
    ))),
  ]
  const runs: BenchmarkMeasurement[] = []
  const matrixResult = result(
    'matrix',
    await readBenchmarkEnvironment(page),
    runs,
  )
  for (const condition of conditions) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      process.stdout.write(
        `[matrix] ${condition.model} stage=${condition.stageCount} `
        + `resolution=${condition.resolution} repetition=${repetition}/${repetitions}\n`,
      )
      const run = await captureMeasurement(
        page,
        condition,
        repetition,
        durationMs,
        warmupMs,
      )
      expect(run.frame.frameDelta.count).toBeGreaterThan(0)
      expect(run.frame.frameDelta.p50).not.toBeNull()
      expect(Number.isFinite(run.frame.frameDelta.p95)).toBe(true)
      runs.push(run)
      // Preserve completed repetitions even when a later heavy condition
      // fails, while keeping the latest file ignored from Git and npm.
      writeBenchmarkResult('model-matrix.latest.json', matrixResult)
    }
  }
}

async function runHardwareSuite(
  page: Page,
  selectedSuite: 'hardware-matrix' | 'hardware-smoke',
) {
  const environment = await readBenchmarkEnvironment(page)
  assertHardwareRenderer(environment.webglRenderer)
  const smoke = selectedSuite === 'hardware-smoke'
  const durationMs = Number(process.env.LIVE2D_BENCHMARK_MS ?? (smoke ? 10_000 : 60_000))
  const warmupMs = Number(process.env.LIVE2D_BENCHMARK_WARMUP_MS ?? (smoke ? 0 : 5_000))
  const repetitions = Number(process.env.LIVE2D_BENCHMARK_REPETITIONS ?? (smoke ? 1 : 3))
  const conditions: BenchmarkCondition[] = smoke
    ? ['hiyori', 'ren'].map(model => ({
        backend: 'cubism-webgl' as const,
        core: '5.3 (core/06)',
        model,
        resolution: 1,
        stageCount: 1,
      }))
    : ['hiyori', 'ren'].flatMap(model => [1, 4].flatMap(stageCount => (
        [1, 2].map(resolution => ({
          backend: 'cubism-webgl' as const,
          core: '5.3 (core/06)',
          model,
          resolution,
          stageCount,
        }))
      )))
  const runs: BenchmarkMeasurement[] = []
  const hardwareResult = result(selectedSuite, environment, runs)
  const output = `${selectedSuite}.latest.json`

  for (const condition of conditions) {
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      process.stdout.write(
        `[${selectedSuite}] ${condition.model} stage=${condition.stageCount} `
        + `resolution=${condition.resolution} repetition=${repetition}/${repetitions}\n`,
      )
      const run = await captureMeasurement(
        page,
        condition,
        repetition,
        durationMs,
        warmupMs,
      )
      expect(run.frame.frameDelta.count).toBeGreaterThan(0)
      expect(Number.isFinite(run.frame.frameDelta.p50)).toBe(true)
      expect(Number.isFinite(run.frame.frameDelta.p95)).toBe(true)
      runs.push(run)
      writeBenchmarkResult(output, hardwareResult)
    }
  }
}

async function newColdPage(browser: Browser) {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  await session.send('Network.enable')
  await session.send('Network.clearBrowserCache')
  await session.send('Network.setCacheDisabled', { cacheDisabled: true })
  return { context, page, session }
}

async function runStartup(browser: Browser, environmentPage: Page) {
  const runs: BenchmarkMeasurement[] = []
  for (const model of models) {
    for (let repetition = 1; repetition <= 3; repetition++) {
      const cold = await newColdPage(browser)
      try {
        const condition: BenchmarkCondition = {
          cache: 'cold',
          model,
          resolution: 1,
          stageCount: 1,
        }
        const coldSnapshot = await openBenchmark(cold.page, condition)
        const coldReleased = await dispose(cold.page)
        assertReleased(coldReleased)
        const coldMeasurement = createMeasurement(
          condition,
          repetition,
          coldSnapshot.readyMs,
          coldSnapshot.diagnostics,
        )
        coldMeasurement.lifecycle = coldReleased.diagnostics.resources
        runs.push(coldMeasurement)

        await cold.session.send('Network.setCacheDisabled', { cacheDisabled: false })
        // The disabled cold request is not guaranteed to populate Chromium's
        // cache. Prime once, then measure disposal + recreation in this context.
        await mount(cold.page)
        assertReleased(await dispose(cold.page))
        const warmSnapshot = await mount(cold.page)
        const warmReleased = await dispose(cold.page)
        assertReleased(warmReleased)
        const warmMeasurement = createMeasurement(
          { ...condition, cache: 'warm' },
          repetition,
          warmSnapshot.readyMs,
          warmSnapshot.diagnostics,
        )
        warmMeasurement.lifecycle = warmReleased.diagnostics.resources
        runs.push(warmMeasurement)
      }
      finally {
        await cold.context.close()
      }
    }
  }
  writeBenchmarkResult(
    'model-startup.latest.json',
    result('startup', await readBenchmarkEnvironment(environmentPage), runs),
  )
}

async function collectHeap(
  context: BrowserContext,
  page: Page,
) {
  const session = await context.newCDPSession(page)
  await session.send('HeapProfiler.enable')
  await session.send('HeapProfiler.collectGarbage')
  const usage = await session.send('Runtime.getHeapUsage')
  await session.detach()
  return usage.usedSize
}

async function runMemory(page: Page) {
  const runs: BenchmarkMeasurement[] = []
  const context = page.context()
  for (const model of ['hiyori', 'ren']) {
    for (const [stageCount, cycles] of [[1, 20], [4, 5]] as const) {
      const condition = { model, resolution: 1, stageCount }
      await openBenchmark(page, condition)
      assertReleased(await dispose(page))
      for (let repetition = 1; repetition <= cycles; repetition++) {
        const active = await mount(page)
        const released = await dispose(page)
        assertReleased(released)
        const measurement = createMeasurement(
          condition,
          repetition,
          active.readyMs,
          active.diagnostics,
        )
        measurement.lifecycle = released.diagnostics.resources
        measurement.memory = {
          active: null,
          activeHeapDeltaBytes: null,
          baseline: null,
          cycles: 1,
          released: {
            canvasCount: released.diagnostics.resources.canvas,
            heapUsedBytes: await collectHeap(context, page),
          },
          retainedHeapDeltaBytes: null,
        }
        runs.push(measurement)
      }
    }
  }
  writeBenchmarkResult(
    'model-memory.latest.json',
    result('memory', await readBenchmarkEnvironment(page), runs),
  )
}
