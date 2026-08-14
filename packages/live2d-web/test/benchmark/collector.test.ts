import type { CubismBenchmarkStageDiagnostics } from '../../src/adapters/cubism-webgl/diagnostics'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGpuTimer,
  measureAsync,
  measureSync,
} from '../../src/adapters/cubism-webgl/diagnostics'
import { BenchmarkDiagnostics } from './collector'

function diagnostics(): CubismBenchmarkStageDiagnostics {
  return {
    changeResource: vi.fn(),
    firstDraw: vi.fn(),
    framePhase: vi.fn(),
    gpuDraw: vi.fn(),
    gpuTimerSupport: vi.fn(),
    loadPhase: vi.fn(),
    stageId: 'test',
  }
}

afterEach(() => vi.restoreAllMocks())

describe('benchmark diagnostics', () => {
  it('does not read the clock on the disabled fast path', async () => {
    const now = vi.spyOn(performance, 'now')
    expect(measureSync(undefined, 'frame', 'motion', () => 42)).toBe(42)
    await expect(measureAsync(undefined, 'ready', async () => 7)).resolves.toBe(7)
    expect(now).not.toHaveBeenCalled()
  })

  it('collects stage samples and lifecycle counters', () => {
    const collector = new BenchmarkDiagnostics()
    const stage = collector.createStage()
    stage.changeResource('canvas', 1)
    stage.loadPhase('mocFetch', 2)
    stage.framePhase('coreUpdate', 0.5)
    stage.firstDraw()
    stage.changeResource('canvas', -1)

    const snapshot = collector.snapshot()
    expect(snapshot.resources.canvas).toBe(0)
    expect(snapshot.stages[0].load.mocFetch).toEqual([2])
    expect(snapshot.stages[0].frame.coreUpdate).toEqual([0.5])
    expect(snapshot.stages[0].firstDrawMs).not.toBeNull()
  })

  it('reports a missing GPU timer extension as null', () => {
    const target = diagnostics()
    const gl = {
      getExtension: vi.fn(() => null),
    } as unknown as WebGL2RenderingContext
    expect(createGpuTimer(gl, target)).toBeUndefined()
    expect(target.gpuTimerSupport).toHaveBeenCalledWith(false)
    expect(target.gpuDraw).toHaveBeenCalledWith(null)
  })

  it('discards disjoint GPU query results', () => {
    const target = diagnostics()
    const extension = { GPU_DISJOINT_EXT: 10, TIME_ELAPSED_EXT: 11 }
    const query = {} as WebGLQuery
    const gl = {
      QUERY_RESULT: 20,
      QUERY_RESULT_AVAILABLE: 21,
      beginQuery: vi.fn(),
      createQuery: vi.fn(() => query),
      deleteQuery: vi.fn(),
      endQuery: vi.fn(),
      getExtension: vi.fn(() => extension),
      getParameter: vi.fn(() => true),
      getQueryParameter: vi.fn((_, parameter) => (
        parameter === 21 ? true : 4_000_000
      )),
    } as unknown as WebGL2RenderingContext
    const timer = createGpuTimer(gl, target)!
    timer.begin()
    timer.end()
    timer.poll()
    expect(target.gpuDraw).toHaveBeenCalledWith(null)
    expect(gl.deleteQuery).toHaveBeenCalledWith(query)
  })
})
