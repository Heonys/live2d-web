// Type-only fixture: naming every public type through its own entry point makes
// `pnpm typecheck` fail when an export that a published signature references is
// missing. It is never imported at runtime and never published.

import type {
  AutoQualityPolicy,
  CreateLive2DOptions,
  LipSyncDriver,
  LipSyncProfile,
  LipSyncProfileInput,
  Live2DAssetResolver,
  Live2DAssetType,
  Live2DBackend,
  Live2DErrorCode,
  Live2DInstance,
  Live2DRuntimeState,
  LoadModelOptions,
  ModelFit,
  ModelHandle,
  ModelInfo,
  ModelTransform,
  MotionOptions,
  MotionPlaybackResult,
  MotionPlaybackStatus,
  MotionPriority,
  MotionSequenceResult,
  MotionSequenceStep,
  ParameterDriver,
  Point,
  RuntimeLipSyncOptions,
  RuntimeRenderState,
  Size,
  StageHandle,
  StageOptions,
} from '../src/index'
import type {
  LipSyncProps,
  Live2DCanvasProps,
  Live2DCanvasState,
  Live2DModelController,
  Live2DModelProps,
  CreateLive2DOptions as ReactCreateLive2DOptions,
  LipSyncDriver as ReactLipSyncDriver,
  LipSyncProfileInput as ReactLipSyncProfileInput,
  Live2DInstance as ReactLive2DInstance,
  Live2DRuntimeState as ReactLive2DRuntimeState,
  ModelInfo as ReactModelInfo,
  MotionOptions as ReactMotionOptions,
  MotionPlaybackResult as ReactMotionPlaybackResult,
  MotionPlaybackStatus as ReactMotionPlaybackStatus,
  MotionPriority as ReactMotionPriority,
  MotionSequenceResult as ReactMotionSequenceResult,
  MotionSequenceStep as ReactMotionSequenceStep,
  UseLive2DOptions,
  UseLive2DResult,
} from '../src/react'

export interface RootSurface {
  assetResolver: Live2DAssetResolver
  backend: Live2DBackend
  createOptions: CreateLive2DOptions
  errorCode: Live2DErrorCode
  assetType: Live2DAssetType
  fit: ModelFit
  instance: Live2DInstance
  lipSyncDriver: LipSyncDriver
  lipSyncOptions: RuntimeLipSyncOptions
  loadModelOptions: LoadModelOptions
  model: ModelHandle
  modelInfo: ModelInfo
  motionOptions: MotionOptions
  motionResult: MotionPlaybackResult
  motionStatus: MotionPlaybackStatus
  motionPriority: MotionPriority
  motionSequenceResult: MotionSequenceResult
  motionSequenceStep: MotionSequenceStep
  parameterDriver: ParameterDriver
  point: Point
  profile: LipSyncProfile
  profileInput: LipSyncProfileInput
  quality: AutoQualityPolicy
  renderState: RuntimeRenderState
  runtimeState: Live2DRuntimeState
  size: Size
  stage: StageHandle
  stageOptions: StageOptions
  transform: ModelTransform
}

export const motionFadeFixture = {
  fadeInMs: 250,
  fadeOutMs: 400,
  priority: 'normal',
} satisfies MotionOptions

// Everything the /react signatures mention has to be nameable from /react too.
export interface ReactSurface {
  canvasProps: Live2DCanvasProps
  canvasState: Live2DCanvasState
  controller: Live2DModelController
  createOptions: ReactCreateLive2DOptions
  instance: ReactLive2DInstance
  lipSyncDriver: ReactLipSyncDriver
  lipSyncProps: LipSyncProps
  modelInfo: ReactModelInfo
  modelProps: Live2DModelProps
  motionOptions: ReactMotionOptions
  motionResult: ReactMotionPlaybackResult
  motionStatus: ReactMotionPlaybackStatus
  motionPriority: ReactMotionPriority
  motionSequenceResult: ReactMotionSequenceResult
  motionSequenceStep: ReactMotionSequenceStep
  profileInput: ReactLipSyncProfileInput
  runtimeState: ReactLive2DRuntimeState
  useOptions: UseLive2DOptions
  useResult: UseLive2DResult
}

// The controller's own return types must be nameable, not just inferable.
export type ControllerModelInfo = ReturnType<Live2DModelController['getModelInfo']>
export type ControllerInfoIsModelInfo = ControllerModelInfo extends ReactModelInfo
  ? true
  : never
