// @vitest-environment jsdom

import type {
  Live2DBackend,
  ModelHandle,
  StageHandle,
  StageOptions,
} from './contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Live2DError } from './errors'
import { createLive2D } from './runtime'

interface RuntimeHarness {
  afterMotionCallbacks: Set<(deltaMs: number) => void>
  backend: Live2DBackend
  events: string[]
  renderErrors: Set<(error: Live2DError) => void>
  resolvePendingModel?: (model: ModelHandle) => void
}

function createRuntimeHarness(pending = false): RuntimeHarness {
  const afterMotionCallbacks = new Set<(deltaMs: number) => void>()
  const events: string[] = []
  const renderErrors = new Set<(error: Live2DError) => void>()
  let resolvePendingModel: ((model: ModelHandle) => void) | undefined
  const pendingModel = pending
    ? new Promise<ModelHandle>((resolve) => {
        resolvePendingModel = resolve
      })
    : undefined

  const createModel = (): ModelHandle => {
    let disposed = false
    const parameters = new Map<string, number>()
    return {
      clearExpression: () => {},
      clearParameter(id) {
        parameters.delete(id)
        events.push(`clearParameter:${id}`)
      },
      dispose() {
        if (disposed)
          return
        disposed = true
        events.push('model:dispose')
      },
      async expression(id) {
        events.push(`expression:${id ?? 'random'}`)
      },
      focus(x, y) {
        events.push(`focus:${x}:${y}`)
      },
      getIntrinsicSize: () => ({ height: 1_000, width: 500 }),
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
      getParameter: id => parameters.get(id) ?? 0,
      hitTest: () => [],
      isMotionPlaying: () => false,
      async motion(group, index) {
        events.push(`motion:${group}:${index ?? 'random'}`)
      },
      onAfterMotionUpdate(callback) {
        afterMotionCallbacks.add(callback)
        return () => {
          if (afterMotionCallbacks.delete(callback))
            events.push('feature:dispose')
        }
      },
      setParameter(id, value) {
        parameters.set(id, value)
        events.push(`parameter:${id}:${value}`)
      },
      setTransform(transform) {
        events.push(`transform:${transform.scale}:${transform.x}:${transform.y}`)
      },
    }
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
        getSize: () => ({ ...size }),
        onError(callback) {
          renderErrors.add(callback)
          return () => renderErrors.delete(callback)
        },
        onFrame: () => () => {},
        pause: () => events.push('stage:pause'),
        resize(width, height) {
          size = { height, width }
        },
        resume: () => events.push('stage:resume'),
        setResolution(value) {
          resolution = value
        },
        toWorld: (x, y) => ({ x, y }),
      }
      return stage
    },
    async loadModel() {
      events.push('model:load')
      return pendingModel ?? createModel()
    },
  }

  return {
    afterMotionCallbacks,
    backend,
    events,
    renderErrors,
    resolvePendingModel: resolvePendingModel
      ? model => resolvePendingModel!(model)
      : undefined,
  }
}

describe('createLive2D', () => {
  beforeEach(() => {
    window.Live2DCubismCore = {}
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 800,
      toJSON: () => ({}),
      top: 0,
      width: 800,
      x: 0,
      y: 0,
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    delete window.Live2DCubismCore
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('exposes a small vanilla API after the model is ready', async () => {
    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      fit: 'full',
      src: '/hiyori.model3.json',
    })

    expect(instance.getState().status).toBe('ready')
    await instance.motion('Tap@Body', 0)
    await instance.expression('smile')
    instance.focus(10, 20)
    instance.setParameter('ParamAngleX', 12)
    instance.setFit('upper-body')

    expect(harness.events).toContain('motion:Tap@Body:0')
    expect(harness.events).toContain('expression:smile')
    expect(harness.events).toContain('focus:10:20')
    expect(harness.events).toContain('parameter:ParamAngleX:12')
    expect(harness.events.filter(event => event.startsWith('transform:'))).toHaveLength(2)

    instance.clearParameter('ParamAngleX')
    expect(harness.events).toContain('clearParameter:ParamAngleX')
    expect(instance.getParameter('ParamAngleX')).toBe(0)
    instance.dispose()
  })

  it('returns ParamMouthOpenY to motion after the lip-sync handoff', async () => {
    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      src: '/hiyori.model3.json',
    })
    let speaking = true
    const removeLipSync = instance.addLipSync({
      driver: { getMouthOpen: () => 0.6, isSpeaking: () => speaking },
    })
    await vi.waitFor(() => expect(harness.afterMotionCallbacks.size).toBe(1))
    const tick = (deltaMs: number) => {
      for (const callback of harness.afterMotionCallbacks)
        callback(deltaMs)
    }
    const mouthWrites = () =>
      harness.events.filter(event => event.startsWith('parameter:ParamMouthOpenY:'))

    tick(16)
    expect(harness.events).toContain('parameter:ParamMouthOpenY:0.6')

    // The release crossfade must blend toward the motion value (0 in this
    // harness), not toward the previous lip-sync output. A persistent write
    // would keep the value pinned at 0.6 here.
    speaking = false
    tick(100)
    expect(harness.events).toContain('parameter:ParamMouthOpenY:0.3')

    tick(100)
    tick(250)
    tick(250)
    const writesAfterHandoff = mouthWrites().length
    tick(16)
    tick(16)
    expect(mouthWrites()).toHaveLength(writesAfterHandoff)

    // Every lip-sync write is transient, so motion regains the parameter.
    expect(
      harness.events.filter(event => event === 'clearParameter:ParamMouthOpenY').length,
    ).toBeGreaterThanOrEqual(writesAfterHandoff)

    removeLipSync()
    instance.dispose()
  })

  it('keeps features across retry and disposes feature before model and stage', async () => {
    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      src: '/hiyori.model3.json',
    })
    const removeDriver = instance.addParameterDriver('ParamMouthOpenY', {
      getValue: () => 0.75,
    })

    for (const callback of harness.afterMotionCallbacks)
      callback(16)
    expect(harness.events).toContain('parameter:ParamMouthOpenY:0.75')

    await instance.retry()
    expect(harness.events.filter(event => event === 'stage:create')).toHaveLength(2)
    expect(harness.afterMotionCallbacks.size).toBe(1)

    removeDriver()
    instance.dispose()
    const featureDispose = harness.events.lastIndexOf('feature:dispose')
    const modelDispose = harness.events.lastIndexOf('model:dispose')
    const stageDispose = harness.events.lastIndexOf('stage:dispose')
    expect(featureDispose).toBeGreaterThan(-1)
    expect(featureDispose).toBeLessThan(modelDispose)
    expect(modelDispose).toBeLessThan(stageDispose)
  })

  it('does not resume a user pause when the tab becomes visible again', async () => {
    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      src: '/hiyori.model3.json',
    })

    instance.pause()
    expect(harness.events).toContain('stage:pause')

    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(harness.events).not.toContain('stage:resume')

    instance.resume()
    expect(harness.events).toContain('stage:resume')
    instance.dispose()
  })

  it('pauses while the container is outside the viewport', async () => {
    let ioCallback: IntersectionObserverCallback | undefined
    const observed: Element[] = []
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        ioCallback = callback
      }

      disconnect() {}
      observe(target: Element) {
        observed.push(target)
      }

      takeRecords() {
        return []
      }

      unobserve() {}
    })

    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      src: '/hiyori.model3.json',
    })
    expect(observed).toContain(document.body)

    ioCallback?.(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(harness.events).toContain('stage:pause')

    ioCallback?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    expect(harness.events).toContain('stage:resume')
    instance.dispose()
  })

  it('skips viewport pausing when pauseWhenOffscreen is false', async () => {
    const observed: Element[] = []
    vi.stubGlobal('IntersectionObserver', class {
      disconnect() {}
      observe(target: Element) {
        observed.push(target)
      }

      takeRecords() {
        return []
      }

      unobserve() {}
    })

    const harness = createRuntimeHarness()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      pauseWhenOffscreen: false,
      src: '/hiyori.model3.json',
    })
    expect(observed).toHaveLength(0)
    instance.dispose()
  })

  it('surfaces render errors and recreates the whole stage on retry', async () => {
    const harness = createRuntimeHarness()
    const onError = vi.fn()
    const instance = await createLive2D({
      backend: harness.backend,
      container: document.body,
      onError,
      src: '/hiyori.model3.json',
    })

    for (const callback of harness.renderErrors)
      callback(new Live2DError('render-error', 'lost'))
    expect(instance.getState().status).toBe('error')
    expect(onError).toHaveBeenCalledOnce()

    await instance.retry()
    expect(instance.getState().status).toBe('ready')
    expect(harness.events.filter(event => event === 'stage:create')).toHaveLength(2)
    instance.dispose()
  })

  it('disposes a model that resolves after an external abort', async () => {
    const slowHarness = createRuntimeHarness(true)
    const modelHarness = createRuntimeHarness()
    const controller = new AbortController()
    const pending = createLive2D({
      backend: slowHarness.backend,
      container: document.body,
      signal: controller.signal,
      src: '/slow.model3.json',
    })

    await vi.waitFor(() => expect(slowHarness.events).toContain('model:load'))
    controller.abort(new DOMException('cancelled', 'AbortError'))
    const lateModel = await modelHarness.backend.loadModel(
      modelHarness.backend.createStage(document.body, { height: 1, width: 1 }),
      '/late.model3.json',
    )
    slowHarness.resolvePendingModel?.(lateModel)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(modelHarness.events).toContain('model:dispose')
  })
})
