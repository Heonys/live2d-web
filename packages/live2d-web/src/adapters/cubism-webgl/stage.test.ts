// @vitest-environment jsdom

import type { StageFrameDriver } from './types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebGLStage, getStageInternals } from './stage'

function createGl() {
  return {
    COLOR_BUFFER_BIT: 0x4000,
    FRAMEBUFFER: 0x8D40,
    bindFramebuffer: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
    isContextLost: vi.fn(() => false),
    viewport: vi.fn(),
  } as unknown as WebGL2RenderingContext
}

describe('cubism-webgl Stage', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns webgl-unsupported without a WebGL2 context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => createWebGLStage(document.body, { height: 100, width: 100 }))
      .toThrow(expect.objectContaining({ code: 'webgl-unsupported' }))
  })

  it('updates metrics before draw and reports context loss once', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
    const stage = createWebGLStage(document.body, { height: 100, width: 200 })
    const events: string[] = []
    const driver: StageFrameDriver = {
      draw: () => events.push('draw'),
      resize: () => events.push('resize'),
      update: () => events.push('update'),
    }
    getStageInternals(stage).attachDriver(driver)
    stage.onFrame(() => events.push('metrics'))
    const errors: string[] = []
    stage.onError(error => errors.push(error.code))

    frames.shift()?.(16)
    expect(events.slice(-3)).toEqual(['update', 'metrics', 'draw'])

    const canvas = document.querySelector('canvas')!
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(errors).toEqual(['render-error'])

    stage.dispose()
    stage.dispose()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('keeps a 60 FPS cap on a 120 Hz animation clock', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
    const stage = createWebGLStage(document.body, {
      height: 100,
      maxFps: 60,
      width: 200,
    })
    const updates: number[] = []
    getStageInternals(stage).attachDriver({
      draw: () => {},
      resize: () => {},
      update: deltaMs => updates.push(deltaMs),
    })

    for (const timestamp of [0, 8.333, 16.666, 24.999, 33.332])
      frames.shift()?.(timestamp)

    expect(updates).toHaveLength(3)
    expect(updates[1]).toBeCloseTo(16.666, 2)
    expect(updates[2]).toBeCloseTo(16.666, 2)
    stage.dispose()
  })
})
