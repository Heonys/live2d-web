import type { BenchmarkDiagnosticsSnapshot } from '@live2d-web/benchmark/collector'
import type {
  BenchmarkModel,
  BenchmarkModelManifest,
} from '@live2d-web/benchmark/manifest'
import type { Live2DInstance } from 'live2d-web'

export type { BenchmarkModel, BenchmarkModelManifest }
export { parseBenchmarkManifest } from '@live2d-web/benchmark/manifest'

export interface BenchmarkPageSnapshot {
  diagnostics: BenchmarkDiagnosticsSnapshot
  model: BenchmarkModel
  readyMs: number | null
  resolution: number
  stageCount: number
}

export interface BenchmarkPageController {
  dispose: () => BenchmarkPageSnapshot
  exercise: () => Promise<void>
  mount: () => Promise<BenchmarkPageSnapshot>
  resetFrameSamples: () => void
  snapshot: () => BenchmarkPageSnapshot
}

export function disposeInstances(instances: Live2DInstance[]) {
  for (const instance of instances.reverse())
    instance.dispose()
  instances.length = 0
}

declare global {
  interface Window {
    __live2dModelBenchmark?: BenchmarkPageController
  }
}
