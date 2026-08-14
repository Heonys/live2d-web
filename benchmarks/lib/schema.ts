import type {
  BenchmarkDiagnosticsSnapshot,
  BenchmarkStageSnapshot,
} from '../../packages/live2d-web/test/benchmark/collector'
import type { SampleStatistics } from './metrics'
import { median, summarize } from './metrics'

export const BENCHMARK_SCHEMA_VERSION = 2 as const
const LEGACY_BENCHMARK_SCHEMA_VERSION = 1 as const

export type BenchmarkBackend = 'cubism-webgl' | 'pixi-v6'

export interface BenchmarkEnvironment {
  browser: string
  cpu: string
  memoryBytes: number
  os: string
  webglRenderer: string
}

export interface BenchmarkCondition {
  backend?: BenchmarkBackend
  cache?: 'cold' | 'warm'
  core?: string
  model: string
  resolution: number
  stageCount: number
}

export interface BenchmarkMemoryPoint {
  canvasCount: number
  heapUsedBytes: number
}

export interface BenchmarkScriptBytes {
  adapter: number
  common: number
  core: number
  total: number
}

export interface BenchmarkMemoryMetrics {
  active: BenchmarkMemoryPoint | null
  activeHeapDeltaBytes: number | null
  baseline: BenchmarkMemoryPoint | null
  cycles: number
  released: BenchmarkMemoryPoint
  retainedHeapDeltaBytes: number | null
  scripts?: BenchmarkScriptBytes
}

export interface BenchmarkMeasurement {
  condition: BenchmarkCondition
  durationMs?: number
  firstDrawMs: number | null
  frame: Record<string, SampleStatistics>
  gpuDraw: SampleStatistics | null
  gpuTimerSupported: boolean
  lifecycle: BenchmarkDiagnosticsSnapshot['resources']
  load: Record<string, SampleStatistics>
  longFrameRatio: number | null
  memory?: BenchmarkMemoryMetrics
  readyMs: number | null
  repetition: number
  warmupMs?: number
}

export interface BenchmarkResult {
  capturedAt: string
  environment: BenchmarkEnvironment
  gitCommit: string
  metadata: {
    core: string
    framework: string
    sampleRef: string
  }
  runs: BenchmarkMeasurement[]
  schemaVersion: typeof BENCHMARK_SCHEMA_VERSION
  suite:
    | 'backends'
    | 'backend-memory'
    | 'hardware-backends'
    | 'hardware-matrix'
    | 'hardware-smoke'
    | 'matrix'
    | 'memory'
    | 'smoke'
    | 'startup'
}

function mergePhaseSamples(
  stages: BenchmarkStageSnapshot[],
  scope: 'frame' | 'load',
) {
  const phases = new Set(stages.flatMap(stage => Object.keys(stage[scope])))
  return Object.fromEntries([...phases].map(phase => [
    phase,
    summarize(stages.flatMap((stage) => {
      const samples = stage[scope] as Record<string, number[]>
      return samples[phase] ?? []
    })),
  ]))
}

export function createMeasurement(
  condition: BenchmarkCondition,
  repetition: number,
  readyMs: number | null,
  diagnostics: BenchmarkDiagnosticsSnapshot,
): BenchmarkMeasurement {
  const frameDeltas = diagnostics.stages.flatMap(
    stage => stage.frame.frameDelta ?? [],
  ).filter(value => value > 0)
  const gpuSamples = diagnostics.stages.flatMap(stage => stage.gpuDrawMs)
  const finiteGpuSamples = gpuSamples.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  const gpuTimerSupported = diagnostics.stages.some(
    stage => stage.gpuTimerSupported === true,
  )
  return {
    condition,
    firstDrawMs: diagnostics.stages.length
      ? Math.max(...diagnostics.stages.map(stage => stage.firstDrawMs ?? 0))
      : null,
    frame: mergePhaseSamples(diagnostics.stages, 'frame'),
    gpuDraw: gpuTimerSupported ? summarize(finiteGpuSamples) : null,
    gpuTimerSupported,
    lifecycle: { ...diagnostics.resources },
    load: mergePhaseSamples(diagnostics.stages, 'load'),
    longFrameRatio: frameDeltas.length
      ? frameDeltas.filter(value => value > 33).length / frameDeltas.length
      : null,
    readyMs,
    repetition,
  }
}

function medianNullable(values: Array<number | null>) {
  return median(values.filter((value): value is number => value !== null))
}

function medianStatistics(values: SampleStatistics[]): SampleStatistics {
  return {
    count: Math.round(median(values.map(value => value.count)) ?? 0),
    p50: medianNullable(values.map(value => value.p50)),
    p95: medianNullable(values.map(value => value.p95)),
    p99: medianNullable(values.map(value => value.p99)),
  }
}

function medianMemoryPoint(
  values: Array<BenchmarkMemoryPoint | null>,
): BenchmarkMemoryPoint | null {
  const points = values.filter((value): value is BenchmarkMemoryPoint => value !== null)
  if (!points.length)
    return null
  return {
    canvasCount: Math.round(median(points.map(value => value.canvasCount)) ?? 0),
    heapUsedBytes: median(points.map(value => value.heapUsedBytes)) ?? 0,
  }
}

function medianScriptBytes(values: BenchmarkScriptBytes[]): BenchmarkScriptBytes | undefined {
  if (!values.length)
    return undefined
  return {
    adapter: median(values.map(value => value.adapter)) ?? 0,
    common: median(values.map(value => value.common)) ?? 0,
    core: median(values.map(value => value.core)) ?? 0,
    total: median(values.map(value => value.total)) ?? 0,
  }
}

function medianPhases(values: Array<Record<string, SampleStatistics>>) {
  const phases = new Set(values.flatMap(value => Object.keys(value)))
  return Object.fromEntries([...phases].map(phase => [
    phase,
    medianStatistics(values.flatMap(value => value[phase] ? [value[phase]] : [])),
  ]))
}

export function summarizeRepetitions(runs: BenchmarkMeasurement[]) {
  const groups = new Map<string, BenchmarkMeasurement[]>()
  for (const run of runs) {
    const key = JSON.stringify(run.condition)
    const group = groups.get(key) ?? []
    group.push(run)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) => {
    const first = group[0]
    const gpu = group
      .map(value => value.gpuDraw)
      .filter((value): value is SampleStatistics => value !== null)
    const resources = Object.keys(first.lifecycle) as Array<keyof typeof first.lifecycle>
    return {
      ...first,
      firstDrawMs: medianNullable(group.map(value => value.firstDrawMs)),
      frame: medianPhases(group.map(value => value.frame)),
      gpuDraw: gpu.length ? medianStatistics(gpu) : null,
      lifecycle: Object.fromEntries(resources.map(resource => [
        resource,
        Math.round(median(group.map(value => value.lifecycle[resource])) ?? 0),
      ])) as BenchmarkMeasurement['lifecycle'],
      load: medianPhases(group.map(value => value.load)),
      longFrameRatio: medianNullable(group.map(value => value.longFrameRatio)),
      memory: group.some(value => value.memory)
        ? {
            active: medianMemoryPoint(group.map(value => value.memory?.active ?? null)),
            activeHeapDeltaBytes: medianNullable(
              group.map(value => value.memory?.activeHeapDeltaBytes ?? null),
            ),
            baseline: medianMemoryPoint(group.map(value => value.memory?.baseline ?? null)),
            cycles: Math.round(median(group.flatMap(value => (
              value.memory ? [value.memory.cycles] : []
            ))) ?? 0),
            released: medianMemoryPoint(group.flatMap(value => (
              value.memory ? [value.memory.released] : []
            ))) ?? { canvasCount: 0, heapUsedBytes: 0 },
            retainedHeapDeltaBytes: medianNullable(
              group.map(value => value.memory?.retainedHeapDeltaBytes ?? null),
            ),
            scripts: medianScriptBytes(group.flatMap(value => (
              value.memory?.scripts ? [value.memory.scripts] : []
            ))),
          }
        : undefined,
      readyMs: medianNullable(group.map(value => value.readyMs)),
      repetition: group.length,
    }
  })
}

function assertCommonBenchmarkResult(value: unknown) {
  const result = value as Partial<BenchmarkResult> | null
  if (
    !result
    || typeof result.capturedAt !== 'string'
    || typeof result.gitCommit !== 'string'
    || !Array.isArray(result.runs)
    || ![
      'backends',
      'backend-memory',
      'hardware-backends',
      'hardware-matrix',
      'hardware-smoke',
      'matrix',
      'memory',
      'smoke',
      'startup',
    ].includes(result.suite ?? '')
  ) {
    throw new Error('Invalid benchmark result schema.')
  }
  return result
}

export function normalizeBenchmarkResult(value: unknown): BenchmarkResult {
  const result = assertCommonBenchmarkResult(value)
  const runs = result.runs as BenchmarkMeasurement[]
  if (result.schemaVersion === BENCHMARK_SCHEMA_VERSION)
    return result as BenchmarkResult
  if (result.schemaVersion !== LEGACY_BENCHMARK_SCHEMA_VERSION)
    throw new Error('Invalid benchmark result schema.')

  return {
    ...(result as Omit<BenchmarkResult, 'runs' | 'schemaVersion'>),
    runs: runs.map((run) => {
      const legacy = run as BenchmarkMeasurement & {
        memory?: { heapUsedBytes: number }
      }
      if (!legacy.memory || !('heapUsedBytes' in legacy.memory))
        return legacy
      return {
        ...legacy,
        memory: {
          active: null,
          activeHeapDeltaBytes: null,
          baseline: null,
          cycles: 1,
          released: {
            canvasCount: legacy.lifecycle.canvas,
            heapUsedBytes: legacy.memory.heapUsedBytes,
          },
          retainedHeapDeltaBytes: null,
        },
      }
    }),
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
  }
}

export function assertBenchmarkResult(value: unknown): void {
  normalizeBenchmarkResult(value)
}
