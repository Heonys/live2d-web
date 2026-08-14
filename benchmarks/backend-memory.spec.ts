import type { Browser, CDPSession, Page } from '@playwright/test'
import type { BackendMemoryPageSnapshot } from '../apps/playground/src/benchmark/backendMemoryContracts'
import type {
  BenchmarkBackend,
  BenchmarkMeasurement,
  BenchmarkResult,
  BenchmarkScriptBytes,
} from './lib/schema'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { gitCommit, readBenchmarkEnvironment } from './lib/environment'
import { writeBenchmarkResult } from './lib/io'
import { median } from './lib/metrics'
import { BENCHMARK_SCHEMA_VERSION } from './lib/schema'

interface ScriptEntry {
  bytes: number
  name: string
}

const baseURL = 'http://127.0.0.1:3110'
const backends: Array<{ backend: BenchmarkBackend, core: string }> = [
  { backend: 'cubism-webgl', core: '5.3 (core/06)' },
  { backend: 'pixi-v6', core: 'pre-5.3 (core/05)' },
]
const emptyLifecycle = {
  canvas: 0,
  context: 0,
  frameworkReference: 0,
  pendingExpression: 0,
  pendingMotion: 0,
  texture: 0,
}

async function collectHeap(session: CDPSession) {
  await session.send('HeapProfiler.collectGarbage')
  return (await session.send('Runtime.getHeapUsage')).usedSize
}

function canvasCount(page: Page) {
  return page.evaluate(() => document.querySelectorAll('canvas').length)
}

function scripts(page: Page): Promise<ScriptEntry[]> {
  return page.evaluate(() => performance.getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => (
      entry instanceof PerformanceResourceTiming
      && (entry.initiatorType === 'script' || entry.name.endsWith('.js'))
    ))
    .map(entry => ({
      bytes: entry.encodedBodySize,
      name: entry.name,
    })))
}

function scriptBytes(before: ScriptEntry[], after: ScriptEntry[]): BenchmarkScriptBytes {
  const beforeNames = new Set(before.map(entry => entry.name))
  const added = after.filter(entry => !beforeNames.has(entry.name))
  const sum = (entries: ScriptEntry[]) => entries.reduce((total, entry) => total + entry.bytes, 0)
  const coreEntries = added.filter(entry => entry.name.includes('live2dcubismcore.min.js'))
  const adapterEntries = added.filter(entry => !coreEntries.includes(entry))
  const common = sum(before)
  const adapter = sum(adapterEntries)
  const core = sum(coreEntries)
  return { adapter, common, core, total: common + adapter + core }
}

function controller(page: Page) {
  return {
    dispose: () => page.evaluate(() => {
      if (!window.__live2dBackendMemory)
        throw new Error('Backend memory controller is unavailable.')
      return window.__live2dBackendMemory.dispose()
    }) as Promise<BackendMemoryPageSnapshot>,
    mount: () => page.evaluate(() => {
      if (!window.__live2dBackendMemory)
        throw new Error('Backend memory controller is unavailable.')
      return window.__live2dBackendMemory.mount()
    }) as Promise<BackendMemoryPageSnapshot>,
  }
}

async function measureCondition(
  browser: Browser,
  backend: BenchmarkBackend,
  core: string,
  stageCount: 1 | 4,
  repetition: number,
): Promise<BenchmarkMeasurement> {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  const session = await context.newCDPSession(page)
  try {
    await session.send('Network.enable')
    await session.send('Network.setCacheDisabled', { cacheDisabled: true })
    await session.send('HeapProfiler.enable')
    await page.goto(`/benchmark/backend-memory?backend=${backend}&stageCount=${stageCount}`)
    await expect(page.getByTestId('backend-memory-status')).toHaveText('ready-to-mount')

    const baselineScripts = await scripts(page)
    const baselineHeap = await collectHeap(session)
    const baselineCanvas = await canvasCount(page)
    expect(baselineCanvas).toBe(0)

    const cycles = stageCount === 1 ? 20 : 5
    const activeHeaps: number[] = []
    const activeCanvases: number[] = []
    const releasedHeaps: number[] = []
    const releasedCanvases: number[] = []
    const readyTimes: number[] = []
    let loadedScripts: ScriptEntry[] = baselineScripts
    const controls = controller(page)

    for (let cycle = 0; cycle < cycles; cycle++) {
      const active = await controls.mount()
      readyTimes.push(active.readyMs ?? 0)
      activeHeaps.push(await collectHeap(session))
      activeCanvases.push(await canvasCount(page))
      expect(activeCanvases.at(-1)).toBe(stageCount)
      if (cycle === 0)
        loadedScripts = await scripts(page)

      const released = await controls.dispose()
      releasedHeaps.push(await collectHeap(session))
      releasedCanvases.push(await canvasCount(page))
      expect(released.canvasCount).toBe(0)
      expect(releasedCanvases.at(-1)).toBe(0)
    }

    const activeHeap = median(activeHeaps) ?? 0
    const releasedHeap = median(releasedHeaps) ?? 0
    return {
      condition: {
        backend,
        core,
        model: 'hiyori',
        resolution: 1,
        stageCount,
      },
      firstDrawMs: null,
      frame: {},
      gpuDraw: null,
      gpuTimerSupported: false,
      lifecycle: { ...emptyLifecycle, canvas: Math.max(...releasedCanvases) },
      load: {},
      longFrameRatio: null,
      memory: {
        active: {
          canvasCount: Math.round(median(activeCanvases) ?? 0),
          heapUsedBytes: activeHeap,
        },
        activeHeapDeltaBytes: activeHeap - baselineHeap,
        baseline: { canvasCount: baselineCanvas, heapUsedBytes: baselineHeap },
        cycles,
        released: {
          canvasCount: Math.round(median(releasedCanvases) ?? 0),
          heapUsedBytes: releasedHeap,
        },
        retainedHeapDeltaBytes: releasedHeap - baselineHeap,
        scripts: scriptBytes(baselineScripts, loadedScripts),
      },
      readyMs: median(readyTimes),
      repetition,
    }
  }
  finally {
    await session.detach()
    await context.close()
  }
}

test.describe.configure({ mode: 'serial' })

test('compares supported cubism-webgl and pixi-v6 memory paths', async ({ browser, page }) => {
  test.setTimeout(2 * 60 * 60_000)
  const result: BenchmarkResult = {
    capturedAt: new Date().toISOString(),
    environment: await readBenchmarkEnvironment(page),
    gitCommit: gitCommit(),
    metadata: {
      core: 'per run; see condition.core',
      framework: '5-r.5 / pixi-live2d-display@0.4',
      sampleRef: 'Hiyori',
    },
    runs: [],
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    suite: 'backend-memory',
  }

  for (const { backend, core } of backends) {
    for (const stageCount of [1, 4] as const) {
      for (let repetition = 1; repetition <= 3; repetition++) {
        process.stdout.write(
          `[backend-memory] ${backend} stage=${stageCount} repetition=${repetition}/3\n`,
        )
        result.runs.push(await measureCondition(
          browser,
          backend,
          core,
          stageCount,
          repetition,
        ))
        writeBenchmarkResult('backend-memory.latest.json', result)
      }
    }
  }
})
