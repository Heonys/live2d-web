import type {
  BenchmarkDiagnosticsSnapshot,
  BenchmarkStageSnapshot,
} from '../../packages/live2d-web/test/benchmark/collector'
import type { SampleStatistics } from './metrics'
import { median, summarize } from './metrics'

export const BENCHMARK_SCHEMA_VERSION = 1 as const

export interface BenchmarkEnvironment {
  browser: string
  cpu: string
  memoryBytes: number
  os: string
  webglRenderer: string
}

export interface BenchmarkCondition {
  cache?: 'cold' | 'warm'
  model: string
  resolution: number
  stageCount: number
}

export interface BenchmarkMeasurement {
  condition: BenchmarkCondition
  firstDrawMs: number | null
  frame: Record<string, SampleStatistics>
  gpuDraw: SampleStatistics | null
  gpuTimerSupported: boolean
  lifecycle: BenchmarkDiagnosticsSnapshot['resources']
  load: Record<string, SampleStatistics>
  longFrameRatio: number | null
  memory?: {
    heapUsedBytes: number
  }
  readyMs: number | null
  repetition: number
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
  suite: 'matrix' | 'memory' | 'smoke' | 'startup'
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
            heapUsedBytes: median(
              group.flatMap(value => value.memory ? [value.memory.heapUsedBytes] : []),
            ) ?? 0,
          }
        : undefined,
      readyMs: medianNullable(group.map(value => value.readyMs)),
      repetition: group.length,
    }
  })
}

export function assertBenchmarkResult(value: unknown): asserts value is BenchmarkResult {
  const result = value as Partial<BenchmarkResult> | null
  if (
    !result
    || result.schemaVersion !== BENCHMARK_SCHEMA_VERSION
    || typeof result.capturedAt !== 'string'
    || typeof result.gitCommit !== 'string'
    || !Array.isArray(result.runs)
    || !['matrix', 'memory', 'smoke', 'startup'].includes(result.suite ?? '')
  ) {
    throw new Error('Invalid benchmark result schema.')
  }
}
