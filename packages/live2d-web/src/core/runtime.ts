import type { LipSyncProfileInput } from '../features/lipsync/source'
import type {
  Live2DAssetResolver,
  Live2DBackend,
  ModelHandle,
  ModelInfo,
  MotionOptions,
  MotionPlaybackResult,
  MotionSequenceResult,
  MotionSequenceStep,
  StageHandle,
} from './contract'
import type { ModelFit } from './fit'
import type {
  AutoQualityPolicy,
} from './quality'
import type { RuntimeFeature } from './runtime-feature'
import {
  MOUTH_PARAMETER_ID,
  MouthController,
} from '../features/lipsync/mouthController'
import { createSourceLipSync } from '../features/lipsync/source'
import { ensureCubismCore } from './ensureCubismCore'
import { Live2DError } from './errors'
import { fitModel } from './fit'
import { playMotionSequence } from './motion-sequence'
import {
  isMobileViewport,
  resolveAutoQualityPolicy,
  selectInitialResolution,
  selectLowerResolution,
} from './quality'
import { ManagedFeature } from './runtime-feature'

export type RuntimeLoadingStage = 'core' | 'stage' | 'model'

export interface RuntimeRenderState {
  width: number
  height: number
  resolution: number
  bufferPixels: number
}

export interface Live2DRuntimeState {
  status: 'loading' | 'ready' | 'error' | 'disposed'
  loadingStage?: RuntimeLoadingStage
  error?: Live2DError
  render?: RuntimeRenderState
}

export type RuntimeQualityOptions
  = | { quality?: 'auto' | AutoQualityPolicy, resolution?: never }
    | { quality?: never, resolution: number }

interface BaseCreateLive2DOptions {
  /** Element that receives the canvas. Must have a CSS size. */
  container: HTMLElement
  /**
   * The model3.json file: a URL by default, or a path inside the source when
   * `resolveAsset` is given. Sibling assets load relative to it either way.
   */
  src: string
  /**
   * Supplies the model's files instead of fetching them, for models that live
   * in memory or in browser storage rather than on a server.
   */
  resolveAsset?: Live2DAssetResolver
  /** Omit to use the official Framework-based cubism-webgl adapter. */
  backend?: Live2DBackend
  /** URL of the official live2dcubismcore.min.js. Omit only when the Core global is already loaded. */
  coreUrl?: string
  /** Layout preset or custom scale/offset. Default 'upper-body'. */
  fit?: ModelFit
  /** Make the model look toward the pointer while it is over the container. Default false. */
  followPointer?: boolean
  /** Idle motion group name (default 'Idle'), or false to disable automatic idle playback. */
  idleMotion?: string | false
  /** Frame-rate cap. Omit for the display refresh rate. */
  maxFps?: number
  /** Pause rendering while the container is outside the viewport. Default true. */
  pauseWhenOffscreen?: boolean
  /** Model-load retry count for transient failures (default 2). HTTP 4xx never retries. */
  retries?: number
  /** Aborts the initial load. */
  signal?: AbortSignal
  /** Called for runtime errors after the instance became ready. */
  onError?: (error: Live2DError) => void
}

export type CreateLive2DOptions = BaseCreateLive2DOptions & RuntimeQualityOptions

export interface ParameterDriver {
  getValue: () => number
}

export interface LipSyncDriver {
  getMouthOpen: () => number
  isSpeaking: () => boolean
}

export type RuntimeLipSyncOptions
  = ({
    onError?: (error: Live2DError) => void
    /** Mouth parameter to drive. Default ParamMouthOpenY. */
    parameterId?: string
  } & (
    | { driver: LipSyncDriver }
    | {
      source: AudioNode
      profile: LipSyncProfileInput
      isSpeaking: () => boolean
    }
  ))

export interface Live2DInstance {
  /** Current lifecycle/render state snapshot. */
  readonly getState: () => Live2DRuntimeState
  /** Notifies on state changes. Returns an idempotent unsubscribe. */
  readonly subscribe: (listener: () => void) => () => void
  /** Plays a motion. Resolves when playback finishes (or is interrupted). */
  motion: (group: string, index?: number, options?: MotionOptions) => Promise<void>
  /** Plays a motion and reports how playback settled. */
  playMotion: (
    group: string,
    index?: number,
    options?: MotionOptions,
  ) => Promise<MotionPlaybackResult>
  /** Plays validated motion steps until completion or the first interruption. */
  sequence: (steps: readonly MotionSequenceStep[]) => Promise<MotionSequenceResult>
  /** True while any motion (including idle) is playing. */
  isMotionPlaying: () => boolean
  /** Applies an expression by name, or a random one when omitted. */
  expression: (id?: string) => Promise<void>
  /** Returns the model to its default (no expression) state. */
  clearExpression: () => void
  /** Motion groups, expressions and hit areas declared by the model. */
  getModelInfo: () => ModelInfo
  /** Makes the model look at a stage-local point (0,0 = container top-left, CSS pixels). */
  focus: (x: number, y: number) => void
  /** Like focus(), but takes viewport client coordinates (e.g. PointerEvent clientX/Y). */
  focusAt: (clientX: number, clientY: number) => void
  /** Hit-area names under the given client coordinates. Empty before ready. */
  hitTest: (clientX: number, clientY: number) => string[]
  /** Reads the current value of a Cubism parameter. */
  getParameter: (id: string) => number
  /** Persistent per-frame override until clearParameter() removes it. */
  setParameter: (id: string, value: number) => void
  /** Removes a setParameter() override so motion curves regain the parameter. */
  clearParameter: (id: string) => void
  /** Changes the layout preset without reloading the model. */
  setFit: (fit: ModelFit) => void
  /** Writes a value after each SDK update. Returns an idempotent cleanup. */
  addParameterDriver: (id: string, driver: ParameterDriver) => () => void
  /** Attaches lip sync. Returns an idempotent cleanup. */
  addLipSync: (options: RuntimeLipSyncOptions) => () => void
  /** Pauses rendering until resume(). Hidden-tab/offscreen pauses stack separately. */
  pause: () => void
  /** Releases a pause() call. Rendering resumes when no pause reason remains. */
  resume: () => void
  /** Recreates the whole stage after a runtime error (e.g. context loss). */
  retry: () => Promise<void>
  /** Releases the model, canvas and GL context. Safe to call twice. */
  dispose: () => void
}

type Listener = () => void
type Cleanup = () => void
type PauseReason = 'hidden' | 'offscreen' | 'user'

function once(cleanup: Cleanup): Cleanup {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function asLive2DError(
  error: unknown,
  fallbackCode: 'adapter-error' | 'lipsync-error' | 'model-load-failed' | 'render-error',
) {
  if (error instanceof Live2DError)
    return error
  return new Live2DError(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
    { cause: error },
  )
}

function assertOptions(options: CreateLive2DOptions) {
  if (
    typeof window === 'undefined'
    || typeof document === 'undefined'
    || typeof HTMLElement === 'undefined'
  ) {
    throw new Live2DError(
      'browser-only',
      'Live2D can only be created in a browser.',
    )
  }
  if (!(options.container instanceof HTMLElement)) {
    throw new Live2DError(
      'invalid-props',
      'container must be an HTMLElement.',
    )
  }
  if (typeof options.src !== 'string' || options.src.trim() === '') {
    throw new Live2DError(
      'invalid-props',
      'src must be a non-empty model3.json path or URL string.',
    )
  }
  if (options.resolveAsset !== undefined && typeof options.resolveAsset !== 'function') {
    throw new Live2DError(
      'invalid-props',
      'resolveAsset must be a function.',
    )
  }
  if (options.quality !== undefined && options.resolution !== undefined) {
    throw new Live2DError(
      'invalid-props',
      'quality and resolution are mutually exclusive.',
    )
  }
  if (!Number.isInteger(options.retries ?? 2) || (options.retries ?? 2) < 0) {
    throw new Live2DError(
      'invalid-props',
      'retries must be a non-negative integer.',
    )
  }
  if (
    'resolution' in options
    && options.resolution !== undefined
    && (!Number.isFinite(options.resolution) || options.resolution < 1)
  ) {
    throw new Live2DError(
      'invalid-props',
      'resolution must be a finite number greater than or equal to 1.',
    )
  }
  if (
    options.maxFps !== undefined
    && (!Number.isFinite(options.maxFps) || options.maxFps <= 0)
  ) {
    throw new Live2DError(
      'invalid-props',
      'maxFps must be a finite number greater than 0.',
    )
  }
  if (
    options.pauseWhenOffscreen !== undefined
    && typeof options.pauseWhenOffscreen !== 'boolean'
  ) {
    throw new Live2DError(
      'invalid-props',
      'pauseWhenOffscreen must be a boolean.',
    )
  }
  if (
    options.followPointer !== undefined
    && typeof options.followPointer !== 'boolean'
  ) {
    throw new Live2DError(
      'invalid-props',
      'followPointer must be a boolean.',
    )
  }
  if (
    options.idleMotion !== undefined
    && options.idleMotion !== false
    && (typeof options.idleMotion !== 'string' || options.idleMotion.trim() === '')
  ) {
    throw new Live2DError(
      'invalid-props',
      'idleMotion must be a non-empty motion group name or false.',
    )
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    let timeout: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal.reason)
    }
    timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export class Live2DRuntime implements Live2DInstance {
  private abortController: AbortController | undefined
  private disposed = false
  private features: RuntimeFeature[] = []
  private fit: ModelFit
  private intersectionObserver: IntersectionObserver | undefined
  private listeners = new Set<Listener>()
  private model: ModelHandle | undefined
  private onStageResume: (() => void) | undefined
  private pauseReasons = new Set<PauseReason>()
  private resizeAnimationFrame = 0
  private resizeObserver: ResizeObserver | undefined
  private stage: StageHandle | undefined
  private stageCleanup: Cleanup[] = []
  private state: Live2DRuntimeState = {
    loadingStage: 'core',
    status: 'loading',
  }

  constructor(private readonly options: CreateLive2DOptions) {
    this.fit = options.fit ?? 'upper-body'
  }

  readonly getState = () => this.state

  /** Internal bridge for framework bindings that preserve the ModelHandle API. */
  readonly getModelHandle = () => this.model ?? null

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return once(() => this.listeners.delete(listener))
  }

  private updateState(patch: Partial<Live2DRuntimeState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners)
      listener()
  }

  private report(error: Live2DError) {
    if (this.disposed)
      return
    this.updateState({
      error,
      loadingStage: undefined,
      status: 'error',
    })
    this.options.onError?.(error)
  }

  private readRenderState(stage: StageHandle): RuntimeRenderState {
    const size = stage.getSize()
    const resolution = stage.getResolution()
    return {
      bufferPixels: Math.round(size.width * size.height * resolution ** 2),
      height: size.height,
      resolution,
      width: size.width,
    }
  }

  private async resolveBackend() {
    if (this.options.backend)
      return this.options.backend
    const { cubismWebGL } = await import('../backends/cubism-webgl')
    return cubismWebGL
  }

  private addPauseReason(reason: PauseReason) {
    if (this.pauseReasons.has(reason))
      return
    const wasRunning = this.pauseReasons.size === 0
    this.pauseReasons.add(reason)
    if (wasRunning)
      this.stage?.pause()
  }

  private removePauseReason(reason: PauseReason) {
    if (!this.pauseReasons.delete(reason) || this.pauseReasons.size > 0)
      return
    this.onStageResume?.()
    this.stage?.resume()
  }

  private teardown() {
    this.abortController?.abort()
    this.abortController = undefined
    cancelAnimationFrame(this.resizeAnimationFrame)
    this.resizeAnimationFrame = 0
    this.intersectionObserver?.disconnect()
    this.intersectionObserver = undefined
    this.onStageResume = undefined
    this.resizeObserver?.disconnect()
    this.resizeObserver = undefined
    for (const cleanup of this.stageCleanup.splice(0).reverse())
      cleanup()
    for (const feature of [...this.features].reverse())
      feature.detach()
    this.model?.dispose()
    this.model = undefined
    this.stage?.dispose()
    this.stage = undefined
  }

  async start() {
    if (this.disposed)
      throw new Live2DError('invalid-props', 'Cannot start a disposed Live2D instance.')

    assertOptions(this.options)
    // Observers are recreated per generation and re-report their own state, but
    // a user pause has no other source of truth, so it survives retry().
    this.pauseReasons.delete('hidden')
    this.pauseReasons.delete('offscreen')
    const policy = this.options.resolution !== undefined
      ? undefined
      : resolveAutoQualityPolicy(
          typeof this.options.quality === 'object' ? this.options.quality : undefined,
        )
    const controller = new AbortController()
    this.abortController = controller
    const onExternalAbort = () => controller.abort(this.options.signal?.reason)
    if (this.options.signal?.aborted)
      onExternalAbort()
    this.options.signal?.addEventListener('abort', onExternalAbort, { once: true })
    this.stageCleanup.push(() => {
      this.options.signal?.removeEventListener('abort', onExternalAbort)
    })

    try {
      this.updateState({ error: undefined, loadingStage: 'core', status: 'loading' })
      await ensureCubismCore(this.options.coreUrl, { signal: controller.signal })
      if (controller.signal.aborted)
        throw controller.signal.reason

      // Framework modules read the Core global while evaluating, so the
      // default adapter must never be imported before Core is ready.
      const backend = await this.resolveBackend()
      if (controller.signal.aborted)
        throw controller.signal.reason

      this.updateState({ loadingStage: 'stage' })
      const rect = this.options.container.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) {
        console.warn(
          '[live2d-web] The container has zero size, so the canvas will be 1x1 '
          + 'and nothing will be visible. Give the container a CSS width and height.',
        )
      }
      let width = Math.max(1, rect.width)
      let height = Math.max(1, rect.height)
      const resolution = this.options.resolution !== undefined
        ? this.options.resolution
        : selectInitialResolution({
            devicePixelRatio: window.devicePixelRatio,
            height,
            mobile: isMobileViewport(width, height),
            width,
          }, policy)
      const stage = backend.createStage(this.options.container, {
        height,
        maxFps: this.options.maxFps,
        resolution,
        width,
      })
      this.stage = stage
      // pause() before this point could only record its reason, not apply it.
      if (this.pauseReasons.size > 0)
        stage.pause()
      this.stageCleanup.push(stage.onError((error) => {
        this.report(asLive2DError(error, 'render-error'))
      }))

      let elapsedMs = 0
      let frameCount = 0
      let longFrameCount = 0
      if (policy) {
        this.stageCleanup.push(stage.onFrame((deltaMs) => {
          elapsedMs += deltaMs
          frameCount++
          if (deltaMs > policy.longFrameMs)
            longFrameCount++
          if (elapsedMs < policy.sampleWindowMs)
            return
          const next = selectLowerResolution(
            stage.getResolution(),
            frameCount ? longFrameCount / frameCount : 0,
            policy,
          )
          if (next < stage.getResolution()) {
            stage.setResolution(next)
            this.updateState({ render: this.readRenderState(stage) })
          }
          elapsedMs = 0
          frameCount = 0
          longFrameCount = 0
        }))
      }

      const resize = () => {
        this.resizeAnimationFrame = 0
        if (this.disposed || this.stage !== stage)
          return
        const nextRect = this.options.container.getBoundingClientRect()
        const nextWidth = Math.max(1, nextRect.width)
        const nextHeight = Math.max(1, nextRect.height)
        if (
          Math.abs(nextWidth - width) < 0.5
          && Math.abs(nextHeight - height) < 0.5
        ) {
          return
        }
        width = nextWidth
        height = nextHeight
        if (policy) {
          const cap = selectInitialResolution({
            devicePixelRatio: window.devicePixelRatio,
            height,
            mobile: isMobileViewport(width, height),
            width,
          }, policy)
          if (cap < stage.getResolution())
            stage.setResolution(cap)
        }
        stage.resize(width, height)
        this.applyFit()
        this.updateState({ render: this.readRenderState(stage) })
      }
      const scheduleResize = () => {
        if (!this.resizeAnimationFrame)
          this.resizeAnimationFrame = requestAnimationFrame(resize)
      }
      this.resizeObserver = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleResize)
      this.resizeObserver?.observe(this.options.container)

      this.onStageResume = () => {
        elapsedMs = 0
        frameCount = 0
        longFrameCount = 0
        scheduleResize()
      }

      const onVisibilityChange = () => {
        if (document.hidden)
          this.addPauseReason('hidden')
        else
          this.removePauseReason('hidden')
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      // visibilitychange only fires on transitions, so seed the current value.
      onVisibilityChange()
      this.stageCleanup.push(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      })

      this.intersectionObserver = (this.options.pauseWhenOffscreen ?? true)
        && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1]
            if (!entry)
              return
            if (entry.isIntersecting)
              this.removePauseReason('offscreen')
            else
              this.addPauseReason('offscreen')
          })
        : undefined
      this.intersectionObserver?.observe(this.options.container)

      this.updateState({
        loadingStage: 'model',
        render: this.readRenderState(stage),
      })
      const model = await this.loadModel(backend, stage, controller.signal)
      if (controller.signal.aborted || this.stage !== stage) {
        model.dispose()
        throw controller.signal.reason
      }
      this.model = model
      this.applyFit()
      for (const feature of this.features)
        feature.attach(model)
      if (this.options.followPointer) {
        const container = this.options.container
        const onPointerMove = (event: PointerEvent) => {
          if (this.model && this.stage === stage)
            this.focusAt(event.clientX, event.clientY)
        }
        const onPointerLeave = () => {
          if (this.model && this.stage === stage) {
            const size = stage.getSize()
            this.model.focus(size.width / 2, size.height / 2)
          }
        }
        container.addEventListener('pointermove', onPointerMove)
        container.addEventListener('pointerleave', onPointerLeave)
        this.stageCleanup.push(() => {
          container.removeEventListener('pointermove', onPointerMove)
          container.removeEventListener('pointerleave', onPointerLeave)
        })
      }
      this.updateState({
        error: undefined,
        loadingStage: undefined,
        render: this.readRenderState(stage),
        status: 'ready',
      })
    }
    catch (error) {
      if (controller.signal.aborted) {
        if (this.disposed)
          return
        throw error
      }
      const normalized = asLive2DError(error, 'adapter-error')
      // A failed initial generation must not retain its Canvas or GPU state.
      // Keep the runtime object and error state alive so React/vanilla retry
      // can create a completely new Stage generation.
      this.teardown()
      this.report(normalized)
      throw normalized
    }
  }

  private async loadModel(
    backend: Live2DBackend,
    stage: StageHandle,
    signal: AbortSignal,
  ) {
    const retries = this.options.retries ?? 2
    let lastError: Live2DError | undefined
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await backend.loadModel(stage, this.options.src, {
          idleMotion: this.options.idleMotion,
          resolveAsset: this.options.resolveAsset,
          signal,
        })
      }
      catch (error) {
        if (signal.aborted)
          throw error
        lastError = asLive2DError(error, 'model-load-failed')
        // HTTP 4xx means a wrong URL or missing asset; retrying only delays
        // the failure. Retries exist for transient network/server issues.
        const status = lastError.details?.httpStatus
        const permanent = lastError.code === 'invalid-props'
          || (status !== undefined && status >= 400 && status < 500)
        if (permanent || attempt === retries)
          break
        await wait(attempt === 0 ? 250 : 500, signal)
      }
    }
    if (!lastError) {
      throw new Live2DError(
        'model-load-failed',
        'The model could not be loaded.',
      )
    }
    throw lastError
  }

  private requireModel() {
    if (this.disposed) {
      throw new Live2DError(
        'invalid-props',
        'The Live2D instance has been disposed.',
      )
    }
    if (!this.model) {
      throw new Live2DError(
        'model-load-failed',
        'The Live2D model is not ready.',
      )
    }
    return this.model
  }

  private applyFit() {
    if (!this.model || !this.stage)
      return
    this.model.setTransform(fitModel(
      this.stage.getSize(),
      this.model.getIntrinsicSize(),
      this.fit,
    ))
  }

  motion(group: string, index?: number, options?: MotionOptions) {
    return this.requireModel().motion(group, index, options)
  }

  playMotion(group: string, index?: number, options?: MotionOptions) {
    const model = this.requireModel()
    if (!model.playMotion) {
      throw new Live2DError(
        'adapter-error',
        'The selected Live2D backend does not support detailed motion playback.',
      )
    }
    return model.playMotion(group, index, options)
  }

  sequence(steps: readonly MotionSequenceStep[]) {
    const model = this.requireModel()
    if (!model.playMotion) {
      throw new Live2DError(
        'adapter-error',
        'The selected Live2D backend does not support motion sequences.',
      )
    }
    return playMotionSequence(
      steps,
      model.getModelInfo(),
      (group, index, options) => model.playMotion!(group, index, options),
    )
  }

  isMotionPlaying() {
    return this.model?.isMotionPlaying() ?? false
  }

  expression(id?: string) {
    return this.requireModel().expression(id)
  }

  clearExpression() {
    this.requireModel().clearExpression()
  }

  getModelInfo() {
    return this.requireModel().getModelInfo()
  }

  focus(x: number, y: number) {
    this.requireModel().focus(x, y)
  }

  focusAt(clientX: number, clientY: number) {
    const model = this.requireModel()
    if (!this.stage)
      return
    const point = this.stage.toWorld(clientX, clientY)
    model.focus(point.x, point.y)
  }

  hitTest(clientX: number, clientY: number): string[] {
    if (!this.model || !this.stage)
      return []
    const point = this.stage.toWorld(clientX, clientY)
    return this.model.hitTest(point.x, point.y)
  }

  getParameter(id: string) {
    return this.requireModel().getParameter(id)
  }

  setParameter(id: string, value: number) {
    this.requireModel().setParameter(id, value)
  }

  clearParameter(id: string) {
    this.requireModel().clearParameter(id)
  }

  setFit(fit: ModelFit) {
    this.fit = fit
    this.applyFit()
  }

  private addFeature(feature: RuntimeFeature) {
    this.features.push(feature)
    if (this.model)
      feature.attach(this.model)
    return once(() => {
      feature.detach()
      const index = this.features.indexOf(feature)
      if (index >= 0)
        this.features.splice(index, 1)
    })
  }

  addParameterDriver(id: string, driver: ParameterDriver) {
    if (!driver || typeof driver.getValue !== 'function') {
      throw new Live2DError(
        'invalid-props',
        'A parameter driver must provide getValue().',
      )
    }
    return this.addFeature(new ManagedFeature((model) => {
      const unsubscribe = model.onAfterMotionUpdate(() => {
        // Write transiently: the value must last only until the next SDK
        // update, or the last driver output would keep overriding motion
        // curves after the driver is removed.
        model.setParameter(id, driver.getValue())
        model.clearParameter(id)
      })
      return () => {
        unsubscribe()
        model.clearParameter(id)
      }
    }, error => this.report(asLive2DError(error, 'render-error'))))
  }

  addLipSync(options: RuntimeLipSyncOptions) {
    const reportLipSyncError = (error: unknown) => {
      const normalized = asLive2DError(error, 'lipsync-error')
      options.onError?.(normalized)
      if (!options.onError && this.options.onError)
        this.options.onError?.(normalized)
      else if (!options.onError && !this.options.onError)
        console.error('[live2d-web] lip sync disabled:', normalized)
    }
    const parameterId = options.parameterId ?? MOUTH_PARAMETER_ID
    const feature = new ManagedFeature(async (model) => {
      const controller = new MouthController()
      const sourceConnection = 'source' in options
        ? await createSourceLipSync(options.source, options.profile)
        : undefined
      const driver = 'driver' in options
        ? options.driver
        : {
            getMouthOpen: sourceConnection!.getMouthOpen,
            isSpeaking: options.isSpeaking,
          }
      let failed = false
      const unsubscribe = model.onAfterMotionUpdate((deltaMs) => {
        if (failed)
          return
        try {
          const speaking = driver.isSpeaking()
          const value = controller.update({
            deltaMs,
            motionValue: model.getParameter(parameterId),
            mouthOpen: speaking ? driver.getMouthOpen() : 0,
            speaking,
          })
          if (value !== null) {
            // Write transiently so the release/hold handoff actually returns
            // ParamMouthOpenY to motion curves instead of pinning the last
            // lip-sync value as a persistent override.
            model.setParameter(parameterId, value)
            model.clearParameter(parameterId)
          }
        }
        catch (error) {
          failed = true
          reportLipSyncError(error)
        }
      })
      return () => {
        unsubscribe()
        model.clearParameter(parameterId)
        sourceConnection?.dispose()
      }
    }, reportLipSyncError)
    return this.addFeature(feature)
  }

  pause() {
    this.addPauseReason('user')
  }

  resume() {
    this.removePauseReason('user')
  }

  async retry() {
    if (this.disposed)
      throw new Live2DError('invalid-props', 'Cannot retry a disposed Live2D instance.')
    this.teardown()
    await this.start()
  }

  dispose() {
    if (this.disposed)
      return
    this.disposed = true
    this.teardown()
    this.features = []
    this.updateState({
      error: undefined,
      loadingStage: undefined,
      render: undefined,
      status: 'disposed',
    })
    this.listeners.clear()
  }
}

export async function createLive2D(
  options: CreateLive2DOptions,
): Promise<Live2DInstance> {
  const runtime = new Live2DRuntime(options)
  try {
    await runtime.start()
    return runtime
  }
  catch (error) {
    runtime.dispose()
    throw error
  }
}
