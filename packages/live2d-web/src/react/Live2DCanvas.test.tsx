// @vitest-environment jsdom

import type {
  Live2DBackend,
  ModelHandle,
  StageHandle,
  StageOptions,
} from '../core/contract'
import type { Live2DModelController } from './controller'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Profiler, StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLive2DCanvas, useLive2DModel, useParameterDriver } from './hooks'
import { Live2DCanvas } from './Live2DCanvas'
import { Live2DModel } from './Live2DModel'

interface FakeHarness {
  backend: Live2DBackend
  events: string[]
  frameCallbacks: Set<(deltaMs: number) => void>
  renderErrors: Set<(error: import('../core/errors').Live2DError) => void>
  models: ModelHandle[]
  stages: StageHandle[]
}

function createFakeHarness(loadModel?: () => Promise<ModelHandle>): FakeHarness {
  const events: string[] = []
  const frameCallbacks = new Set<(deltaMs: number) => void>()
  const renderErrors = new Set<(error: import('../core/errors').Live2DError) => void>()
  const models: ModelHandle[] = []
  const stages: StageHandle[] = []

  const makeModel = (): ModelHandle => {
    let disposed = false
    const afterMotion = new Set<(deltaMs: number) => void>()
    const model: ModelHandle = {
      clearExpression: () => {},
      clearParameter: () => {},
      dispose: () => {
        if (disposed)
          return
        disposed = true
        events.push('model:dispose')
      },
      expression: async () => {},
      focus: () => {},
      getIntrinsicSize: () => ({ height: 1000, width: 500 }),
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
      getParameter: () => 0,
      hitTest: () => [],
      isMotionPlaying: () => false,
      motion: async () => {},
      onAfterMotionUpdate: (callback) => {
        afterMotion.add(callback)
        return () => {
          if (afterMotion.delete(callback))
            events.push('driver:dispose')
        }
      },
      setParameter: (_id, value) => events.push(`parameter:${value}`),
      setTransform: () => {},
    }
    models.push(model)
    return model
  }

  const backend: Live2DBackend = {
    createStage(_element: HTMLElement, options: StageOptions) {
      events.push('stage:create')
      let disposed = false
      let resolution = options.resolution ?? 1
      let size = { height: options.height, width: options.width }
      const stage: StageHandle = {
        dispose() {
          if (disposed)
            return
          disposed = true
          events.push('stage:dispose')
        },
        getResolution: () => resolution,
        getSize: () => size,
        onError(callback) {
          renderErrors.add(callback)
          return () => renderErrors.delete(callback)
        },
        onFrame(callback) {
          frameCallbacks.add(callback)
          return () => frameCallbacks.delete(callback)
        },
        pause: () => events.push('stage:pause'),
        resize(width, height) {
          size = { height, width }
          events.push('stage:resize')
        },
        resume: () => events.push('stage:resume'),
        setResolution(value) {
          resolution = value
          events.push(`resolution:${value}`)
        },
        toWorld: (x, y) => ({ x, y }),
      }
      stages.push(stage)
      return stage
    },
    async loadModel() {
      events.push('model:load')
      return loadModel ? await loadModel() : makeModel()
    },
  }

  return { backend, events, frameCallbacks, models, renderErrors, stages }
}

function ParameterDriver() {
  useParameterDriver('ParamMouthOpenY', () => 0.5)
  return null
}

function Status() {
  const state = useLive2DCanvas()
  return <output>{state.status}</output>
}

function ControllerObserver({
  onController,
}: {
  onController: (controller: Live2DModelController) => void
}) {
  const controller = useLive2DModel()
  useEffect(() => {
    if (controller)
      onController(controller)
  }, [controller, onController])
  return null
}

describe('live2DCanvas lifecycle', () => {
  beforeEach(() => {
    window.Live2DCubismCore = {}
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 720,
      height: 720,
      left: 0,
      right: 1280,
      toJSON: () => ({}),
      top: 0,
      width: 1280,
      x: 0,
      y: 0,
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(performance.now())
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    cleanup()
    delete window.Live2DCubismCore
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is StrictMode-safe and enforces feature → model → stage cleanup', async () => {
    const harness = createFakeHarness()
    for (let index = 0; index < 20; index++) {
      const view = render(
        <StrictMode>
          <Live2DCanvas backend={harness.backend}>
            <Live2DModel src="/hiyori.model3.json">
              <ParameterDriver />
            </Live2DModel>
            <Status />
          </Live2DCanvas>
        </StrictMode>,
      )

      await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
      view.unmount()
    }

    const finalDriver = harness.events.lastIndexOf('driver:dispose')
    const finalModel = harness.events.lastIndexOf('model:dispose')
    const finalStage = harness.events.lastIndexOf('stage:dispose')
    expect(finalDriver).toBeGreaterThan(-1)
    expect(finalDriver).toBeLessThan(finalModel)
    expect(finalModel).toBeLessThan(finalStage)
  })

  it('shares a lifecycle-safe model controller between the hook and onLoad', async () => {
    const harness = createFakeHarness()
    let loaded: Live2DModelController | undefined
    let observed: Live2DModelController | undefined
    const view = render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel
          src="/hiyori.model3.json"
          onLoad={(controller) => { loaded = controller }}
        >
          <ControllerObserver onController={(controller) => { observed = controller }} />
        </Live2DModel>
      </Live2DCanvas>,
    )

    await waitFor(() => expect(observed).toBeDefined())
    expect(observed).toBe(loaded)
    expect(Object.keys(observed!)).toEqual([
      'clearExpression',
      'clearParameter',
      'expression',
      'focus',
      'getModelInfo',
      'getParameter',
      'isMotionPlaying',
      'motion',
      'setParameter',
    ])
    expect('dispose' in observed!).toBe(false)
    expect('setTransform' in observed!).toBe(false)
    expect('onAfterMotionUpdate' in observed!).toBe(false)
    expect(document.querySelector('[data-live2d-canvas]')).not.toBeNull()

    view.unmount()
    expect(() => observed!.setParameter('ParamAngleX', 1)).toThrow(
      expect.objectContaining({ code: 'invalid-props' }),
    )
    await expect(observed!.motion('Idle')).rejects.toMatchObject({
      code: 'invalid-props',
    })
  })

  it('disposes a model that resolves after unmount', async () => {
    let resolveModel!: (model: ModelHandle) => void
    const pending = new Promise<ModelHandle>((resolve) => {
      resolveModel = resolve
    })
    const lateHarness = createFakeHarness(() => pending)
    const modelHarness = createFakeHarness()
    const view = render(
      <Live2DCanvas backend={lateHarness.backend}>
        <Live2DModel src="/slow.model3.json" />
      </Live2DCanvas>,
    )

    await waitFor(() => expect(lateHarness.events).toContain('model:load'))
    view.unmount()
    const lateModel = await modelHarness.backend.loadModel(
      modelHarness.backend.createStage(document.body, { height: 1, width: 1 }),
      '/late.model3.json',
    )
    resolveModel(lateModel)

    await waitFor(() => expect(modelHarness.events).toContain('model:dispose'))
  })

  it('rejects a second model with invalid-tree', async () => {
    const harness = createFakeHarness()
    render(
      <Live2DCanvas
        backend={harness.backend}
        errorFallback={error => <div>{error.code}</div>}
      >
        <Live2DModel src="/first.model3.json" />
        <Live2DModel src="/second.model3.json" />
      </Live2DCanvas>,
    )

    await waitFor(() => expect(screen.getByText('invalid-tree')).toBeTruthy())
  })

  it('recreates the whole stage when retry is requested', async () => {
    const harness = createFakeHarness()
    render(
      <Live2DCanvas
        backend={harness.backend}
        errorFallback={(error, retry) => (
          <button type="button" onClick={retry}>{error.code}</button>
        )}
      >
        <Live2DModel src="/hiyori.model3.json" />
      </Live2DCanvas>,
    )
    await waitFor(() => expect(harness.stages).toHaveLength(1))

    const { Live2DError } = await import('../core/errors')
    act(() => {
      for (const callback of harness.renderErrors)
        callback(new Live2DError('render-error', 'lost'))
    })
    fireEvent.click(await screen.findByRole('button', { name: 'render-error' }))

    await waitFor(() => expect(harness.stages).toHaveLength(2))
    expect(harness.events.filter(event => event.startsWith('stage:'))).toEqual([
      'stage:create',
      'stage:dispose',
      'stage:create',
    ])
  })

  it('releases the partial stage when initial model loading fails', async () => {
    const { Live2DError } = await import('../core/errors')
    const harness = createFakeHarness(async () => {
      throw new Live2DError('model-load-failed', 'missing model')
    })
    render(
      <Live2DCanvas
        backend={harness.backend}
        errorFallback={error => <div>{error.code}</div>}
      >
        <Live2DModel retries={0} src="/missing.model3.json" />
      </Live2DCanvas>,
    )

    await waitFor(() => expect(screen.getByText('model-load-failed')).toBeTruthy())
    expect(harness.events).toEqual([
      'stage:create',
      'model:load',
      'stage:dispose',
    ])
  })

  it('coalesces resize observations and pauses while hidden', async () => {
    const harness = createFakeHarness()
    let width = 1280
    let resizeCallback: ResizeObserverCallback | undefined
    let scheduledFrame: FrameRequestCallback | undefined
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      bottom: 720,
      height: 720,
      left: 0,
      right: width,
      toJSON: () => ({}),
      top: 0,
      width,
      x: 0,
      y: 0,
    }))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      scheduledFrame = callback
      return 1
    })
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }

      disconnect() {}
      observe() {}
      unobserve() {}
    })

    render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/hiyori.model3.json" />
      </Live2DCanvas>,
    )
    await waitFor(() => expect(harness.stages).toHaveLength(1))

    width = 900
    resizeCallback?.([], {} as ResizeObserver)
    resizeCallback?.([], {} as ResizeObserver)
    const firstResizeFrame = scheduledFrame as FrameRequestCallback | undefined
    scheduledFrame = undefined
    act(() => firstResizeFrame?.(performance.now()))
    expect(harness.events.filter(event => event === 'stage:resize')).toHaveLength(1)

    width = 900.3
    resizeCallback?.([], {} as ResizeObserver)
    const subpixelResizeFrame = scheduledFrame as FrameRequestCallback | undefined
    scheduledFrame = undefined
    act(() => subpixelResizeFrame?.(performance.now()))
    expect(harness.events.filter(event => event === 'stage:resize')).toHaveLength(1)

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    fireEvent(document, new Event('visibilitychange'))
    expect(harness.events).toContain('stage:pause')
    expect(harness.events).toContain('stage:resume')
  })

  it('downshifts automatic quality without rendering React per frame', async () => {
    const harness = createFakeHarness()
    let commits = 0
    render(
      <Profiler id="stage" onRender={() => commits++}>
        <Live2DCanvas
          backend={harness.backend}
          quality={{
            mobileMaxResolution: 2,
            mobilePixelBudget: 10_000_000,
            sampleWindowMs: 100,
          }}
        >
          <Live2DModel src="/hiyori.model3.json" />
        </Live2DCanvas>
      </Profiler>,
    )
    await waitFor(() => expect(harness.frameCallbacks.size).toBe(1))
    const commitsBeforeFrames = commits

    act(() => {
      for (const callback of harness.frameCallbacks) {
        callback(10)
        callback(10)
        callback(10)
      }
    })
    expect(commits).toBe(commitsBeforeFrames)

    act(() => {
      for (const callback of harness.frameCallbacks) {
        callback(40)
        callback(40)
        callback(40)
      }
    })

    expect(harness.events).toContain('resolution:1.75')
    expect(commits - commitsBeforeFrames).toBe(1)
  })

  it('rejects quality and resolution used together at runtime', async () => {
    const harness = createFakeHarness()
    const invalidQuality = {
      quality: 'auto',
      resolution: 1,
    } as unknown as import('./Live2DCanvas').Live2DCanvasQualityProps

    render(
      <Live2DCanvas
        backend={harness.backend}
        {...invalidQuality}
        errorFallback={error => <div>{error.code}</div>}
      >
        <Live2DModel src="/hiyori.model3.json" />
      </Live2DCanvas>,
    )

    await waitFor(() => expect(screen.getByText('invalid-props')).toBeTruthy())
    expect(harness.stages).toHaveLength(0)
  })
})
