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
  /** 0..1, default 0.4. MediaPipe's own default of 0.5 drops a head turn early. */
  minFaceDetectionConfidence?: number
  /** 0..1, default 0.4. */
  minFacePresenceConfidence?: number
  /**
   * 0..1, default 0.3. Lowest of the three: keeping a face already found is
   * what carries a profile turn, and losing it snaps the head back.
   */
  minTrackingConfidence?: number
  /** What the head does while the face is lost. Default 'hold'. */
  onFaceLost?: MediaPipeFaceLostBehaviour
  signal?: AbortSignal
}

export type CreateMediaPipeFaceTrackerOptions
  = CreateMediaPipeFaceTrackerBaseOptions & MediaPipeModelAsset

export type MediaPipeFaceChannel = 'pose' | 'eyes' | 'brows' | 'mouth' | 'cheeks'
export type MediaPipeMappingMode = 'auto' | 'standard' | 'perfect-sync'
export type MediaPipeFaceLostBehaviour = 'hold' | 'neutral'

export interface MediaPipeAttachOptions {
  mapping?: MediaPipeMappingMode
  channels?: Partial<Record<MediaPipeFaceChannel, boolean>>
  /**
   * Per-channel multiplier applied before the model's parameter range, 0.1
   * through 5, default 1. MediaPipe reports head rotation conservatively, so
   * pose usually needs more than 1 to feel like the wearer's own movement.
   */
  sensitivity?: Partial<Record<MediaPipeFaceChannel, number>>
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
      /** Current inference cap. Falls below `maxFps` while inference is too slow for it. */
      effectiveFps: number
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
