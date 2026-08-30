// @vitest-environment jsdom

import type { Live2DDevtoolsTarget } from './index'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountLive2DDevtools } from './index'

function createTarget() {
  const drivers = new Map<string, { getValue: () => number }>()
  const listeners = new Set<() => void>()
  const cleanups: string[] = []
  const target: Live2DDevtoolsTarget = {
    addParameterDriver(id, driver) {
      drivers.set(id, driver)
      let active = true
      return () => {
        if (!active)
          return
        active = false
        drivers.delete(id)
        cleanups.push(id)
      }
    },
    clearExpression: vi.fn(),
    expression: vi.fn(async () => {}),
    getModelInfo: () => ({
      expressions: ['smile'],
      hitAreas: ['Head'],
      model3Version: 3,
      mocVersion: 5,
      motions: { Idle: 2, Tap: 1 },
      parameters: [
        { defaultValue: 0, id: 'ParamAngleX', maximum: 30, minimum: -30 },
        { defaultValue: 1, id: 'ParamEyeLOpen', maximum: 1, minimum: 0 },
      ],
    }),
    getParameter: id => id === 'ParamEyeLOpen' ? 1 : 0,
    getState: () => ({
      render: { bufferPixels: 320_000, height: 400, resolution: 1, width: 800 },
      status: 'ready',
    }),
    isMotionPlaying: () => false,
    playMotion: vi.fn(async () => ({ status: 'completed' as const })),
    sequence: vi.fn(async steps => ({ completedSteps: steps.length, status: 'completed' as const })),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return { cleanups, drivers, listeners, target }
}

function shadow(container: HTMLElement) {
  const host = container.querySelector<HTMLElement>('[data-live2d-devtools]')
  if (!host?.shadowRoot)
    throw new Error('Devtools ShadowRoot was not mounted')
  return host.shadowRoot
}

describe('live2D Devtools', () => {
  let frameCallbacks: Map<number, FrameRequestCallback>
  let nextFrame: number

  beforeEach(() => {
    frameCallbacks = new Map()
    nextFrame = 1
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrame++
      frameCallbacks.set(id, callback)
      return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frameCallbacks.delete(id)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('mounts without removing host content and exposes public diagnostics', async () => {
    const container = document.createElement('div')
    const existing = document.createElement('span')
    container.append(existing)
    document.body.append(container)
    const { target } = createTarget()
    const writeText = vi.fn(async (_value: string) => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const devtools = mountLive2DDevtools({ container, target })
    expect(container.firstElementChild).toBe(existing)
    expect(shadow(container).textContent).toContain('Live2D Devtools')
    expect(shadow(container).textContent).toContain('800×400')
    expect(shadow(container).querySelector<HTMLOutputElement>('[data-status]')?.hidden).toBe(true)
    ;(shadow(container).querySelector('[data-action="copy-diagnostic"]') as HTMLButtonElement).click()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText.mock.calls[0]?.[0]).toContain('ParamAngleX')
    expect(shadow(container).querySelector<HTMLOutputElement>('[data-status]')?.hidden).toBe(false)
    expect(shadow(container).querySelector<HTMLOutputElement>('[data-status]')?.textContent).toBe('Diagnostic JSON copied')

    devtools.dispose()
    expect(container.children).toHaveLength(1)
  })

  it('uses temporary drivers and restores them on reset, target change and dispose', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const first = createTarget()
    const second = createTarget()
    const devtools = mountLive2DDevtools({ container, target: first.target })

    devtools.setTab('parameters')
    const slider = shadow(container).querySelector<HTMLInputElement>('[data-param-slider="ParamAngleX"]')!
    slider.value = '12'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    expect(first.drivers.get('ParamAngleX')?.getValue()).toBe(12)

    shadow(container).querySelector<HTMLButtonElement>('[data-reset-param="ParamAngleX"]')!.click()
    expect(first.drivers.has('ParamAngleX')).toBe(false)
    expect(first.cleanups).toEqual(['ParamAngleX'])

    const nextSlider = shadow(container).querySelector<HTMLInputElement>('[data-param-slider="ParamAngleX"]')!
    nextSlider.value = '-8'
    nextSlider.dispatchEvent(new Event('input', { bubbles: true }))
    devtools.setTarget(second.target)
    expect(first.cleanups).toEqual(['ParamAngleX', 'ParamAngleX'])
    expect(first.listeners.size).toBe(0)
    expect(second.listeners.size).toBe(1)

    devtools.dispose()
    devtools.dispose()
    expect(second.listeners.size).toBe(0)
    expect(container.children).toHaveLength(0)
  })

  it('plays motions, sequences and expressions without blocking later actions', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const { target } = createTarget()
    const devtools = mountLive2DDevtools({ container, target, initialTab: 'motion' })
    const root = shadow(container)

    root.querySelector<HTMLButtonElement>('[data-action="play-motion"]')!.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(target.playMotion).toHaveBeenCalledWith('Idle', 0, {
      fadeInMs: undefined,
      fadeOutMs: undefined,
      priority: 'normal',
    })

    root.querySelector<HTMLButtonElement>('[data-action="queue-motion"]')!.click()
    shadow(container).querySelector<HTMLButtonElement>('[data-action="play-sequence"]')!.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(target.sequence).toHaveBeenCalledWith([
      { group: 'Idle', index: 0, options: { fadeInMs: undefined, fadeOutMs: undefined, priority: 'normal' } },
    ])

    devtools.setTab('expression')
    shadow(container).querySelector<HTMLButtonElement>('[data-action="apply-expression"]')!.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(target.expression).toHaveBeenCalledWith('smile', {
      fadeInMs: undefined,
      fadeOutMs: undefined,
    })
    shadow(container).querySelector<HTMLButtonElement>('[data-action="clear-expression"]')!.click()
    expect(target.clearExpression).toHaveBeenCalledOnce()
  })

  it('samples parameters only on the active tab and cancels work when leaving it', () => {
    const container = document.createElement('div')
    document.body.append(container)
    const { target } = createTarget()
    const read = vi.spyOn(target, 'getParameter')
    const devtools = mountLive2DDevtools({ container, target })
    expect(frameCallbacks.size).toBe(0)

    devtools.setTab('parameters')
    expect(frameCallbacks.size).toBe(1)
    const callback = [...frameCallbacks.values()][0]!
    callback(100)
    expect(read).toHaveBeenCalled()
    expect(frameCallbacks.size).toBe(2)

    devtools.setTab('overview')
    expect(cancelAnimationFrame).toHaveBeenCalled()
    devtools.dispose()
  })

  it('rejects invalid mounts, tabs and use after dispose', () => {
    const container = document.createElement('div')
    const { target } = createTarget()
    expect(() => mountLive2DDevtools({ container: {} as HTMLElement, target })).toThrowError(
      expect.objectContaining({ code: 'invalid-props' }),
    )
    expect(() => mountLive2DDevtools({ container, target: {} as Live2DDevtoolsTarget })).toThrowError(
      expect.objectContaining({ code: 'invalid-props' }),
    )
    const devtools = mountLive2DDevtools({ container, target })
    expect(() => devtools.setTab('missing' as never)).toThrowError(
      expect.objectContaining({ code: 'invalid-props' }),
    )
    devtools.dispose()
    expect(() => devtools.setTarget(target)).toThrowError(
      expect.objectContaining({ code: 'invalid-props' }),
    )
  })
})
