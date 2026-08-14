export interface BackendMemoryPageSnapshot {
  canvasCount: number
  readyMs: number | null
}

export interface BackendMemoryPageController {
  dispose: () => BackendMemoryPageSnapshot
  mount: () => Promise<BackendMemoryPageSnapshot>
  snapshot: () => BackendMemoryPageSnapshot
}

declare global {
  interface Window {
    __live2dBackendMemory?: BackendMemoryPageController
  }
}
