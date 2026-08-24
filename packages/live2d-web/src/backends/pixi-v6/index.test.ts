// @vitest-environment jsdom

import type { ModelHandle, StageHandle } from '../../core/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pixi = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  const emit = (event: string) => {
    for (const listener of [...(listeners.get(event) ?? [])])
      listener()
  }
  const parameters = new Map<string, number>()
  const motionManager = {
    currentGroup: undefined as string | undefined,
    currentIndex: undefined as number | undefined,
    finished: false,
    isFinished: () => motionManager.finished,
    off(event: string, listener: () => void) {
      listeners.get(event)?.delete(listener)
    },
    on(event: string, listener: () => void) {
      const set = listeners.get(event) ?? new Set()
      set.add(listener)
      listeners.set(event, set)
    },
  }
  const internalListeners = new Map<string, Set<() => void>>()
  const model = {
    anchor: { set: vi.fn() },
    destroy: vi.fn(),
    expression: vi.fn(async () => {}),
    focus: vi.fn(),
    height: 1_000,
    hitTest: vi.fn(() => ['Body']),
    internalModel: {
      coreModel: {
        getParameterValueById: (id: string) => parameters.get(id) ?? 0,
        setParameterValueById: (id: string, value: number) => {
          parameters.set(id, value)
        },
      },
      hitAreas: { Body: {} },
      motionManager,
      off(event: string, listener: () => void) {
        internalListeners.get(event)?.delete(listener)
      },
      on(event: string, listener: () => void) {
        const set = internalListeners.get(event) ?? new Set()
        set.add(listener)
        internalListeners.set(event, set)
      },
      settings: { expressions: [], motions: { Tap: [{}, {}] } },
    },
    motion: vi.fn(async () => true),
    position: { set: vi.fn() },
    scale: { set: vi.fn() },
    update: vi.fn(),
    width: 500,
  }

  return {
    emit,
    emitAfterMotionUpdate: () => {
      for (const listener of [...(internalListeners.get('afterMotionUpdate') ?? [])])
        listener()
    },
    model,
    motionManager,
    parameters,
    reset() {
      listeners.clear()
      internalListeners.clear()
      parameters.clear()
      motionManager.currentGroup = undefined
      motionManager.currentIndex = undefined
      motionManager.finished = false
      model.focus.mockClear()
      model.hitTest.mockClear()
      model.motion.mockClear()
    },
  }
})

vi.mock('@pixi/app', () => ({
  Application: class {
    renderer = { resize: vi.fn() }
    stage = {
      addChild: vi.fn(),
      removeChild: vi.fn(),
      scale: {
        set(value: number) {
          this.x = value
          this.y = value
        },
        x: 1,
        y: 1,
      },
    }

    ticker = {
      add: vi.fn(),
      deltaMS: 16,
      maxFPS: 0,
      remove: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }

    view = document.createElement('canvas')
    destroy = vi.fn()
    render = vi.fn()
  },
}))
vi.mock('@pixi/core', () => ({ BatchRenderer: class {} }))
vi.mock('@pixi/extensions', () => ({ extensions: { add: () => {} } }))
vi.mock('@pixi/ticker', () => ({
  Ticker: class {},
  TickerPlugin: class {},
  UPDATE_PRIORITY: { HIGH: 25, LOW: -25, NORMAL: 0 },
}))
vi.mock('pixi-live2d-display/cubism4', () => ({
  Live2DFactory: { setupLive2DModel: async () => {} },
  Live2DModel: class {
    static registerTicker() {}
    constructor() {
      return pixi.model as never
    }
  },
}))

const { pixiV6 } = await import('./index')

async function mountModel(resolution: number): Promise<{
  model: ModelHandle
  stage: StageHandle
}> {
  const stage = pixiV6.createStage(document.body, {
    height: 600,
    resolution,
    width: 800,
  })
  const model = await pixiV6.loadModel(stage, '/hiyori.model3.json', {})
  return { model, stage }
}

describe('pixi-v6 contract conformance', () => {
  beforeEach(() => {
    window.Live2DCubismCore = {}
    pixi.reset()
    document.body.replaceChildren()
  })

  it('takes stage-space CSS pixels for focus and hit testing', async () => {
    const { model, stage } = await mountModel(2)

    model.focus(100, 50)
    model.hitTest(100, 50)

    // PIXI global space carries the stage scale, so CSS pixels are doubled.
    expect(pixi.model.focus).toHaveBeenCalledWith(200, 100)
    expect(pixi.model.hitTest).toHaveBeenCalledWith(200, 100)
    model.dispose()
    stage.dispose()
  })

  it('reapplies manual parameters after every motion update', async () => {
    const { model, stage } = await mountModel(1)

    model.setParameter('ParamMouthOpenY', 0.8)
    // A motion update overwrites the value before the next frame is drawn.
    pixi.parameters.set('ParamMouthOpenY', 0)
    pixi.emitAfterMotionUpdate()
    expect(model.getParameter('ParamMouthOpenY')).toBeCloseTo(0.8)

    model.clearParameter('ParamMouthOpenY')
    pixi.parameters.set('ParamMouthOpenY', 0)
    pixi.emitAfterMotionUpdate()
    expect(model.getParameter('ParamMouthOpenY')).toBeCloseTo(0)

    model.dispose()
    stage.dispose()
  })

  it('settles a motion promise when another motion supersedes it', async () => {
    const { model, stage } = await mountModel(1)
    pixi.motionManager.currentGroup = 'Tap'
    pixi.motionManager.currentIndex = 0

    let settled = false
    const playing = model.motion('Tap', 0).then(() => {
      settled = true
    })
    await Promise.resolve()

    // A second motion takes over. motionFinish never fires for the first one.
    pixi.motionManager.currentGroup = 'Idle'
    pixi.motionManager.currentIndex = 1
    pixi.emitAfterMotionUpdate()
    await playing

    expect(settled).toBe(true)
    model.dispose()
    stage.dispose()
  })

  it('explicitly rejects motion fade overrides without starting playback', async () => {
    const { model, stage } = await mountModel(1)

    await expect(model.motion('Tap', 0, { fadeInMs: 250 })).rejects.toMatchObject({
      code: 'invalid-props',
      details: { backend: 'pixi-v6' },
    })
    expect(pixi.model.motion).not.toHaveBeenCalled()

    pixi.model.motion.mockResolvedValueOnce(false)
    await model.motion('Tap', 0, { priority: 'normal' })
    expect(pixi.model.motion).toHaveBeenCalledWith('Tap', 0, 2)
    model.dispose()
    stage.dispose()
  })
})
