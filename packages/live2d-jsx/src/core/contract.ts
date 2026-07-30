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
  setParameter: (id: string, value: number) => void
  focus: (x: number, y: number) => void
  motion: (group: string, index?: number) => Promise<void>
  expression: (id?: string) => Promise<void>
  /**
   * Runs after the SDK motion manager has written its values, before render.
   * The returned unsubscribe function must be idempotent.
   */
  onAfterMotionUpdate: (callback: (deltaMs: number) => void) => () => void
  dispose: () => void
}

export interface LoadModelOptions {
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
