import type {
  CubismBenchmarkDiagnosticsFactory,
  CubismBenchmarkStageDiagnostics,
  CubismFramePhase,
  CubismLoadPhase,
  CubismOwnedResource,
} from '../../src/adapters/cubism-webgl/diagnostics'

export interface BenchmarkStageSnapshot {
  firstDrawMs: number | null
  frame: Record<CubismFramePhase, number[]>
  gpuDrawMs: Array<number | null>
  gpuTimerSupported: boolean | null
  id: string
  load: Record<CubismLoadPhase, number[]>
}

export interface BenchmarkDiagnosticsSnapshot {
  resources: Record<CubismOwnedResource, number>
  stages: BenchmarkStageSnapshot[]
}

const FRAME_PHASES: CubismFramePhase[] = [
  'frameDelta',
  'motion',
  'effectsPhysicsPose',
  'manualParameters',
  'externalDrivers',
  'coreUpdate',
  'drawCpu',
  'stageFrame',
]

const LOAD_PHASES: CubismLoadPhase[] = [
  'modelJsonFetch',
  'modelJsonParse',
  'mocFetch',
  'mocParse',
  'optionalAssets',
  'shaderSetup',
  'textureFetch',
  'textureDecode',
  'textureUpload',
  'ready',
]

const OWNED_RESOURCES: CubismOwnedResource[] = [
  'canvas',
  'context',
  'frameworkReference',
  'pendingExpression',
  'pendingMotion',
  'texture',
]

function emptySamples<T extends string>(keys: readonly T[]): Record<T, number[]> {
  return Object.fromEntries(keys.map(key => [key, []])) as unknown as Record<
    T,
    number[]
  >
}

function emptyResources(): Record<CubismOwnedResource, number> {
  return Object.fromEntries(OWNED_RESOURCES.map(key => [key, 0])) as Record<
    CubismOwnedResource,
    number
  >
}

interface MutableStage {
  firstDrawMs: number | null
  frame: Record<CubismFramePhase, number[]>
  gpuDrawMs: Array<number | null>
  gpuTimerSupported: boolean | null
  id: string
  load: Record<CubismLoadPhase, number[]>
}

export class BenchmarkDiagnostics implements CubismBenchmarkDiagnosticsFactory {
  private readonly origin = performance.now()
  private readonly resources = emptyResources()
  private readonly stages: MutableStage[] = []

  createStage(): CubismBenchmarkStageDiagnostics {
    const stage: MutableStage = {
      firstDrawMs: null,
      frame: emptySamples(FRAME_PHASES),
      gpuDrawMs: [],
      gpuTimerSupported: null,
      id: `stage-${this.stages.length + 1}`,
      load: emptySamples(LOAD_PHASES),
    }
    this.stages.push(stage)

    return {
      changeResource: (resource, delta) => {
        const next = this.resources[resource] + delta
        if (next < 0)
          throw new Error(`Benchmark resource counter became negative: ${resource}`)
        this.resources[resource] = next
      },
      firstDraw: () => {
        stage.firstDrawMs ??= performance.now() - this.origin
      },
      framePhase: (phase, durationMs) => stage.frame[phase].push(durationMs),
      gpuDraw: durationMs => stage.gpuDrawMs.push(durationMs),
      gpuTimerSupport: supported => stage.gpuTimerSupported = supported,
      loadPhase: (phase, durationMs) => stage.load[phase].push(durationMs),
      stageId: stage.id,
    }
  }

  resetFrameSamples() {
    for (const stage of this.stages) {
      stage.frame = emptySamples(FRAME_PHASES)
      stage.gpuDrawMs = []
    }
  }

  snapshot(): BenchmarkDiagnosticsSnapshot {
    return {
      resources: { ...this.resources },
      stages: this.stages.map(stage => ({
        firstDrawMs: stage.firstDrawMs,
        frame: Object.fromEntries(
          FRAME_PHASES.map(phase => [phase, [...stage.frame[phase]]]),
        ) as Record<CubismFramePhase, number[]>,
        gpuDrawMs: [...stage.gpuDrawMs],
        gpuTimerSupported: stage.gpuTimerSupported,
        id: stage.id,
        load: Object.fromEntries(
          LOAD_PHASES.map(phase => [phase, [...stage.load[phase]]]),
        ) as Record<CubismLoadPhase, number[]>,
      })),
    }
  }

  async waitForFirstDraw(expectedStages: number, timeoutMs = 30_000) {
    const startedAt = performance.now()
    while (
      this.stages.length < expectedStages
      || this.stages.some(stage => stage.firstDrawMs === null)
    ) {
      if (performance.now() - startedAt >= timeoutMs)
        throw new Error(`Timed out waiting for ${expectedStages} Live2D first draws.`)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
  }
}
