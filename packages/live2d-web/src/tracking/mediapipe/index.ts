import type {
  FaceLandmarker,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { FaceTrackingSignals } from './state'
import type {
  CreateMediaPipeFaceTrackerOptions,
  MediaPipeAttachOptions,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
  MediaPipeModelAsset,
  MediaPipeParameterTarget,
} from './types'
import { Live2DError } from '../../core/errors'
import { MEDIAPIPE_BLENDSHAPES } from './blendshapes'
import { createParameterBindings } from './mapping'
import { FaceTrackingState, poseFromMatrix } from './state'

export {
  MEDIAPIPE_BLENDSHAPES,
  PERFECT_SYNC_PARAMETER_IDS,
} from './blendshapes'
export type {
  CreateMediaPipeFaceTrackerBaseOptions,
  CreateMediaPipeFaceTrackerOptions,
  MediaPipeAttachOptions,
  MediaPipeFaceChannel,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
  MediaPipeMappingMode,
  MediaPipeModelAsset,
  MediaPipeParameterTarget,
} from './types'

type VisionModule = typeof import('@mediapipe/tasks-vision')
type VisionFileset = Awaited<ReturnType<VisionModule['FilesetResolver']['forVisionTasks']>>

interface AttachedTarget {
  cleanups: Array<() => void>
  target: MediaPipeParameterTarget
}

const CHANNELS = ['pose', 'eyes', 'brows', 'mouth', 'cheeks'] as const

// Synchronous inference shares the render thread. A fixed cap either starves
// fast engines (Chromium infers in ~13ms) or stalls slow ones (headless Firefox
// measured ~200ms), so the cap follows measured inference time instead.
const DEFAULT_MAX_FPS = 30
// MediaPipe defaults all three to 0.5, which drops the face partway into an
// ordinary head turn and snaps the model back to neutral. Tracking is lowest
// because holding a face already found is what carries a profile turn.
const DEFAULT_DETECTION_CONFIDENCE = 0.4
const DEFAULT_PRESENCE_CONFIDENCE = 0.4
const DEFAULT_TRACKING_CONFIDENCE = 0.3
const MIN_ADAPTIVE_FPS = 10
const INFERENCE_EMA_WEIGHT = 0.2
const SLOW_DOWN_LOAD = 0.6
const SPEED_UP_LOAD = 0.25

function runCleanups(cleanups: Array<() => void>) {
  let firstError: unknown
  for (const cleanup of cleanups) {
    try {
      cleanup()
    }
    catch (error) {
      firstError ??= error
    }
  }
  if (firstError)
    throw firstError
}

let modulePromise: Promise<VisionModule> | undefined
const filesetPromises = new Map<string, Promise<VisionFileset>>()

function loadVisionModule() {
  if (!modulePromise) {
    modulePromise = import('@mediapipe/tasks-vision').catch((error) => {
      modulePromise = undefined
      throw new Live2DError(
        'tracking-error',
        'MediaPipe tracking requires the optional @mediapipe/tasks-vision dependency.',
        { cause: error, details: { backend: 'mediapipe' } },
      )
    })
  }
  return modulePromise
}

function loadFileset(module: VisionModule, wasmPath: string) {
  const cached = filesetPromises.get(wasmPath)
  if (cached)
    return cached
  const promise = module.FilesetResolver.forVisionTasks(wasmPath).catch((error) => {
    filesetPromises.delete(wasmPath)
    throw error
  })
  filesetPromises.set(wasmPath, promise)
  return promise
}

function isAbort(error: unknown, signal?: AbortSignal) {
  return Boolean(signal?.aborted) || (error instanceof Error && error.name === 'AbortError')
}

function abortError(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('MediaPipe tracker creation was aborted.', 'AbortError')
}

async function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal)
    return promise
  if (signal.aborted)
    throw abortError(signal)
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

function confidence(name: string, value: number | undefined) {
  if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 1))
    throw new Live2DError('invalid-props', `${name} must be a finite number between 0 and 1.`)
}

function validateOptions(options: CreateMediaPipeFaceTrackerOptions): MediaPipeModelAsset {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Live2DError(
      'browser-only',
      'MediaPipe face tracking can only be created in a browser.',
    )
  }
  if (!options || typeof options !== 'object')
    throw new Live2DError('invalid-props', 'MediaPipe tracker options are required.')
  if (typeof options.wasmPath !== 'string' || options.wasmPath.trim() === '')
    throw new Live2DError('invalid-props', 'wasmPath must be a non-empty string.')
  const hasPath = typeof options.modelAssetPath === 'string'
    && options.modelAssetPath.trim() !== ''
  const hasBuffer = options.modelAssetBuffer instanceof Uint8Array
    && options.modelAssetBuffer.byteLength > 0
  if (hasPath === hasBuffer) {
    throw new Live2DError(
      'invalid-props',
      'Provide exactly one non-empty modelAssetPath or modelAssetBuffer.',
    )
  }
  if (options.delegate !== undefined && options.delegate !== 'CPU' && options.delegate !== 'GPU')
    throw new Live2DError('invalid-props', 'delegate must be CPU or GPU.')
  if (
    options.maxFps !== undefined
    && (!Number.isFinite(options.maxFps) || options.maxFps < 1 || options.maxFps > 60)
  ) {
    throw new Live2DError(
      'invalid-props',
      'maxFps must be a finite number from 1 through 60.',
    )
  }
  if (options.inputMirrored !== undefined && typeof options.inputMirrored !== 'boolean')
    throw new Live2DError('invalid-props', 'inputMirrored must be a boolean.')
  confidence('minFaceDetectionConfidence', options.minFaceDetectionConfidence)
  confidence('minFacePresenceConfidence', options.minFacePresenceConfidence)
  confidence('minTrackingConfidence', options.minTrackingConfidence)
  if (
    options.onFaceLost !== undefined
    && options.onFaceLost !== 'hold'
    && options.onFaceLost !== 'neutral'
  ) {
    throw new Live2DError('invalid-props', 'onFaceLost must be hold or neutral.')
  }
  return hasPath
    ? { modelAssetPath: options.modelAssetPath! }
    : { modelAssetBuffer: options.modelAssetBuffer! }
}

function normalizeScore(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function swapLeftRight(name: string) {
  if (name.endsWith('Left'))
    return `${name.slice(0, -4)}Right`
  if (name.endsWith('Right'))
    return `${name.slice(0, -5)}Left`
  return name
}

function inputFromResult(result: FaceLandmarkerResult, mirrored: boolean) {
  if (!result.faceLandmarks.length)
    return undefined
  const categories = result.faceBlendshapes[0]?.categories ?? []
  const matrix = result.facialTransformationMatrixes[0]?.data
  if (categories.length === 0 || !matrix || matrix.length < 16)
    return undefined
  const scores = new Map<string, number>()
  for (const category of categories) {
    const name = mirrored ? swapLeftRight(category.categoryName) : category.categoryName
    scores.set(name, normalizeScore(category.score))
  }
  for (const name of MEDIAPIPE_BLENDSHAPES) {
    if (!scores.has(name))
      scores.set(name, 0)
  }
  const pose = poseFromMatrix(matrix)
  return {
    blendshapes: scores,
    matrix,
    pose: mirrored ? { x: -pose.x, y: pose.y, z: -pose.z } : pose,
  }
}

function trackingError(error: unknown, message: string, url?: string) {
  if (error instanceof Live2DError)
    return error
  return new Live2DError(
    'tracking-error',
    error instanceof Error ? `${message}: ${error.message}` : `${message}: ${String(error)}`,
    { cause: error, details: { backend: 'mediapipe', url } },
  )
}

class MediaPipeFaceTrackerImpl implements MediaPipeFaceTracker {
  private abortCleanup: (() => void) | undefined
  private attached = new Set<AttachedTarget>()
  private attachedByTarget = new WeakMap<MediaPipeParameterTarget, AttachedTarget>()
  private disposed = false
  private inferenceEmaMs: number | undefined
  private lastInferenceTimestamp: number | undefined
  private maxFps: number
  private signals: FaceTrackingSignals | undefined
  private state: FaceTrackingState
  private tracking = false

  constructor(
    private readonly task: FaceLandmarker,
    private readonly requestedMaxFps: number,
    private readonly inputMirrored: boolean,
    onFaceLost: MediaPipeFaceLostBehaviour,
  ) {
    this.maxFps = requestedMaxFps
    this.state = new FaceTrackingState({ onFaceLost })
  }

  bindAbortSignal(signal: AbortSignal) {
    // An abort listener has no caller to receive a cleanup failure; the
    // tracker is torn down regardless, so the error has nowhere useful to go.
    const onAbort = () => {
      try {
        this.dispose()
      }
      catch {}
    }
    signal.addEventListener('abort', onAbort, { once: true })
    this.abortCleanup = () => signal.removeEventListener('abort', onAbort)
  }

  update(source: TexImageSource, timestampMs: number): MediaPipeFaceTrackingUpdate {
    if (this.disposed)
      return { status: 'skipped' }
    if (!Number.isFinite(timestampMs) || timestampMs < 0)
      return { status: 'skipped' }
    if (this.lastInferenceTimestamp !== undefined) {
      if (timestampMs <= this.lastInferenceTimestamp)
        return { status: 'skipped' }
      // rAF stamps jitter around the display period; without slack a cap equal
      // to the refresh rate skips every other frame.
      if (timestampMs - this.lastInferenceTimestamp < 1_000 / this.maxFps - 1)
        return { status: 'skipped' }
    }
    this.lastInferenceTimestamp = timestampMs
    const startedAt = performance.now()
    let result: FaceLandmarkerResult
    try {
      result = this.task.detectForVideo(source, timestampMs)
    }
    catch (error) {
      throw trackingError(error, 'MediaPipe face inference failed')
    }
    const inferenceMs = Math.max(0, performance.now() - startedAt)
    this.adaptCap(inferenceMs)
    const stateUpdate = this.state.update(
      inputFromResult(result, this.inputMirrored),
      timestampMs,
    )
    this.signals = stateUpdate.signals
    this.tracking = stateUpdate.status === 'tracked'
    return { effectiveFps: this.maxFps, inferenceMs, status: stateUpdate.status }
  }

  private adaptCap(inferenceMs: number) {
    this.inferenceEmaMs = this.inferenceEmaMs === undefined
      ? inferenceMs
      : this.inferenceEmaMs * (1 - INFERENCE_EMA_WEIGHT) + inferenceMs * INFERENCE_EMA_WEIGHT
    const load = this.inferenceEmaMs / (1_000 / this.maxFps)
    if (load > SLOW_DOWN_LOAD && this.maxFps > MIN_ADAPTIVE_FPS)
      this.maxFps = Math.max(MIN_ADAPTIVE_FPS, this.maxFps / 2)
    else if (load < SPEED_UP_LOAD && this.maxFps < this.requestedMaxFps)
      this.maxFps = Math.min(this.requestedMaxFps, this.maxFps * 2)
  }

  attach(target: MediaPipeParameterTarget, options: MediaPipeAttachOptions = {}) {
    if (this.disposed)
      throw new Live2DError('invalid-props', 'Cannot attach a disposed MediaPipe tracker.')
    if (!target || typeof target.getModelInfo !== 'function' || typeof target.addParameterDriver !== 'function') {
      throw new Live2DError(
        'invalid-props',
        'MediaPipe attach target must provide getModelInfo() and addParameterDriver().',
      )
    }
    if (options.mapping !== undefined && !['auto', 'standard', 'perfect-sync'].includes(options.mapping))
      throw new Live2DError('invalid-props', 'mapping must be auto, standard, or perfect-sync.')
    if (options.channels !== undefined) {
      if (!options.channels || typeof options.channels !== 'object')
        throw new Live2DError('invalid-props', 'channels must be an object.')
      for (const channel of CHANNELS) {
        if (options.channels[channel] !== undefined && typeof options.channels[channel] !== 'boolean') {
          throw new Live2DError(
            'invalid-props',
            `channels.${channel} must be a boolean.`,
          )
        }
      }
    }
    if (options.sensitivity !== undefined) {
      if (!options.sensitivity || typeof options.sensitivity !== 'object')
        throw new Live2DError('invalid-props', 'sensitivity must be an object.')
      for (const channel of CHANNELS) {
        const value = options.sensitivity[channel]
        if (value !== undefined && (!Number.isFinite(value) || value < 0.1 || value > 5)) {
          throw new Live2DError(
            'invalid-props',
            `sensitivity.${channel} must be a finite number between 0.1 and 5.`,
          )
        }
      }
    }
    let bindings
    try {
      bindings = createParameterBindings(target.getModelInfo(), options)
    }
    catch (error) {
      throw new Live2DError(
        'invalid-props',
        error instanceof Error ? error.message : String(error),
        { cause: error, details: { backend: 'mediapipe' } },
      )
    }
    const previous = this.attachedByTarget.get(target)
    if (previous) {
      runCleanups(previous.cleanups)
      this.attached.delete(previous)
    }
    const cleanups: Array<() => void> = []
    try {
      for (const binding of bindings) {
        cleanups.push(target.addParameterDriver(binding.id, {
          getValue: () => this.signals ? binding.read(this.signals) : binding.defaultValue,
          // Head pose has to reach physics or the hair and body never follow
          // it. The rest are cosmetic and keep the stronger late phase, which
          // also lets tracked blinks beat the automatic eye-blink effect.
          phase: binding.channel === 'pose' ? 'before-physics' : 'after-motion',
        }))
      }
    }
    catch (error) {
      runCleanups(cleanups)
      throw error
    }
    const record: AttachedTarget = { cleanups, target }
    this.attached.add(record)
    this.attachedByTarget.set(target, record)
    let active = true
    return () => {
      if (!active)
        return
      active = false
      if (this.attachedByTarget.get(target) !== record)
        return
      this.attachedByTarget.delete(target)
      this.attached.delete(record)
      runCleanups(record.cleanups)
    }
  }

  calibrate() {
    if (this.disposed)
      return
    this.state.calibrate()
    this.signals = undefined
    this.tracking = false
    this.lastInferenceTimestamp = undefined
    this.inferenceEmaMs = undefined
    this.maxFps = this.requestedMaxFps
  }

  isTracking() {
    return !this.disposed && this.tracking
  }

  dispose() {
    if (this.disposed)
      return
    this.disposed = true
    this.abortCleanup?.()
    this.abortCleanup = undefined
    let firstError: unknown
    for (const record of [...this.attached]) {
      this.attachedByTarget.delete(record.target)
      try {
        runCleanups(record.cleanups)
      }
      catch (error) {
        firstError ??= error
      }
    }
    this.attached.clear()
    this.signals = undefined
    this.tracking = false
    try {
      this.task.close()
    }
    catch (error) {
      firstError ??= error
    }
    if (firstError)
      throw firstError
  }
}

export async function createMediaPipeFaceTracker(
  options: CreateMediaPipeFaceTrackerOptions,
): Promise<MediaPipeFaceTracker> {
  const modelAsset = validateOptions(options)
  // A buffer has no address; point failures at the path when there is one.
  const modelAssetUrl = 'modelAssetPath' in modelAsset ? modelAsset.modelAssetPath : undefined
  const signal = options.signal
  if (signal?.aborted)
    throw abortError(signal)

  let taskPromise: Promise<FaceLandmarker> | undefined
  try {
    const module = await awaitWithAbort(loadVisionModule(), signal)
    const fileset = await awaitWithAbort(loadFileset(module, options.wasmPath), signal)
      .catch((error) => {
        if (isAbort(error, signal))
          throw error
        throw trackingError(error, 'MediaPipe WASM fileset failed to load', options.wasmPath)
      })
    taskPromise = module.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        delegate: options.delegate ?? 'CPU',
        ...modelAsset,
      },
      minFaceDetectionConfidence:
        options.minFaceDetectionConfidence ?? DEFAULT_DETECTION_CONFIDENCE,
      minFacePresenceConfidence:
        options.minFacePresenceConfidence ?? DEFAULT_PRESENCE_CONFIDENCE,
      minTrackingConfidence: options.minTrackingConfidence ?? DEFAULT_TRACKING_CONFIDENCE,
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: 'VIDEO',
    })
    const task = await awaitWithAbort(taskPromise, signal).catch((error) => {
      if (signal?.aborted)
        void taskPromise?.then(lateTask => lateTask.close()).catch(() => {})
      if (isAbort(error, signal))
        throw error
      throw trackingError(error, 'MediaPipe Face Landmarker failed to initialize', modelAssetUrl)
    })
    const tracker = new MediaPipeFaceTrackerImpl(
      task,
      options.maxFps ?? DEFAULT_MAX_FPS,
      options.inputMirrored ?? false,
      options.onFaceLost ?? 'hold',
    )
    if (signal?.aborted) {
      tracker.dispose()
      throw abortError(signal)
    }
    if (signal)
      tracker.bindAbortSignal(signal)
    return tracker
  }
  catch (error) {
    if (isAbort(error, signal))
      throw error
    throw trackingError(error, 'MediaPipe face tracker initialization failed')
  }
}
