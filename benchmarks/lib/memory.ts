import type { BenchmarkMeasurement } from './schema'
import { summarizeRepetitions } from './schema'

export interface BackendMemoryComparison {
  cubismWebglBytes: number | null
  lowerByAtLeastTenPercent: boolean
  pixiV6Bytes: number | null
  ratio: number | null
  stageCount: number
}

export function evaluateBackendMemory(runs: BenchmarkMeasurement[]) {
  const summaries = summarizeRepetitions(runs)
  const comparisons: BackendMemoryComparison[] = [1, 4].map((stageCount) => {
    const cubism = summaries.find(run => (
      run.condition.backend === 'cubism-webgl'
      && run.condition.stageCount === stageCount
    ))?.memory?.activeHeapDeltaBytes ?? null
    const pixi = summaries.find(run => (
      run.condition.backend === 'pixi-v6'
      && run.condition.stageCount === stageCount
    ))?.memory?.activeHeapDeltaBytes ?? null
    const ratio = cubism !== null && pixi !== null && cubism > 0 && pixi > 0
      ? cubism / pixi
      : null
    return {
      cubismWebglBytes: cubism,
      lowerByAtLeastTenPercent: ratio !== null && ratio <= 0.9,
      pixiV6Bytes: pixi,
      ratio,
      stageCount,
    }
  })
  return {
    comparisons,
    conclusion: comparisons.every(value => value.lowerByAtLeastTenPercent)
      ? 'lower' as const
      : 'inconclusive' as const,
  }
}
