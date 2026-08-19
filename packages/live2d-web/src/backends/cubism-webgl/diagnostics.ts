export type CubismLoadPhase
  = | 'modelJsonFetch'
    | 'modelJsonParse'
    | 'mocFetch'
    | 'mocParse'
    | 'optionalAssets'
    | 'shaderSetup'
    | 'textureFetch'
    | 'textureDecode'
    | 'textureUpload'
    | 'ready'

export type CubismFramePhase
  = | 'frameDelta'
    | 'motion'
    | 'effectsPhysicsPose'
    | 'manualParameters'
    | 'externalDrivers'
    | 'coreUpdate'
    | 'drawCpu'
    | 'stageFrame'

export type CubismOwnedResource
  = | 'canvas'
    | 'context'
    | 'frameworkReference'
    | 'pendingExpression'
    | 'pendingMotion'
    | 'texture'

export interface CubismBenchmarkStageDiagnostics {
  readonly stageId: string
  changeResource: (resource: CubismOwnedResource, delta: 1 | -1) => void
  firstDraw: () => void
  framePhase: (phase: CubismFramePhase, durationMs: number) => void
  gpuDraw: (durationMs: number | null) => void
  gpuTimerSupport: (supported: boolean) => void
  loadPhase: (phase: CubismLoadPhase, durationMs: number) => void
}

export interface CubismBenchmarkDiagnosticsFactory {
  createStage: () => CubismBenchmarkStageDiagnostics
}

export function measureSync<T>(
  diagnostics: CubismBenchmarkStageDiagnostics | undefined,
  scope: 'frame' | 'load',
  phase: CubismFramePhase | CubismLoadPhase,
  operation: () => T,
): T {
  if (!diagnostics)
    return operation()
  const startedAt = performance.now()
  try {
    return operation()
  }
  finally {
    const durationMs = performance.now() - startedAt
    if (scope === 'frame')
      diagnostics.framePhase(phase as CubismFramePhase, durationMs)
    else
      diagnostics.loadPhase(phase as CubismLoadPhase, durationMs)
  }
}

export async function measureAsync<T>(
  diagnostics: CubismBenchmarkStageDiagnostics | undefined,
  phase: CubismLoadPhase,
  operation: () => Promise<T>,
): Promise<T> {
  if (!diagnostics)
    return operation()
  const startedAt = performance.now()
  try {
    return await operation()
  }
  finally {
    diagnostics.loadPhase(phase, performance.now() - startedAt)
  }
}

interface DisjointTimerQueryExtension {
  GPU_DISJOINT_EXT: number
  TIME_ELAPSED_EXT: number
}

export interface CubismGpuTimer {
  begin: () => void
  dispose: () => void
  end: () => void
  poll: () => void
}

export function createGpuTimer(
  gl: WebGL2RenderingContext,
  diagnostics: CubismBenchmarkStageDiagnostics | undefined,
): CubismGpuTimer | undefined {
  if (!diagnostics)
    return undefined
  const extension = gl.getExtension(
    'EXT_disjoint_timer_query_webgl2',
  ) as DisjointTimerQueryExtension | null
  diagnostics.gpuTimerSupport(Boolean(extension))
  if (!extension) {
    diagnostics.gpuDraw(null)
    return undefined
  }

  let active: WebGLQuery | undefined
  const pending: WebGLQuery[] = []

  const poll = () => {
    while (pending.length > 0) {
      const query = pending[0]
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
        return
      pending.shift()
      const disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT))
      const nanoseconds = disjoint
        ? undefined
        : Number(gl.getQueryParameter(query, gl.QUERY_RESULT))
      diagnostics.gpuDraw(
        nanoseconds === undefined || !Number.isFinite(nanoseconds)
          ? null
          : nanoseconds / 1_000_000,
      )
      gl.deleteQuery(query)
    }
  }

  return {
    begin() {
      poll()
      if (active)
        return
      const query = gl.createQuery()
      if (!query)
        return
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query)
      active = query
    },
    dispose() {
      if (active) {
        gl.endQuery(extension.TIME_ELAPSED_EXT)
        gl.deleteQuery(active)
        active = undefined
      }
      for (const query of pending)
        gl.deleteQuery(query)
      pending.length = 0
    },
    end() {
      if (!active)
        return
      gl.endQuery(extension.TIME_ELAPSED_EXT)
      pending.push(active)
      active = undefined
    },
    poll,
  }
}
