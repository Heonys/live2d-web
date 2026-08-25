/**
 * Backend-neutral contracts. Keep renderer-specific concepts out of this file.
 */

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface ModelTransform extends Point {
  scale: number
}

export interface StageOptions extends Size {
  /** Concrete backing-buffer multiplier selected by the React host. */
  resolution?: number
  maxFps?: number
}

export interface StageHandle {
  resize: (width: number, height: number) => void
  getSize: () => Size
  getResolution: () => number
  setResolution: (resolution: number) => void
  /** Client coordinates to the backend's stage coordinate system. */
  toWorld: (clientX: number, clientY: number) => Point
  pause: () => void
  resume: () => void
  /**
   * Runs after model updates and parameter drivers, but before rendering.
   * This is for engine work and metrics, never React state updates.
   */
  onFrame: (callback: (deltaMs: number) => void) => () => void
  onError: (callback: (error: import('./errors').Live2DError) => void) => () => void
  dispose: () => void
}

export interface ModelHandle {
  getIntrinsicSize: () => Size
  setTransform: (transform: ModelTransform) => void
  getParameter: (id: string) => number
  /** Persists as a per-frame override until clearParameter() removes it. */
  setParameter: (id: string, value: number) => void
  clearParameter: (id: string) => void
  /** Stage-local coordinates, same space as toWorld() output. */
  focus: (x: number, y: number) => void
  /** Hit-area names containing the stage-local point, in declaration order. */
  hitTest: (x: number, y: number) => string[]
  getModelInfo: () => ModelInfo
  /**
   * Resolves when playback finishes (including interruption), not when it
   * starts. Resolves on dispose, and rejects if the stage reports a render
   * error, because the frame loop never restarts after one.
   */
  motion: (group: string, index?: number, options?: MotionOptions) => Promise<void>
  /** Optional detailed playback capability for new runtime APIs. */
  playMotion?: (
    group: string,
    index?: number,
    options?: MotionOptions,
  ) => Promise<MotionPlaybackResult>
  isMotionPlaying: () => boolean
  expression: (id?: string, options?: ExpressionOptions) => Promise<void>
  clearExpression: () => void
  /**
   * Runs after the SDK motion manager has written its values, before render.
   * The returned unsubscribe function must be idempotent.
   */
  onAfterMotionUpdate: (callback: (deltaMs: number) => void) => () => void
  /**
   * Runs after the SDK effects but before physics, so a value written here
   * drives the physics simulation instead of arriving too late for it. Head
   * pose needs this; a mouth value does not. Optional for backends that do not
   * own their frame loop, which fall back to onAfterMotionUpdate.
   */
  onBeforePhysicsUpdate?: (callback: (deltaMs: number) => void) => () => void
  dispose: () => void
}

export type MotionPriority = 'force' | 'idle' | 'normal'

export interface MotionOptions {
  /** Playback priority. 'force' interrupts anything (default). */
  priority?: MotionPriority
  /** Overrides the motion-wide fade-in duration in milliseconds. */
  fadeInMs?: number
  /** Overrides natural and interruption fade-out in milliseconds. */
  fadeOutMs?: number
}

export interface ExpressionOptions {
  /** Overrides the expression fade-in duration in milliseconds. */
  fadeInMs?: number
  /** Overrides replacement fade-out duration in milliseconds. */
  fadeOutMs?: number
}

export type MotionPlaybackStatus = 'completed' | 'interrupted' | 'skipped' | 'disposed'

export interface MotionPlaybackResult {
  status: MotionPlaybackStatus
}

export interface MotionSequenceStep {
  group: string
  index?: number
  options?: MotionOptions
}

export type MotionSequenceResult
  = | { status: 'completed', completedSteps: number }
    | {
      status: Exclude<MotionPlaybackStatus, 'completed'>
      completedSteps: number
      stepIndex: number
    }

/** Range metadata for one parameter in the loaded Cubism model. */
export interface ModelParameterInfo {
  id: string
  minimum: number
  maximum: number
  defaultValue: number
}

/** Version-neutral model metadata extracted from the model settings file. */
export interface ModelInfo {
  expressions: string[]
  hitAreas: string[]
  /** Motion group name to motion count within that group. */
  motions: Record<string, number>
  /** Optional for compatibility with third-party backends written before v0.5. */
  parameters?: ModelParameterInfo[]
}

/**
 * Supplies a model's files from somewhere other than the network: an unpacked
 * archive held in memory, a browser storage layer, or any custom source.
 *
 * `path` is relative to the model3.json given as `src`, exactly as the model
 * declares it, already decoded (so non-ASCII filenames arrive readable).
 * Return `undefined` when the source has no such file; loading then fails with
 * `model-load-failed` naming that path.
 */
export type Live2DAssetResolver = (
  path: string,
  signal?: AbortSignal,
) => Promise<Blob | ArrayBuffer | undefined> | Blob | ArrayBuffer | undefined

export interface IdleMotionOptions {
  group: string
  weights: readonly number[]
}

export type IdleMotion = string | false | IdleMotionOptions

export interface LoadModelOptions {
  /** Idle group, weighted group selection, or false to disable automatic idle playback. */
  idleMotion?: IdleMotion
  /**
   * Loads the model's files instead of fetching them. With a resolver, `src`
   * is a path inside the source rather than a URL.
   */
  resolveAsset?: Live2DAssetResolver
  signal?: AbortSignal
}

export interface Live2DBackend {
  createStage: (element: HTMLElement, options: StageOptions) => StageHandle
  loadModel: (
    stage: StageHandle,
    url: string,
    options?: LoadModelOptions,
  ) => Promise<ModelHandle>
}
