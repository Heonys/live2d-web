import type {
  FaceLandmarker,
  FaceLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
  SerializedFaceResult,
  WorkerTrackerOptions,
} from './protocol'
import type { FaceTrackingSignals } from './state'
import type {
  CreateMediaPipeFaceTrackerOptions,
  CreateMediaPipeMainThreadFaceTrackerOptions,
  CreateMediaPipeWorkerFaceTrackerOptions,
  MediaPipeAttachOptions,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
  MediaPipeModelAsset,
  MediaPipeParameterTarget,
  MediaPipeWorkerFaceTracker,
} from './types'
import { Live2DError } from '../../core/errors'
import { MEDIAPIPE_BLENDSHAPES } from './blendshapes'
import { createParameterBindings } from './mapping'
import { MEDIAPIPE_WORKER_PROTOCOL } from './protocol'
import { FaceTrackingState, poseFromMatrix } from './state'

export {
  MEDIAPIPE_BLENDSHAPES,
  PERFECT_SYNC_PARAMETER_IDS,
} from './blendshapes'
export type {
  CreateMediaPipeFaceTrackerBaseOptions,
  CreateMediaPipeFaceTrackerOptions,
  CreateMediaPipeMainThreadFaceTrackerOptions,
  CreateMediaPipeMainThreadOptions,
  CreateMediaPipeWorkerFaceTrackerOptions,
  CreateMediaPipeWorkerOptions,
  MediaPipeAttachOptions,
  MediaPipeFaceChannel,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
  MediaPipeMappingMode,
  MediaPipeModelAsset,
  MediaPipeParameterTarget,
  MediaPipeWorkerFaceTracker,
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
// A worker that never answers must not wedge the tracker: without a deadline a
// lost detect holds the one-frame-in-flight slot for the rest of the session.
// Init gets longer because it downloads WASM and the model over the network.
const WORKER_DETECT_TIMEOUT_MS = 10_000
const WORKER_INIT_TIMEOUT_MS = 30_000
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
  if (options.execution !== undefined && options.execution !== 'main' && options.execution !== 'worker')
    throw new Live2DError('invalid-props', 'execution must be main or worker.')
  if (options.execution === 'worker' && typeof options.workerFactory !== 'function')
    throw new Live2DError('invalid-props', 'workerFactory must be provided for worker execution.')
  if (options.execution !== 'worker' && options.workerFactory !== undefined)
    throw new Live2DError('invalid-props', 'workerFactory requires execution: worker.')
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

function faceInput(
  entries: Iterable<readonly [string, number]>,
  matrix: readonly number[] | undefined,
  mirrored: boolean,
) {
  if (!matrix || matrix.length < 16)
    return undefined
  const scores = new Map<string, number>()
  for (const [categoryName, score] of entries) {
    const name = mirrored ? swapLeftRight(categoryName) : categoryName
    scores.set(name, normalizeScore(score))
  }
  for (const name of MEDIAPIPE_BLENDSHAPES) {
    if (!scores.has(name))
      scores.set(name, 0)
  }
  // The matrix goes to poseFromMatrix untouched: its non-finite guard rejects
  // a corrupted frame as a whole, and pre-sanitizing entries here would turn
  // that rejection into a garbage pose.
  const pose = poseFromMatrix(matrix)
  return {
    blendshapes: scores,
    matrix,
    pose: mirrored ? { x: -pose.x, y: pose.y, z: -pose.z } : pose,
  }
}

function inputFromResult(result: FaceLandmarkerResult, mirrored: boolean) {
  if (!result.faceLandmarks.length)
    return undefined
  const categories = result.faceBlendshapes[0]?.categories ?? []
  if (categories.length === 0)
    return undefined
  return faceInput(
    categories.map(category => [category.categoryName, category.score] as const),
    result.facialTransformationMatrixes[0]?.data,
    mirrored,
  )
}

function inputFromSerializedResult(result: SerializedFaceResult | undefined, mirrored: boolean) {
  if (!result)
    return undefined
  return faceInput(result.blendshapes, result.matrix, mirrored)
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
    private readonly task: FaceLandmarker | undefined,
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
    if (!this.canUpdate(timestampMs) || !this.task)
      return { status: 'skipped' }
    const startedAt = performance.now()
    let result: FaceLandmarkerResult
    try {
      result = this.task.detectForVideo(source, timestampMs)
    }
    catch (error) {
      throw trackingError(error, 'MediaPipe face inference failed')
    }
    const inferenceMs = Math.max(0, performance.now() - startedAt)
    return this.applyResult(inputFromResult(result, this.inputMirrored), timestampMs, inferenceMs)
  }

  canUpdate(timestampMs: number) {
    if (this.disposed || !Number.isFinite(timestampMs) || timestampMs < 0)
      return false
    if (this.lastInferenceTimestamp !== undefined) {
      if (timestampMs <= this.lastInferenceTimestamp)
        return false
      // rAF stamps jitter around the display period; without slack a cap equal
      // to the refresh rate skips every other frame.
      if (timestampMs - this.lastInferenceTimestamp < 1_000 / this.maxFps - 1)
        return false
    }
    this.lastInferenceTimestamp = timestampMs
    return true
  }

  applySerializedResult(
    result: SerializedFaceResult | undefined,
    timestampMs: number,
    inferenceMs: number,
  ) {
    return this.applyResult(inputFromSerializedResult(result, this.inputMirrored), timestampMs, inferenceMs)
  }

  private applyResult(
    input: ReturnType<typeof inputFromResult>,
    timestampMs: number,
    inferenceMs: number,
  ): MediaPipeFaceTrackingUpdate {
    this.adaptCap(inferenceMs)
    const stateUpdate = this.state.update(input, timestampMs)
    this.signals = stateUpdate.signals
    this.tracking = stateUpdate.status === 'tracked'
    return { effectiveFps: this.maxFps, inferenceMs, status: stateUpdate.status }
  }

  private adaptCap(inferenceMs: number) {
    // The cap exists to keep synchronous inference from starving the render
    // thread. Without a task, inference runs in a worker: the render thread is
    // not under load, and one-frame-in-flight already provides backpressure,
    // so lowering the request rate would only discard frames (measured on
    // Firefox as 95.6% skipped while render p95 sat at 9.8ms).
    if (!this.task)
      return
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
      this.task?.close()
    }
    catch (error) {
      firstError ??= error
    }
    if (firstError)
      throw firstError
  }
}

interface PendingWorkerRequest {
  generation: number
  reject: (error: unknown) => void
  resolve: (result: MediaPipeFaceTrackingUpdate) => void
  timer: ReturnType<typeof setTimeout>
  timestampMs: number
  token: number
}

class MediaPipeWorkerFaceTrackerImpl implements MediaPipeWorkerFaceTracker {
  private abortCleanup: (() => void) | undefined
  // The one-frame-in-flight slot is owned by a token, not a boolean: only the
  // request that took the slot may free it, so a stale frame settling late
  // cannot free the slot on behalf of the frame that came after it.
  private activeToken: number | undefined
  private disposed = false
  private generation = 0
  private nextId = 1
  private nextToken = 1
  private pending = new Map<number, PendingWorkerRequest>()
  private staleRequests = new Map<number, { timer: ReturnType<typeof setTimeout>, token: number }>()
  private terminateTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly worker: Worker,
    private readonly core: MediaPipeFaceTrackerImpl,
  ) {
    worker.addEventListener('message', this.onMessage)
    worker.addEventListener('error', this.onWorkerError)
    worker.addEventListener('messageerror', this.onWorkerError)
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

  update(source: TexImageSource, timestampMs: number): Promise<MediaPipeFaceTrackingUpdate> {
    if (this.disposed || this.activeToken !== undefined || !this.core.canUpdate(timestampMs))
      return Promise.resolve({ status: 'skipped' })
    const token = this.nextToken++
    this.activeToken = token
    const generation = this.generation
    return createImageBitmap(source as ImageBitmapSource).catch((error) => {
      this.release(token)
      if (this.disposed)
        return undefined
      throw trackingError(error, 'MediaPipe worker frame capture failed')
    }).then((bitmap) => {
      if (!bitmap)
        return { status: 'skipped' } as const
      if (this.disposed || generation !== this.generation) {
        bitmap.close()
        this.release(token)
        return { status: 'skipped' } as const
      }
      return new Promise<MediaPipeFaceTrackingUpdate>((resolve, reject) => {
        const id = this.nextId++
        const timer = setTimeout(() => this.expirePending(id), WORKER_DETECT_TIMEOUT_MS)
        this.pending.set(id, { generation, reject, resolve, timer, timestampMs, token })
        const request: MediaPipeWorkerRequest = { bitmap, id, timestampMs, type: 'detect' }
        try {
          this.worker.postMessage(request, [bitmap])
        }
        catch (error) {
          this.removePending(id)
          bitmap.close()
          reject(trackingError(error, 'MediaPipe worker frame transfer failed'))
        }
      })
    })
  }

  attach: MediaPipeFaceTracker['attach'] = (target, options) => this.core.attach(target, options)

  calibrate() {
    if (this.disposed)
      return
    this.generation++
    this.settlePendingAsSkipped(true)
    this.core.calibrate()
  }

  isTracking() {
    return !this.disposed && this.core.isTracking()
  }

  dispose() {
    if (this.disposed)
      return
    this.disposed = true
    this.generation++
    this.abortCleanup?.()
    this.abortCleanup = undefined
    this.settlePendingAsSkipped()
    this.clearStaleRequests()
    this.activeToken = undefined
    try {
      this.core.dispose()
    }
    finally {
      // A throwing driver cleanup must not strand the worker thread: the
      // shutdown message and the terminate fallback run regardless.
      const id = this.nextId++
      try {
        this.worker.postMessage({ id, type: 'dispose' } satisfies MediaPipeWorkerRequest)
        this.terminateTimer = setTimeout(() => this.terminate(), 1_000)
      }
      catch {
        this.terminate()
      }
    }
  }

  private release(token: number) {
    if (this.activeToken === token)
      this.activeToken = undefined
  }

  private removePending(id: number) {
    const pending = this.pending.get(id)
    if (!pending)
      return undefined
    this.pending.delete(id)
    clearTimeout(pending.timer)
    this.release(pending.token)
    return pending
  }

  private expirePending(id: number) {
    const pending = this.removePending(id)
    pending?.reject(trackingError(
      new Error(`no response within ${WORKER_DETECT_TIMEOUT_MS}ms`),
      'MediaPipe worker inference timed out',
    ))
  }

  private expireStale(id: number) {
    const stale = this.staleRequests.get(id)
    if (!stale)
      return
    this.staleRequests.delete(id)
    this.release(stale.token)
  }

  private clearStaleRequests() {
    for (const stale of this.staleRequests.values())
      clearTimeout(stale.timer)
    this.staleRequests.clear()
  }

  private settlePendingAsSkipped(waitForWorker = false) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.resolve({ status: 'skipped' })
      if (waitForWorker) {
        // The worker is still computing this frame: its token stays held so a
        // new frame is not queued behind an unfinished one, and expires with
        // the same deadline a live request gets.
        const timer = setTimeout(() => this.expireStale(id), WORKER_DETECT_TIMEOUT_MS)
        this.staleRequests.set(id, { timer, token: pending.token })
      }
      else {
        this.release(pending.token)
      }
    }
    this.pending.clear()
  }

  private terminate() {
    if (this.terminateTimer !== undefined)
      clearTimeout(this.terminateTimer)
    this.terminateTimer = undefined
    this.worker.removeEventListener('message', this.onMessage)
    this.worker.removeEventListener('error', this.onWorkerError)
    this.worker.removeEventListener('messageerror', this.onWorkerError)
    this.worker.terminate()
  }

  private onMessage = (event: MessageEvent<MediaPipeWorkerResponse>) => {
    const response = event.data
    if (response.type === 'disposed') {
      this.terminate()
      return
    }
    const stale = this.staleRequests.get(response.id)
    if (stale) {
      this.staleRequests.delete(response.id)
      clearTimeout(stale.timer)
      this.release(stale.token)
      return
    }
    const pending = this.removePending(response.id)
    if (!pending)
      return
    if (response.type === 'error') {
      const cause = new Error(response.error.message)
      cause.name = response.error.name ?? 'Error'
      cause.stack = response.error.stack
      pending.reject(trackingError(cause, 'MediaPipe worker inference failed'))
      return
    }
    if (response.type !== 'result')
      return
    if (this.disposed || pending.generation !== this.generation) {
      pending.resolve({ status: 'skipped' })
      return
    }
    pending.resolve(this.core.applySerializedResult(
      response.result,
      pending.timestampMs,
      response.inferenceMs,
    ))
  }

  private onWorkerError = (event: ErrorEvent | MessageEvent) => {
    if (this.disposed)
      return
    const cause = event instanceof ErrorEvent
      ? event.error ?? new Error(event.message)
      : new Error('MediaPipe worker message could not be deserialized.')
    const error = trackingError(cause, 'MediaPipe worker crashed')
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
    this.clearStaleRequests()
    this.activeToken = undefined
    this.disposed = true
    this.abortCleanup?.()
    this.abortCleanup = undefined
    try {
      this.core.dispose()
    }
    finally {
      this.terminate()
    }
  }
}

function absoluteUrl(value: string) {
  return new URL(value, document.baseURI).href
}

async function createWorkerTracker(
  options: CreateMediaPipeWorkerFaceTrackerOptions,
  modelAsset: MediaPipeModelAsset,
): Promise<MediaPipeWorkerFaceTracker> {
  let worker: Worker
  try {
    worker = options.workerFactory()
  }
  catch (error) {
    throw trackingError(error, 'MediaPipe worker creation failed')
  }
  if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function') {
    throw new Live2DError('invalid-props', 'workerFactory must return a Worker.')
  }
  const workerOptions: WorkerTrackerOptions = {
    delegate: options.delegate ?? 'CPU',
    minFaceDetectionConfidence: options.minFaceDetectionConfidence ?? DEFAULT_DETECTION_CONFIDENCE,
    minFacePresenceConfidence: options.minFacePresenceConfidence ?? DEFAULT_PRESENCE_CONFIDENCE,
    minTrackingConfidence: options.minTrackingConfidence ?? DEFAULT_TRACKING_CONFIDENCE,
    wasmPath: absoluteUrl(options.wasmPath),
    ...(typeof modelAsset.modelAssetPath === 'string'
      ? { modelAssetPath: absoluteUrl(modelAsset.modelAssetPath) }
      : { modelAssetBuffer: new Uint8Array(modelAsset.modelAssetBuffer) }),
  }
  const signal = options.signal
  const initId = 0
  try {
    await awaitWithAbort(new Promise<void>((resolve, reject) => {
      let cleanup = () => {}
      const onMessage = (event: MessageEvent<MediaPipeWorkerResponse>) => {
        if (event.data.id !== initId)
          return
        cleanup()
        if (event.data.type === 'ready')
          resolve()
        else if (event.data.type === 'error')
          reject(new Error(event.data.error.message))
      }
      const onError = (event: ErrorEvent) => {
        cleanup()
        reject(event.error ?? new Error(event.message))
      }
      const onMessageError = () => {
        cleanup()
        reject(new Error('MediaPipe worker initialization response was invalid.'))
      }
      const deadline = setTimeout(() => {
        cleanup()
        reject(new Error(`no ready response within ${WORKER_INIT_TIMEOUT_MS}ms`))
      }, WORKER_INIT_TIMEOUT_MS)
      cleanup = () => {
        clearTimeout(deadline)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        worker.removeEventListener('messageerror', onMessageError)
      }
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
      worker.addEventListener('messageerror', onMessageError)
      const request: MediaPipeWorkerRequest = {
        id: initId,
        options: workerOptions,
        protocol: MEDIAPIPE_WORKER_PROTOCOL,
        type: 'init',
      }
      if (workerOptions.modelAssetBuffer) {
        worker.postMessage(request, [workerOptions.modelAssetBuffer.buffer])
      }
      else {
        worker.postMessage(request)
      }
    }), signal)
  }
  catch (error) {
    worker.terminate()
    if (isAbort(error, signal))
      throw error
    throw trackingError(error, 'MediaPipe worker failed to initialize')
  }
  const core = new MediaPipeFaceTrackerImpl(
    undefined,
    options.maxFps ?? DEFAULT_MAX_FPS,
    options.inputMirrored ?? false,
    options.onFaceLost ?? 'hold',
  )
  const tracker = new MediaPipeWorkerFaceTrackerImpl(worker, core)
  if (signal)
    tracker.bindAbortSignal(signal)
  return tracker
}

export function createMediaPipeFaceTracker(
  options: CreateMediaPipeWorkerFaceTrackerOptions,
): Promise<MediaPipeWorkerFaceTracker>
export function createMediaPipeFaceTracker(
  options: CreateMediaPipeMainThreadFaceTrackerOptions,
): Promise<MediaPipeFaceTracker>
export async function createMediaPipeFaceTracker(
  options: CreateMediaPipeFaceTrackerOptions,
): Promise<MediaPipeFaceTracker | MediaPipeWorkerFaceTracker> {
  const modelAsset = validateOptions(options)
  if (options.execution === 'worker')
    return createWorkerTracker(options, modelAsset)
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
