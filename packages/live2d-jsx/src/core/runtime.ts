import type { LipSyncProfileInput } from '../features/lipsync/source'
import type {
  Live2DBackend,
  ModelHandle,
  StageHandle,
} from './contract'
import type { ModelFit } from './fit'
import type {
  AutoQualityPolicy,
} from './quality'
import {
  MOUTH_PARAMETER_ID,
  MouthController,
} from '../features/lipsync/mouthController'
import { createSourceLipSync } from '../features/lipsync/source'
import { ensureCubismCore } from './ensureCubismCore'
import { Live2DError } from './errors'
import { fitModel } from './fit'
import {
  isMobileViewport,
  resolveAutoQualityPolicy,
  selectInitialResolution,
  selectLowerResolution,
} from './quality'

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
  container: HTMLElement
  src: string
  /**
   * Temporary until the license-gated cubism-webgl adapter can be published.
   * Once available, omitting this option selects that adapter.
   */
  backend?: Live2DBackend
  coreUrl?: string
  fit?: ModelFit
  maxFps?: number
  retries?: number
  signal?: AbortSignal
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
  = ({ onError?: (error: Live2DError) => void } & (
    | { driver: LipSyncDriver }
    | {
      source: AudioNode
      profile: LipSyncProfileInput
      isSpeaking: () => boolean
    }
  ))

export interface Live2DInstance {
  readonly getState: () => Live2DRuntimeState
  readonly subscribe: (listener: () => void) => () => void
  motion: (group: string, index?: number) => Promise<void>
  expression: (id?: string) => Promise<void>
  focus: (x: number, y: number) => void
  getParameter: (id: string) => number
  setParameter: (id: string, value: number) => void
  setFit: (fit: ModelFit) => void
  addParameterDriver: (id: string, driver: ParameterDriver) => () => void
  addLipSync: (options: RuntimeLipSyncOptions) => () => void
  pause: () => void
  resume: () => void
  retry: () => Promise<void>
  dispose: () => void
}

type Listener = () => void
type Cleanup = () => void

interface RuntimeFeature {
  attach: (model: ModelHandle) => void
  detach: () => void
}

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
      'src must be a non-empty model3.json URL string.',
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

class ManagedFeature implements RuntimeFeature {
  private cleanup: Cleanup | undefined
  private generation = 0

  constructor(
    private readonly setup: (model: ModelHandle) => Cleanup | Promise<Cleanup>,
    private readonly report: (error: unknown) => void,
  ) {}

  attach(model: ModelHandle) {
    this.detach()
    const generation = this.generation
    try {
      const result = this.setup(model)
      if (result instanceof Promise) {
        void result.then((cleanup) => {
          if (generation !== this.generation) {
            cleanup()
            return
          }
          this.cleanup = once(cleanup)
        }).catch((error) => {
          if (generation === this.generation)
            this.report(error)
        })
      }
      else {
        this.cleanup = once(result)
      }
    }
    catch (error) {
      this.report(error)
    }
  }

  detach() {
    this.generation++
    this.cleanup?.()
    this.cleanup = undefined
  }
}

export class Live2DRuntime implements Live2DInstance {
  private abortController: AbortController | undefined
  private disposed = false
  private features: RuntimeFeature[] = []
  private fit: ModelFit
  private listeners = new Set<Listener>()
  private model: ModelHandle | undefined
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

  private resolveBackend() {
    if (this.options.backend)
      return this.options.backend
    throw new Live2DError(
      'adapter-error',
      'The default cubism-webgl backend is not available until its redistribution terms are confirmed. Pass an explicit backend for local development.',
    )
  }

  private teardown() {
    this.abortController?.abort()
    this.abortController = undefined
    cancelAnimationFrame(this.resizeAnimationFrame)
    this.resizeAnimationFrame = 0
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
    const backend = this.resolveBackend()
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
      await ensureCubismCore(this.options.coreUrl)
      if (controller.signal.aborted)
        throw controller.signal.reason

      this.updateState({ loadingStage: 'stage' })
      const rect = this.options.container.getBoundingClientRect()
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

      const onVisibilityChange = () => {
        if (document.hidden) {
          stage.pause()
        }
        else {
          elapsedMs = 0
          frameCount = 0
          longFrameCount = 0
          stage.resume()
          scheduleResize()
        }
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      this.stageCleanup.push(() => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      })

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
        return await backend.loadModel(stage, this.options.src, { signal })
      }
      catch (error) {
        if (signal.aborted)
          throw error
        lastError = asLive2DError(error, 'model-load-failed')
        if (lastError.code === 'invalid-props' || attempt === retries)
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

  motion(group: string, index?: number) {
    return this.requireModel().motion(group, index)
  }

  expression(id?: string) {
    return this.requireModel().expression(id)
  }

  focus(x: number, y: number) {
    this.requireModel().focus(x, y)
  }

  getParameter(id: string) {
    return this.requireModel().getParameter(id)
  }

  setParameter(id: string, value: number) {
    this.requireModel().setParameter(id, value)
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
      return model.onAfterMotionUpdate(() => {
        model.setParameter(id, driver.getValue())
      })
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
            motionValue: model.getParameter(MOUTH_PARAMETER_ID),
            mouthOpen: speaking ? driver.getMouthOpen() : 0,
            speaking,
          })
          if (value !== null)
            model.setParameter(MOUTH_PARAMETER_ID, value)
        }
        catch (error) {
          failed = true
          reportLipSyncError(error)
        }
      })
      return () => {
        unsubscribe()
        sourceConnection?.dispose()
      }
    }, reportLipSyncError)
    return this.addFeature(feature)
  }

  pause() {
    this.stage?.pause()
  }

  resume() {
    this.stage?.resume()
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
