'use client'

// Root entry: React + renderer-neutral core only. PIXI stays in its subpath.
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
export type { Live2DErrorCode } from './core/errors'
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
export {
  useLive2DModel,
  useLive2DParameter,
  useParameterDriver,
  useStage,
} from './react/hooks'
export { Live2DModel } from './react/Live2DModel'
export type { Live2DModelProps } from './react/Live2DModel'
export { Live2DStage } from './react/Live2DStage'
export type { Live2DStageProps, StageQualityProps } from './react/Live2DStage'
export type { LoadingStage, StageState } from './react/store'
