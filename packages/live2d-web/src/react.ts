'use client'

export type {
  Live2DBackend,
  LoadModelOptions,
  ModelHandle,
  ModelTransform,
  Point,
  Size,
  StageHandle,
  StageOptions,
} from './core/contract'
export { ensureCubismCore } from './core/ensureCubismCore'
export { Live2DError } from './core/errors'
export type {
  Live2DAssetType,
  Live2DErrorCode,
  Live2DErrorDetails,
  Live2DErrorOptions,
} from './core/errors'
export { fitModel } from './core/fit'
export type { ModelFit } from './core/fit'
export {
  DEFAULT_AUTO_QUALITY_POLICY,
  isMobileViewport,
  resolveAutoQualityPolicy,
  selectInitialResolution,
  selectLowerResolution,
} from './core/quality'
export type {
  AutoQualityPolicy,
  QualityInput,
  ResolvedAutoQualityPolicy,
} from './core/quality'
export type { LipSyncProfile } from './features/lipsync/source'
export type { Live2DModelController } from './react/controller'
export {
  useLive2DCanvas,
  useLive2DModel,
  useLive2DParameter,
  useParameterDriver,
} from './react/hooks'
export { LipSync } from './react/LipSync'
export type { LipSyncDriver, LipSyncProps } from './react/LipSync'
export { Live2DCanvas } from './react/Live2DCanvas'
export type {
  Live2DCanvasProps,
  Live2DCanvasQualityProps,
} from './react/Live2DCanvas'
export { Live2DModel } from './react/Live2DModel'
export type { Live2DModelProps } from './react/Live2DModel'
export type { Live2DCanvasState, LoadingStage } from './react/store'
