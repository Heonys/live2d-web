'use client'

export type {
  ExpressionOptions,
  IdleMotion,
  IdleMotionOptions,
  Live2DAssetResolver,
  Live2DBackend,
  LoadModelOptions,
  ModelHandle,
  ModelInfo,
  ModelParameterInfo,
  ModelTransform,
  MotionOptions,
  MotionPlaybackResult,
  MotionPlaybackStatus,
  MotionPriority,
  MotionSequenceResult,
  MotionSequenceStep,
  Point,
  Size,
  StageHandle,
  StageOptions,
} from './core/contract'
export { ensureCubismCore, OFFICIAL_CUBISM_CORE_URL } from './core/ensureCubismCore'
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
// The React surface names these in its own signatures (useLive2D, the model
// controller), so a /react-only consumer has to be able to name them too.
export type {
  CreateLive2DOptions,
  LipSyncDriver,
  Live2DInstance,
  Live2DRuntimeState,
  ParameterDriver,
  RuntimeLoadingStage,
  RuntimeRenderState,
} from './core/runtime'
export type {
  LipSyncProfile,
  LipSyncProfileInput,
} from './features/lipsync/source'
export type { Live2DModelController } from './react/controller'
export {
  useLive2D,
  useLive2DCanvas,
  useLive2DModel,
  useLive2DParameter,
  useParameterDriver,
} from './react/hooks'
export type { UseLive2DOptions, UseLive2DResult } from './react/hooks'
export { LipSync } from './react/LipSync'
export type { LipSyncProps } from './react/LipSync'
export { Live2DCanvas } from './react/Live2DCanvas'
export type {
  Live2DCanvasProps,
  Live2DCanvasQualityProps,
} from './react/Live2DCanvas'
export { Live2DModel } from './react/Live2DModel'
export type { Live2DModelProps } from './react/Live2DModel'
export type { Live2DCanvasState, LoadingStage } from './react/store'
