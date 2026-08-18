import type {
  Live2DBackend,
  LoadModelOptions,
  ModelHandle,
  StageHandle,
  StageOptions,
} from '../../core/contract'
import { Application } from '@pixi/app'
import { BatchRenderer } from '@pixi/core'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { Live2DError } from '../../core/errors'
import { PIXI_V6_TICKER_PRIORITY } from './tickerOrder'

interface CoreModelParameters {
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
      return {
        x: (clientX - rect.left) / width * canvas.width,
        y: (clientY - rect.top) / height * canvas.height,
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
  let lastMotionUpdateMs = Number.NaN
  let disposed = false

  const onAfterMotionUpdate = () => {
    const timestamp = performance.now()
    const deltaMs = Number.isNaN(lastMotionUpdateMs)
      ? 0
      : timestamp - lastMotionUpdateMs
    lastMotionUpdateMs = timestamp
    for (const callback of afterMotionCallbacks)
      callback(deltaMs)
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
    model.internalModel.off('afterMotionUpdate', onAfterMotionUpdate)
    if (!internals.disposed) {
      internals.app.ticker.remove(updateModel)
      internals.app.stage.removeChild(model)
    }
    model.destroy()
  })

  return {
    // pixi-live2d-display writes are already transient: the next motion update
    // overwrites them, so there is no persistent override entry to remove.
    clearParameter() {},
    dispose,
    async expression(id) {
      if (!disposed)
        await model.expression(id)
    },
    focus(x, y) {
      if (!disposed)
        model.focus(x, y)
    },
    getIntrinsicSize: () => ({ ...initialSize }),
    getParameter(id) {
      if (disposed)
        return 0
      const core = model.internalModel.coreModel as unknown as CoreModelParameters
      return core.getParameterValueById(id)
    },
    async motion(group, index) {
      if (!disposed)
        await model.motion(group, index)
    },
    onAfterMotionUpdate(callback) {
      if (disposed)
        return () => {}
      afterMotionCallbacks.add(callback)
      return idempotent(() => afterMotionCallbacks.delete(callback))
    },
    setParameter(id, value) {
      if (disposed)
        return
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
