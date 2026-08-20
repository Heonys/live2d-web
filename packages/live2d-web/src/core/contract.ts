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
  isMotionPlaying: () => boolean
  expression: (id?: string) => Promise<void>
  clearExpression: () => void
  /**
   * Runs after the SDK motion manager has written its values, before render.
   * The returned unsubscribe function must be idempotent.
   */
  onAfterMotionUpdate: (callback: (deltaMs: number) => void) => () => void
  dispose: () => void
}

export type MotionPriority = 'force' | 'idle' | 'normal'

export interface MotionOptions {
  /** Playback priority. 'force' interrupts anything (default). */
  priority?: MotionPriority
}

/** Version-neutral model metadata extracted from the model settings file. */
export interface ModelInfo {
  expressions: string[]
  hitAreas: string[]
  /** Motion group name to motion count within that group. */
  motions: Record<string, number>
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

export interface LoadModelOptions {
  /** Idle motion group name, or false to disable automatic idle playback. */
  idleMotion?: string | false
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
