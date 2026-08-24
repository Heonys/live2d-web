import type {
  Live2DBackend,
  LoadModelOptions,
  ModelHandle,
  MotionOptions,
  MotionPlaybackResult,
  StageHandle,
  StageOptions,
} from '../../core/contract'
import { Application } from '@pixi/app'
import { BatchRenderer } from '@pixi/core'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { Live2DError } from '../../core/errors'
import { resolveExpressionFade } from '../../core/expression-options'
import {
  hasMotionFadeOverride,
  resolveMotionFade,
  validateMotionOptions,
} from '../../core/motion-options'
import { PIXI_V6_TICKER_PRIORITY } from './tickerOrder'

interface CoreModelParameters {
  getParameterCount: () => number
  getParameterDefaultValue: (index: number) => number
  getParameterId: (index: number) => { getString?: () => string } | string
  getParameterMaximumValue: (index: number) => number
  getParameterMinimumValue: (index: number) => number
  getParameterValueById: (id: string) => number
  setParameterValueById: (id: string, value: number) => void
}

interface PixiStageInternals {
  app: Application
  canvas: HTMLCanvasElement
  disposed: boolean
  reportError: (error: Live2DError) => void
}

const stageInternals = new WeakMap<StageHandle, PixiStageInternals>()
let pixiConfigured = false

function ensurePixiConfigured() {
  if (pixiConfigured)
    return
  // Modular PIXI v6 does not register these renderer/ticker plugins for us.
  extensions.add(TickerPlugin, BatchRenderer)
  pixiConfigured = true
}

function asAdapterError(
  error: unknown,
  code: 'adapter-error' | 'model-load-failed' | 'render-error',
  details: import('../../core/errors').Live2DErrorDetails = { backend: 'pixi-v6' },
) {
  if (error instanceof Live2DError)
    return error
  return new Live2DError(
    code,
    error instanceof Error ? error.message : String(error),
    { cause: error, details },
  )
}

function idempotent(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function assertResolution(resolution: number) {
  if (!Number.isFinite(resolution) || resolution < 1) {
    throw new Live2DError(
      'invalid-props',
      'PIXI stage resolution must be a finite number greater than or equal to 1.',
      { details: { backend: 'pixi-v6' } },
    )
  }
}

function createStage(element: HTMLElement, options: StageOptions): StageHandle {
  if (typeof window === 'undefined') {
    throw new Live2DError(
      'browser-only',
      'The pixi-v6 adapter can only create a stage in a browser.',
    )
  }
  ensurePixiConfigured()

  let resolution = options.resolution ?? 1
  assertResolution(resolution)
  const size = {
    height: Math.max(1, options.height),
    width: Math.max(1, options.width),
  }
  const frameCallbacks = new Set<(deltaMs: number) => void>()
  const errorCallbacks = new Set<(error: Live2DError) => void>()
  let reportedError = false
  let disposed = false

  const app = new Application({
    autoDensity: false,
    backgroundAlpha: 0,
    height: size.height * resolution,
    preserveDrawingBuffer: false,
    resolution: 1,
    width: size.width * resolution,
  })
  const canvas = app.view as HTMLCanvasElement

  const reportError = (error: Live2DError) => {
    if (reportedError || disposed)
      return
    reportedError = true
    app.ticker.stop()
    for (const callback of errorCallbacks)
      callback(error)
  }

  const runFrameCallbacks = () => {
    for (const callback of frameCallbacks) {
      try {
        callback(app.ticker.deltaMS)
      }
      catch (error) {
        reportError(asAdapterError(error, 'render-error'))
        return
      }
    }
  }
  const guardedRender = () => {
    try {
      app.render()
    }
    catch (error) {
      reportError(asAdapterError(error, 'render-error'))
    }
  }
  const onContextLost = (event: Event) => {
    event.preventDefault()
    reportError(new Live2DError(
      'render-error',
      'The WebGL context was lost. Retry to recreate the Live2D canvas.',
      { details: { backend: 'pixi-v6' } },
    ))
  }

  app.ticker.remove(app.render, app)
  app.ticker.add(runFrameCallbacks, undefined, PIXI_V6_TICKER_PRIORITY.frame)
  app.ticker.add(guardedRender, undefined, PIXI_V6_TICKER_PRIORITY.render)
  if (options.maxFps !== undefined) {
    if (!Number.isFinite(options.maxFps) || options.maxFps <= 0) {
      app.destroy(true, { children: true })
      throw new Live2DError(
        'invalid-props',
        'maxFps must be a finite number greater than 0.',
      )
    }
    app.ticker.maxFPS = Math.max(1, Math.round(options.maxFps))
  }

  app.stage.scale.set(resolution)
  canvas.style.display = 'block'
  canvas.style.height = '100%'
  canvas.style.objectFit = 'cover'
  canvas.style.touchAction = 'none'
  canvas.style.width = '100%'
  canvas.addEventListener('webglcontextlost', onContextLost)
  element.appendChild(canvas)

  let handle: StageHandle
  let internalRecord: PixiStageInternals
  const dispose = idempotent(() => {
    disposed = true
    internalRecord.disposed = true
    frameCallbacks.clear()
    errorCallbacks.clear()
    canvas.removeEventListener('webglcontextlost', onContextLost)
    app.ticker.remove(runFrameCallbacks)
    app.ticker.remove(guardedRender)
    app.destroy(true, { children: true })
    stageInternals.delete(handle)
  })

  handle = {
    dispose,
    getResolution: () => resolution,
    getSize: () => ({ ...size }),
    onError(callback) {
      if (disposed)
        return () => {}
      errorCallbacks.add(callback)
      return idempotent(() => errorCallbacks.delete(callback))
    },
    onFrame(callback) {
      if (disposed)
        return () => {}
      frameCallbacks.add(callback)
      return idempotent(() => frameCallbacks.delete(callback))
    },
    pause() {
      if (!disposed)
        app.ticker.stop()
    },
    resize(width, height) {
      if (disposed)
        return
      size.width = Math.max(1, width)
      size.height = Math.max(1, height)
      app.renderer.resize(size.width * resolution, size.height * resolution)
      app.stage.scale.set(resolution)
    },
    resume() {
      if (!disposed && !reportedError)
        app.ticker.start()
    },
    setResolution(nextResolution) {
      assertResolution(nextResolution)
      if (disposed || Math.abs(nextResolution - resolution) < 0.001)
        return
      resolution = nextResolution
      app.renderer.resize(size.width * resolution, size.height * resolution)
      app.stage.scale.set(resolution)
    },
    toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width || 1
      const height = rect.height || 1
      // Stage space is CSS pixels, the same space getSize() reports. The model
      // handle scales into PIXI global space, which also carries `resolution`.
      return {
        x: (clientX - rect.left) / width * size.width,
        y: (clientY - rect.top) / height * size.height,
      }
    },
  }

  internalRecord = {
    app,
    canvas,
    disposed,
    reportError,
  }
  stageInternals.set(handle, internalRecord)
  return handle
}

async function loadModel(
  stage: StageHandle,
  url: string,
  options: LoadModelOptions = {},
): Promise<ModelHandle> {
  const internals = stageInternals.get(stage)
  if (!internals || internals.disposed) {
    throw new Live2DError(
      'adapter-error',
      'The StageHandle was not created by the active pixi-v6 adapter.',
      { details: { backend: 'pixi-v6' } },
    )
  }
  if (options.idleMotion && typeof options.idleMotion === 'object') {
    throw new Live2DError(
      'invalid-props',
      'The repository-only pixi-v6 backend does not support weighted idle motion.',
      { details: { backend: 'pixi-v6' } },
    )
  }
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Live2DError(
      'invalid-props',
      'The model source must be a non-empty model3.json URL string.',
    )
  }
  if (options.signal?.aborted)
    throw options.signal.reason
  if (!window.Live2DCubismCore) {
    throw new Live2DError(
      'core-missing',
      'Live2D Cubism Core must be loaded before the pixi-v6 adapter loads a model.',
      { details: { assetType: 'core', backend: 'pixi-v6' } },
    )
  }

  // pixi-live2d-display reads `window` during module evaluation. Keep the
  // adapter entry SSR-safe and load it only when a browser model is requested.
  const { Live2DFactory, Live2DModel } = await import('pixi-live2d-display/cubism4')
  // Registration prevents global window.PIXI detection. autoUpdate remains
  // disabled, so the model still uses only the Application ticker below.
  Live2DModel.registerTicker(Ticker)
  const model = new Live2DModel()
  const modelUrl = new URL(url, window.location.href).href
  try {
    await Live2DFactory.setupLive2DModel(model, modelUrl, {
      autoInteract: false,
      autoUpdate: false,
    })
  }
  catch (error) {
    try {
      model.destroy()
    }
    catch {
      // setup may fail before the internal model exists
    }
    throw asAdapterError(error, 'model-load-failed', {
      assetType: 'model3',
      backend: 'pixi-v6',
      url: modelUrl,
    })
  }

  if (options.signal?.aborted || internals.disposed) {
    model.destroy()
    throw options.signal?.reason ?? new Live2DError(
      'adapter-error',
      'The PIXI stage was disposed while the model was loading.',
      { details: { backend: 'pixi-v6' } },
    )
  }

  const initialSize = { height: model.height, width: model.width }
  const afterMotionCallbacks = new Set<(deltaMs: number) => void>()
  const manualParameters = new Map<string, number>()
  const frameWatchers = new Set<() => void>()
  let lastMotionUpdateMs = Number.NaN
  let disposed = false

  // PIXI global space carries the stage scale, which is the stage resolution.
  const toGlobal = (x: number, y: number) => ({
    x: x * internals.app.stage.scale.x,
    y: y * internals.app.stage.scale.y,
  })

  const onAfterMotionUpdate = () => {
    const timestamp = performance.now()
    const deltaMs = Number.isNaN(lastMotionUpdateMs)
      ? 0
      : timestamp - lastMotionUpdateMs
    lastMotionUpdateMs = timestamp
    // Same order as the default adapter: manual overrides land after the motion
    // update, then drivers run, then the Core update consumes both.
    if (manualParameters.size > 0) {
      const core = model.internalModel.coreModel as unknown as CoreModelParameters
      for (const [id, value] of manualParameters)
        core.setParameterValueById(id, value)
    }
    for (const callback of afterMotionCallbacks)
      callback(deltaMs)
    for (const watcher of [...frameWatchers])
      watcher()
  }
  const updateModel = () => {
    try {
      model.update(internals.app.ticker.deltaMS)
    }
    catch (error) {
      internals.reportError(asAdapterError(error, 'render-error'))
    }
  }

  model.anchor.set(0.5, 0.5)
  model.internalModel.on('afterMotionUpdate', onAfterMotionUpdate)
  internals.app.stage.addChild(model)
  internals.app.ticker.add(updateModel, undefined, PIXI_V6_TICKER_PRIORITY.model)

  const dispose = idempotent(() => {
    disposed = true
    afterMotionCallbacks.clear()
    manualParameters.clear()
    for (const watcher of [...frameWatchers])
      watcher()
    frameWatchers.clear()
    model.internalModel.off('afterMotionUpdate', onAfterMotionUpdate)
    if (!internals.disposed) {
      internals.app.ticker.remove(updateModel)
      internals.app.stage.removeChild(model)
    }
    model.destroy()
  })

  const internal = model.internalModel as unknown as {
    hitAreas?: Record<string, unknown>
    motionManager?: {
      currentGroup?: string
      currentIndex?: number
      expressionManager?: { resetExpression: () => void }
      isFinished?: () => boolean
      off?: (event: string, listener: () => void) => void
      on?: (event: string, listener: () => void) => void
      playing?: boolean
    }
    settings?: {
      expressions?: { Name?: string, name?: string }[]
      motions?: Record<string, unknown[]>
    }
  }

  const playMotion = async (
    group: string,
    index?: number,
    options?: MotionOptions,
  ): Promise<MotionPlaybackResult> => {
    if (disposed)
      return { status: 'disposed' }
    validateMotionOptions(options)
    const fade = resolveMotionFade(options)
    if (hasMotionFadeOverride(fade)) {
      throw new Live2DError(
        'invalid-props',
        'The repository-only pixi-v6 backend does not support motion fade overrides.',
        { details: { backend: 'pixi-v6' } },
      )
    }
    const priority = { force: 3, idle: 1, normal: 2 }[options?.priority ?? 'force']
    const started = await model.motion(group, index, priority)
    if (disposed)
      return { status: 'disposed' }
    if (started === false)
      return { status: 'skipped' }
    const manager = internal.motionManager
    if (!manager?.on)
      return { status: 'completed' }
    // motionFinish carries no motion identity, so currentGroup/currentIndex
    // identify whether this playback completed or another one replaced it.
    const ownGroup = manager.currentGroup
    const ownIndex = manager.currentIndex
    const superseded = () => manager.currentGroup !== ownGroup
      || manager.currentIndex !== ownIndex
    return new Promise<MotionPlaybackResult>((resolve) => {
      let check = () => {}
      const done = (status: MotionPlaybackResult['status']) => {
        manager.off?.('motionFinish', check)
        manager.off?.('destroy', check)
        frameWatchers.delete(check)
        resolve({ status })
      }
      check = () => {
        if (disposed)
          done('disposed')
        else if (superseded())
          done('interrupted')
        else if (manager.isFinished?.() !== false)
          done('completed')
      }
      manager.on?.('motionFinish', check)
      manager.on?.('destroy', check)
      frameWatchers.add(check)
      check()
    })
  }

  return {
    clearExpression() {
      if (!disposed)
        internal.motionManager?.expressionManager?.resetExpression()
    },
    clearParameter(id) {
      manualParameters.delete(id)
    },
    dispose,
    async expression(id, options) {
      const fade = resolveExpressionFade(options)
      if (fade.fadeInSeconds !== undefined || fade.fadeOutSeconds !== undefined) {
        throw new Live2DError(
          'invalid-props',
          'The repository-only pixi-v6 backend does not support expression fade overrides.',
          { details: { backend: 'pixi-v6' } },
        )
      }
      if (!disposed)
        await model.expression(id)
    },
    focus(x, y) {
      if (!disposed) {
        const point = toGlobal(x, y)
        model.focus(point.x, point.y)
      }
    },
    getIntrinsicSize: () => ({ ...initialSize }),
    getModelInfo() {
      const core = model.internalModel.coreModel as unknown as CoreModelParameters
      const motions: Record<string, number> = {}
      for (const [group, list] of Object.entries(internal.settings?.motions ?? {}))
        motions[group] = Array.isArray(list) ? list.length : 0
      return {
        expressions: (internal.settings?.expressions ?? [])
          .map(entry => entry.Name ?? entry.name ?? '')
          .filter(name => name !== ''),
        hitAreas: Object.keys(internal.hitAreas ?? {}),
        motions,
        parameters: Array.from({ length: core.getParameterCount() }, (_, index) => {
          const id = core.getParameterId(index)
          return {
            defaultValue: core.getParameterDefaultValue(index),
            id: typeof id === 'string' ? id : id.getString?.() ?? String(id),
            maximum: core.getParameterMaximumValue(index),
            minimum: core.getParameterMinimumValue(index),
          }
        }),
      }
    },
    getParameter(id) {
      if (disposed)
        return 0
      const core = model.internalModel.coreModel as unknown as CoreModelParameters
      return core.getParameterValueById(id)
    },
    hitTest(x, y) {
      if (disposed)
        return []
      const point = toGlobal(x, y)
      return model.hitTest(point.x, point.y)
    },
    isMotionPlaying() {
      return !disposed && internal.motionManager?.isFinished?.() === false
    },
    async motion(group, index, options) {
      await playMotion(group, index, options)
    },
    playMotion,
    onAfterMotionUpdate(callback) {
      if (disposed)
        return () => {}
      afterMotionCallbacks.add(callback)
      return idempotent(() => afterMotionCallbacks.delete(callback))
    },
    setParameter(id, value) {
      if (disposed)
        return
      // Recorded so the next motion update cannot overwrite it, matching the
      // documented "persists until clearParameter()" behaviour.
      manualParameters.set(id, value)
      const core = model.internalModel.coreModel as unknown as CoreModelParameters
      core.setParameterValueById(id, value)
    },
    setTransform(transform) {
      if (disposed)
        return
      model.position.set(transform.x, transform.y)
      model.scale.set(transform.scale)
    },
  }
}

export const pixiV6: Live2DBackend = {
  createStage,
  loadModel,
}
