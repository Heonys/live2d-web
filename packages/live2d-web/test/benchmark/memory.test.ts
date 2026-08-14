import type { BenchmarkBackend, BenchmarkMeasurement } from '../../../../benchmarks/lib/schema'
import { describe, expect, it } from 'vitest'
import { evaluateBackendMemory } from '../../../../benchmarks/lib/memory'
import { renderBenchmarkReport } from '../../../../benchmarks/lib/report'
import {
  BENCHMARK_SCHEMA_VERSION,
  createMeasurement,
} from '../../../../benchmarks/lib/schema'

const resources = {
  canvas: 0,
  context: 0,
  frameworkReference: 0,
  pendingExpression: 0,
  pendingMotion: 0,
  texture: 0,
}

function memoryRun(
  backend: BenchmarkBackend,
  stageCount: number,
  activeHeapDeltaBytes: number,
): BenchmarkMeasurement {
  const run = createMeasurement(
    { backend, model: 'hiyori', resolution: 1, stageCount },
    1,
    100,
    { resources, stages: [] },
  )
  run.memory = {
    active: { canvasCount: stageCount, heapUsedBytes: activeHeapDeltaBytes + 1_000 },
    activeHeapDeltaBytes,
    baseline: { canvasCount: 0, heapUsedBytes: 1_000 },
    cycles: stageCount === 1 ? 20 : 5,
    released: { canvasCount: 0, heapUsedBytes: 1_000 },
    retainedHeapDeltaBytes: 0,
    scripts: {
      adapter: backend === 'cubism-webgl' ? 60 : 100,
      common: 200,
      core: 50,
      total: backend === 'cubism-webgl' ? 310 : 350,
    },
  }
  return run
}

describe('backend memory evaluation', () => {
  it('requires at least a ten percent reduction for both Stage counts', () => {
    expect(evaluateBackendMemory([
      memoryRun('cubism-webgl', 1, 80),
      memoryRun('pixi-v6', 1, 100),
      memoryRun('cubism-webgl', 4, 180),
      memoryRun('pixi-v6', 4, 200),
    ]).conclusion).toBe('lower')

    expect(evaluateBackendMemory([
      memoryRun('cubism-webgl', 1, 95),
      memoryRun('pixi-v6', 1, 100),
      memoryRun('cubism-webgl', 4, 180),
      memoryRun('pixi-v6', 4, 200),
    ]).conclusion).toBe('inconclusive')
  })

  it('renders a v2 backend memory report with the qualified conclusion', () => {
    const runs = [
      memoryRun('cubism-webgl', 1, 80),
      memoryRun('pixi-v6', 1, 100),
      memoryRun('cubism-webgl', 4, 160),
      memoryRun('pixi-v6', 4, 200),
    ]
    const report = renderBenchmarkReport({
      capturedAt: '2026-08-15T00:00:00.000Z',
      environment: {
        browser: 'Chromium',
        cpu: 'Test CPU',
        memoryBytes: 8 * 1024 ** 3,
        os: 'Test OS',
        webglRenderer: 'Test GPU',
      },
      gitCommit: 'abc123',
      metadata: {
        core: 'per run',
        framework: '5-r.5 / pixi-live2d-display@0.4',
        sampleRef: 'Hiyori',
      },
      runs,
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      suite: 'backend-memory',
    })
    expect(report).toContain('active JS heap delta')
    expect(report).toContain('10% 이상 낮았다')
    expect(report).toContain('40.00% 적었다')
  })
})
