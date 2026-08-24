import type { ModelInfo } from '../../core/contract'
import type { ParameterDriver } from '../../core/runtime'

export type MediaPipeModelAsset
  = | { modelAssetPath: string, modelAssetBuffer?: never }
    | { modelAssetBuffer: Uint8Array, modelAssetPath?: never }

export interface CreateMediaPipeFaceTrackerBaseOptions {
  wasmPath: string
  delegate?: 'CPU' | 'GPU'
  maxFps?: number
  /** True only when the pixels passed to update(), rather than CSS preview, are mirrored. */
  inputMirrored?: boolean
  signal?: AbortSignal
}

export type CreateMediaPipeFaceTrackerOptions
  = CreateMediaPipeFaceTrackerBaseOptions & MediaPipeModelAsset

export type MediaPipeFaceChannel = 'pose' | 'eyes' | 'brows' | 'mouth' | 'cheeks'
export type MediaPipeMappingMode = 'auto' | 'standard' | 'perfect-sync'

export interface MediaPipeAttachOptions {
  mapping?: MediaPipeMappingMode
  channels?: Partial<Record<MediaPipeFaceChannel, boolean>>
}

export interface MediaPipeParameterTarget {
  getModelInfo: () => ModelInfo
  addParameterDriver: (id: string, driver: ParameterDriver) => () => void
}

export type MediaPipeFaceTrackingUpdate
  = | { status: 'skipped' }
    | {
      status: 'calibrating' | 'tracked' | 'lost'
      inferenceMs: number
    }

export interface MediaPipeFaceTracker {
  update: (source: TexImageSource, timestampMs: number) => MediaPipeFaceTrackingUpdate
  attach: (
    target: MediaPipeParameterTarget,
    options?: MediaPipeAttachOptions,
  ) => () => void
  calibrate: () => void
  isTracking: () => boolean
  dispose: () => void
}
