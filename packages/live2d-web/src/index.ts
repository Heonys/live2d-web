// Root entry: browser runtime + renderer-neutral contracts only.
// React and renderer adapters stay in explicit subpaths.
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
export { createLive2D } from './core/runtime'
export type {
  CreateLive2DOptions,
  LipSyncDriver,
  Live2DInstance,
  Live2DRuntimeState,
  ParameterDriver,
  RuntimeLipSyncOptions,
  RuntimeLoadingStage,
  RuntimeQualityOptions,
  RuntimeRenderState,
} from './core/runtime'
export {
  MOUTH_HANDOFF_HOLD_MS,
  MOUTH_PARAMETER_ID,
  MOUTH_RELEASE_MS,
} from './features/lipsync/mouthController'
export type {
  LipSyncProfile,
  LipSyncProfileInput,
} from './features/lipsync/source'
export { createVolumeLipSync } from './features/lipsync/volume'
export type { VolumeLipSyncDriver } from './features/lipsync/volume'
