export type LabSource = 'local' | 'release'
export type ScenarioState = 'idle' | 'loading' | 'ready' | 'error' | 'disposed'

export interface FrameMetrics {
  backend: 'live2d-web' | 'pixi-v6'
  canvasCount: number
  firstDrawMs: number | null
  frameCount: number
  longFrameRatio: number | null
  medianFps: number | null
  status: ScenarioState
  error?: string
}

export interface LabSnapshot {
  canvases: number
  consoleErrors: string[]
  errors: string[]
  models: number
  route: string
  scenarios: Record<string, ScenarioState>
  source: LabSource
  status: ScenarioState
  version: string
}

export interface LabBridge {
  clearErrors: () => void
  loseContext: () => boolean
  runLifecycleCycle: (count?: number) => Promise<LabSnapshot>
  snapshot: () => LabSnapshot
}

declare global {
  interface Window {
    __live2dLab?: LabBridge
  }
}
