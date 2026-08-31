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

  it('leaves canvas semantics unchanged when accessibility is omitted', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createGl())
    const stage = createWebGLStage(document.body, { height: 100, width: 100 })
    const canvas = document.querySelector('canvas')!

    expect(canvas.hasAttribute('role')).toBe(false)
    expect(canvas.hasAttribute('aria-label')).toBe(false)
    expect(canvas.textContent).toBe('')
    stage.dispose()
  })

  it('marks decorative canvases as hidden presentation content', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createGl())
    const stage = createWebGLStage(document.body, {
      accessibility: { mode: 'decorative' },
      height: 100,
      width: 100,
    })
    const canvas = document.querySelector('canvas')!

    expect(canvas.getAttribute('role')).toBe('presentation')
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.hasAttribute('tabindex')).toBe(false)
    stage.dispose()
  })

  // Each call fully re-describes the canvas, so a mode switch cannot leave the
  // previous value's attributes behind.
  it('replaces canvas semantics on setAccessibility without leaving stale attributes', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createGl())
    const stage = createWebGLStage(document.body, {
      accessibility: { describedBy: 'help', label: 'Idle avatar' },
      height: 100,
      width: 100,
    })
    const canvas = document.querySelector('canvas')!

    stage.setAccessibility?.({ label: 'Talking avatar' })
    expect(canvas.getAttribute('aria-label')).toBe('Talking avatar')
    expect(canvas.hasAttribute('aria-describedby')).toBe(false)
    expect(canvas.textContent).toBe('Talking avatar')

    stage.setAccessibility?.({ mode: 'decorative' })
    expect(canvas.getAttribute('role')).toBe('presentation')
    expect(canvas.hasAttribute('aria-label')).toBe(false)
    expect(canvas.textContent).toBe('')

    stage.setAccessibility?.(undefined)
    expect(canvas.hasAttribute('role')).toBe(false)
    expect(canvas.hasAttribute('aria-hidden')).toBe(false)
    stage.dispose()
  })

  it('applies image semantics and fallback text', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createGl())
    const stage = createWebGLStage(document.body, {
      accessibility: {
        describedBy: 'avatar-help',
        label: 'Animated guide character',
      },
      height: 100,
      width: 100,
    })
    const canvas = document.querySelector('canvas')!

    expect(canvas.getAttribute('role')).toBe('img')
    expect(canvas.getAttribute('aria-label')).toBe('Animated guide character')
    expect(canvas.getAttribute('aria-describedby')).toBe('avatar-help')
    expect(canvas.textContent).toBe('Animated guide character')
    expect(canvas.hasAttribute('tabindex')).toBe(false)
    stage.dispose()
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

  it('updates every driver, then draws them in the order they attached', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
    const stage = createWebGLStage(document.body, { height: 100, width: 200 })
    const events: string[] = []
    const driver = (name: string): StageFrameDriver => ({
      draw: () => events.push(`draw:${name}`),
      resize: () => events.push(`resize:${name}`),
      update: () => events.push(`update:${name}`),
    })
    const internals = getStageInternals(stage)
    internals.attachDriver(driver('a'))
    const detachB = internals.attachDriver(driver('b'))
    events.length = 0

    frames.shift()?.(16)
    // Everything updates before anything draws: a driver must not see the
    // frame half rendered. Draw order is attach order, so a model added later
    // sits on top.
    expect(events).toEqual(['update:a', 'update:b', 'draw:a', 'draw:b'])

    events.length = 0
    detachB()
    detachB()
    frames.shift()?.(32)
    expect(events).toEqual(['update:a', 'draw:a'])

    stage.dispose()
  })

  it('sizes a driver as it attaches and on every later resize', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl)
    const stage = createWebGLStage(document.body, { height: 100, width: 200 })
    const sizes: string[] = []
    const internals = getStageInternals(stage)
    internals.attachDriver({
      draw: () => {},
      resize: (width, height) => sizes.push(`a ${width}x${height}`),
      update: () => {},
    })
    internals.attachDriver({
      draw: () => {},
      resize: (width, height) => sizes.push(`b ${width}x${height}`),
      update: () => {},
    })
    expect(sizes).toEqual(['a 200x100', 'b 200x100'])

    sizes.length = 0
    stage.resize(300, 150)
    expect(sizes).toEqual(['a 300x150', 'b 300x150'])

    stage.dispose()
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

  it('does not burst above maxFps after a long main-thread stall', () => {
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

    for (const timestamp of [0, 5_000, 5_008.333, 5_016.666, 5_024.999])
      frames.shift()?.(timestamp)

    expect(updates).toHaveLength(3)
    expect(updates[1]).toBe(100)
    expect(updates[2]).toBeCloseTo(16.666, 2)
    stage.dispose()
  })
})
