import type {
  Live2DCanvasAccessibility,
  StageHandle,
  StageOptions,
} from '../../core/contract'
import type { CubismBenchmarkStageDiagnostics } from './diagnostics'
import type { StageFrameDriver } from './types'
import { Live2DError } from '../../core/errors'
import { createGpuTimer, measureSync } from './diagnostics'

interface StageInternals {
  canvas: HTMLCanvasElement
  gl: WebGL2RenderingContext
  disposed: boolean
  diagnostics?: CubismBenchmarkStageDiagnostics
  attachDriver: (driver: StageFrameDriver) => () => void
  reportError: (error: Live2DError) => void
}

const internalsByStage = new WeakMap<StageHandle, StageInternals>()

// Every call fully re-describes the canvas, so switching between decorative,
// image and absent leaves no attribute behind from the previous value.
function applyAccessibility(
  canvas: HTMLCanvasElement,
  accessibility: Live2DCanvasAccessibility | undefined,
) {
  for (const name of ['aria-describedby', 'aria-hidden', 'aria-label', 'role'])
    canvas.removeAttribute(name)
  canvas.textContent = ''
  if (!accessibility)
    return
  if (accessibility.mode === 'decorative') {
    canvas.setAttribute('aria-hidden', 'true')
    canvas.setAttribute('role', 'presentation')
    return
  }
  canvas.setAttribute('aria-label', accessibility.label)
  canvas.setAttribute('role', 'img')
  if (accessibility.describedBy)
    canvas.setAttribute('aria-describedby', accessibility.describedBy)
  canvas.textContent = accessibility.fallbackText ?? accessibility.label
}

function once(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function normalizeError(error: unknown) {
  return error instanceof Live2DError
    ? error
    : new Live2DError(
        'render-error',
        error instanceof Error ? error.message : String(error),
        { cause: error, details: { backend: 'cubism-webgl' } },
      )
}

export function getStageInternals(stage: StageHandle) {
  const internals = internalsByStage.get(stage)
  if (!internals || internals.disposed) {
    throw new Live2DError(
      'adapter-error',
      'The StageHandle was not created by the active cubism-webgl adapter.',
      { details: { backend: 'cubism-webgl' } },
    )
  }
  return internals
}

export function createWebGLStage(
  element: HTMLElement,
  options: StageOptions,
  diagnostics?: CubismBenchmarkStageDiagnostics,
): StageHandle {
  if (typeof window === 'undefined')
    throw new Live2DError('browser-only', 'cubism-webgl can only run in a browser.')

  const canvas = document.createElement('canvas')
  applyAccessibility(canvas, options.accessibility)
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  })
  if (!gl) {
    throw new Live2DError(
      'webgl-unsupported',
      'WebGL2 is required by cubism-webgl.',
      { details: { backend: 'cubism-webgl' } },
    )
  }
  diagnostics?.changeResource('canvas', 1)
  diagnostics?.changeResource('context', 1)
  const gpuTimer = createGpuTimer(gl, diagnostics)

  let size = {
    height: Math.max(1, options.height),
    width: Math.max(1, options.width),
  }
  let resolution = options.resolution ?? 1
  let disposed = false
  let running = true
  let reportedError = false
  let animationFrame = 0
  let accumulatedFrameMs = 0
  let firstDrawReported = false
  let lastRenderTime: number | undefined
  let lastTickTime: number | undefined
  // Ordered: a model added later draws on top, the way addChild does.
  const drivers = new Set<StageFrameDriver>()
  const frameCallbacks = new Set<(deltaMs: number) => void>()
  const errorCallbacks = new Set<(error: Live2DError) => void>()
  const minFrameMs = options.maxFps ? 1_000 / options.maxFps : 0

  const resizeBuffer = () => {
    canvas.width = Math.max(1, Math.round(size.width * resolution))
    canvas.height = Math.max(1, Math.round(size.height * resolution))
    gl.viewport(0, 0, canvas.width, canvas.height)
    for (const driver of drivers)
      driver.resize(canvas.width, canvas.height)
  }

  const stopLoop = () => {
    running = false
    cancelAnimationFrame(animationFrame)
    animationFrame = 0
    accumulatedFrameMs = 0
    lastRenderTime = undefined
    lastTickTime = undefined
  }

  const reportError = (error: Live2DError) => {
    if (disposed || reportedError)
      return
    reportedError = true
    stopLoop()
    for (const callback of errorCallbacks)
      callback(error)
  }

  const updateDrivers = (deltaMs: number) => {
    const capped = Math.min(deltaMs, 100)
    for (const driver of drivers)
      driver.update(capped)
  }

  const clearFrame = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  const drawDrivers = () => {
    for (const driver of drivers)
      driver.draw()
  }

  const frame = (timestamp: number) => {
    if (!running || disposed)
      return
    animationFrame = requestAnimationFrame(frame)
    const tickDeltaMs = lastTickTime === undefined ? 0 : timestamp - lastTickTime
    lastTickTime = timestamp
    accumulatedFrameMs += tickDeltaMs
    // rAF timestamps often land just below exact refresh fractions such as
    // 16.667 ms. A small tolerance prevents a 60 FPS cap becoming 40 FPS on
    // 120 Hz displays, while the accumulator preserves the long-term rate.
    if (lastRenderTime !== undefined && accumulatedFrameMs < minFrameMs - 0.25)
      return
    const deltaMs = lastRenderTime === undefined ? 0 : timestamp - lastRenderTime
    lastRenderTime = timestamp
    // Keep only the fractional cadence remainder. Retaining an entire long
    // main-thread stall would make the loop render every refresh while it
    // tries to "catch up", temporarily violating maxFps.
    accumulatedFrameMs = minFrameMs
      ? accumulatedFrameMs >= minFrameMs * 2
        ? 0
        : Math.max(0, accumulatedFrameMs - minFrameMs)
      : 0
    try {
      if (!diagnostics) {
        updateDrivers(deltaMs)
        for (const callback of frameCallbacks)
          callback(deltaMs)
        clearFrame()
        drawDrivers()
      }
      else {
        diagnostics.framePhase('frameDelta', deltaMs)
        measureSync(diagnostics, 'frame', 'stageFrame', () => {
          updateDrivers(deltaMs)
          for (const callback of frameCallbacks)
            callback(deltaMs)
          clearFrame()
          gpuTimer?.begin()
          try {
            measureSync(diagnostics, 'frame', 'drawCpu', drawDrivers)
          }
          finally {
            gpuTimer?.end()
          }
        })
      }
      if (drivers.size > 0 && !firstDrawReported) {
        firstDrawReported = true
        diagnostics?.firstDraw()
      }
    }
    catch (error) {
      reportError(normalizeError(error))
    }
  }

  const onContextLost = (event: Event) => {
    event.preventDefault()
    reportError(new Live2DError(
      'render-error',
      'The WebGL context was lost. Call retry() to recreate the Live2D canvas.',
      { details: { backend: 'cubism-webgl' } },
    ))
  }

  canvas.style.display = 'block'
  canvas.style.height = '100%'
  // Without this, dragging the character scrolls the page on touch devices.
  canvas.style.touchAction = 'none'
  canvas.style.width = '100%'
  canvas.addEventListener('webglcontextlost', onContextLost)
  element.appendChild(canvas)
  resizeBuffer()

  let handle: StageHandle
  const stageInternals: StageInternals = {
    attachDriver(nextDriver) {
      drivers.add(nextDriver)
      nextDriver.resize(canvas.width, canvas.height)
      return once(() => {
        drivers.delete(nextDriver)
      })
    },
    canvas,
    diagnostics,
    disposed,
    gl,
    reportError,
  }

  const dispose = once(() => {
    disposed = true
    stageInternals.disposed = true
    stopLoop()
    drivers.clear()
    frameCallbacks.clear()
    errorCallbacks.clear()
    canvas.removeEventListener('webglcontextlost', onContextLost)
    gpuTimer?.poll()
    gpuTimer?.dispose()
    if (!gl.isContextLost())
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    canvas.width = 1
    canvas.height = 1
    canvas.remove()
    diagnostics?.changeResource('context', -1)
    diagnostics?.changeResource('canvas', -1)
    internalsByStage.delete(handle)
  })

  handle = {
    dispose,
    getResolution: () => resolution,
    getSize: () => ({ ...size }),
    onError(callback) {
      errorCallbacks.add(callback)
      return once(() => errorCallbacks.delete(callback))
    },
    onFrame(callback) {
      frameCallbacks.add(callback)
      return once(() => frameCallbacks.delete(callback))
    },
    pause: stopLoop,
    resize(width, height) {
      size = { height: Math.max(1, height), width: Math.max(1, width) }
      resizeBuffer()
    },
    resume() {
      if (disposed || reportedError || running)
        return
      running = true
      animationFrame = requestAnimationFrame(frame)
    },
    setAccessibility(accessibility) {
      applyAccessibility(canvas, accessibility)
    },
    setResolution(nextResolution) {
      if (!Number.isFinite(nextResolution) || nextResolution < 1) {
        throw new Live2DError(
          'invalid-props',
          'Stage resolution must be a finite number greater than or equal to 1.',
        )
      }
      resolution = nextResolution
      resizeBuffer()
    },
    toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect()
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      }
    },
  }
  internalsByStage.set(handle, stageInternals)
  animationFrame = requestAnimationFrame(frame)
  return handle
}
