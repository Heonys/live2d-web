// @vitest-environment jsdom

import type { Live2DBackend, ModelHandle, StageHandle } from './contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLive2D } from './runtime'

const adapterState = vi.hoisted(() => ({
  evaluatedAfterCore: false,
}))

vi.mock('../adapters/cubism-webgl', () => {
  adapterState.evaluatedAfterCore = Boolean(window.Live2DCubismCore)
  const model: ModelHandle = {
    dispose: () => {},
    expression: async () => {},
    focus: () => {},
    getIntrinsicSize: () => ({ height: 2, width: 1 }),
    getParameter: () => 0,
    motion: async () => {},
    onAfterMotionUpdate: () => () => {},
    setParameter: () => {},
    setTransform: () => {},
  }
  const backend: Live2DBackend = {
    createStage(_container, options) {
      let resolution = options.resolution ?? 1
      let size = { height: options.height, width: options.width }
      const stage: StageHandle = {
        dispose: () => {},
        getResolution: () => resolution,
        getSize: () => size,
        onError: () => () => {},
        onFrame: () => () => {},
        pause: () => {},
        resize: (width, height) => {
          size = { height, width }
        },
        resume: () => {},
        setResolution: value => resolution = value,
        toWorld: (x, y) => ({ x, y }),
      }
      return stage
    },
    loadModel: async () => model,
  }
  return { cubismWebGL: backend }
})

describe('default cubism-webgl backend', () => {
  beforeEach(() => {
    adapterState.evaluatedAfterCore = false
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 300,
      height: 300,
      left: 0,
      right: 200,
      toJSON: () => ({}),
      top: 0,
      width: 200,
      x: 0,
      y: 0,
    })
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    delete window.Live2DCubismCore
    document.querySelectorAll('script[data-live2d-web-core]').forEach(script => script.remove())
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads Core before evaluating the default adapter', async () => {
    const creating = createLive2D({
      container: document.body,
      coreUrl: '/core-5.3.js',
      src: '/hiyori.model3.json',
    })
    const script = document.querySelector<HTMLScriptElement>(
      'script[data-live2d-web-core]',
    )!
    expect(adapterState.evaluatedAfterCore).toBe(false)

    window.Live2DCubismCore = {}
    script.dispatchEvent(new Event('load'))

    const character = await creating
    expect(adapterState.evaluatedAfterCore).toBe(true)
    expect(character.getState().status).toBe('ready')
    character.dispose()
  })
})
