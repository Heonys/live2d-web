// @vitest-environment jsdom

import type { ModelFit } from '../core/fit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountLive2DDebugOverlay } from './index'

const STAGE = { height: 500, left: 0, top: 0, width: 1000 }

function createContainer() {
  const container = document.createElement('div')
  container.getBoundingClientRect = () => ({
    ...STAGE,
    bottom: STAGE.height,
    right: STAGE.width,
    toJSON: () => ({}),
    x: STAGE.left,
    y: STAGE.top,
  })
  document.body.append(container)
  return container
}

function createTarget(initial: ModelFit = 'upper-body') {
  let fit = initial
  return {
    applied: () => fit,
    getFit: () => fit,
    setFit: vi.fn((next: ModelFit) => { fit = next }),
  }
}

function shadow(container: HTMLElement) {
  const host = container.querySelector('[data-live2d-debug]') as HTMLElement
  return host.shadowRoot!
}

function surfaceOf(container: HTMLElement) {
  return shadow(container).querySelector('.surface') as HTMLElement
}

function valueOf(container: HTMLElement) {
  return shadow(container).querySelector('.value')!.textContent
}

function buttonOf(container: HTMLElement, label: string) {
  return Array.from(shadow(container).querySelectorAll('button'))
    .find(button => button.textContent === label)!
}

function pointer(type: string, init: Partial<PointerEvent>) {
  return new MouseEvent(type, { bubbles: true, ...init }) as unknown as PointerEvent
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.hasPointerCapture = () => true
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('mountLive2DDebugOverlay', () => {
  it('rejects a target that cannot change the fit', () => {
    expect(() => mountLive2DDebugOverlay({
      container: createContainer(),
      target: { getFit: () => 'full' } as never,
    })).toThrow(/setFit/)
  })

  it('shows the current placement as pasteable source', () => {
    const container = createContainer()
    mountLive2DDebugOverlay({ container, target: createTarget('full') })
    expect(valueOf(container)).toBe('{ scale: 0.5, offsetX: 0, offsetY: -0.5, units: \'stage\' }')
  })

  it('positions a static container so the overlay lands on the canvas', () => {
    const container = createContainer()
    const overlay = mountLive2DDebugOverlay({ container, target: createTarget() })
    expect(container.style.position).toBe('relative')
    overlay.dispose()
    expect(container.style.position).toBe('')
  })

  it('moves the model by a fraction of the stage when dragged', () => {
    const container = createContainer()
    const target = createTarget()
    const onChange = vi.fn()
    mountLive2DDebugOverlay({ container, onChange, target })
    const surface = surfaceOf(container)

    surface.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 500, clientY: 250 }))
    surface.dispatchEvent(pointer('pointermove', { clientX: 600, clientY: 200 }))

    // 100px across a 1000px stage, -50px up a 500px one.
    expect(target.applied()).toEqual({ offsetX: 0.1, offsetY: -0.1, scale: 1, units: 'stage' })
    expect(onChange).toHaveBeenCalledWith(target.applied())
  })

  it('keeps the model still while dragging so followPointer cannot fight it', () => {
    const container = createContainer()
    const moves: string[] = []
    container.addEventListener('pointermove', () => moves.push('container'))
    container.addEventListener('pointerdown', () => moves.push('container'))
    mountLive2DDebugOverlay({ container, target: createTarget() })
    const surface = surfaceOf(container)

    surface.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 500, clientY: 250 }))
    surface.dispatchEvent(pointer('pointermove', { clientX: 600, clientY: 250 }))
    expect(moves).toEqual([])
  })

  it('swallows the click a press synthesizes so a drag plays no motion', () => {
    const container = createContainer()
    const taps: string[] = []
    container.addEventListener('click', () => taps.push('tap'))
    mountLive2DDebugOverlay({ container, target: createTarget() })
    surfaceOf(container).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(taps).toEqual([])
  })

  it('leaves the model alone for a move that is not a drag', () => {
    const container = createContainer()
    const target = createTarget()
    mountLive2DDebugOverlay({ container, target })
    surfaceOf(container).dispatchEvent(pointer('pointermove', { clientX: 900, clientY: 100 }))
    expect(target.setFit).not.toHaveBeenCalled()
  })

  it('applies the presets', () => {
    const container = createContainer()
    const target = createTarget()
    mountLive2DDebugOverlay({ container, target })
    buttonOf(container, 'Full').click()
    expect(target.applied()).toEqual({ offsetX: 0, offsetY: -0.5, scale: 0.5, units: 'stage' })
    buttonOf(container, 'Upper body').click()
    expect(target.applied()).toEqual({ offsetX: 0, offsetY: 0, scale: 1, units: 'stage' })
  })

  it('nudges with the arrow keys and finer with shift', () => {
    const container = createContainer()
    const target = createTarget()
    mountLive2DDebugOverlay({ container, target })
    const surface = surfaceOf(container)
    surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }))
    expect(target.applied()).toMatchObject({ offsetX: 0.01 })
    surface.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', shiftKey: true }))
    expect(target.applied()).toMatchObject({ offsetX: 0.011 })
  })

  it('takes another target without remounting', () => {
    const container = createContainer()
    const overlay = mountLive2DDebugOverlay({ container, target: createTarget() })
    overlay.setTarget(createTarget('full'))
    expect(overlay.getFit()).toEqual({ offsetX: 0, offsetY: -0.5, scale: 0.5, units: 'stage' })
  })

  it('removes the host and stops listening on dispose', () => {
    const container = createContainer()
    const target = createTarget()
    const overlay = mountLive2DDebugOverlay({ container, target })
    const surface = surfaceOf(container)
    overlay.dispose()
    overlay.dispose()
    expect(container.querySelector('[data-live2d-debug]')).toBeNull()
    surface.dispatchEvent(pointer('pointerdown', { button: 0, clientX: 500, clientY: 250 }))
    surface.dispatchEvent(pointer('pointermove', { clientX: 900, clientY: 250 }))
    expect(target.setFit).not.toHaveBeenCalled()
  })
})

describe('the bar', () => {
  it('shows the scale as a percentage instead of the literal', () => {
    const container = createContainer()
    mountLive2DDebugOverlay({ container, target: createTarget('full') })
    expect(shadow(container).querySelector('.zoom')!.textContent).toBe('50%')
    expect((shadow(container).querySelector('.value') as HTMLElement).hidden).toBe(true)
  })

  it('marks the preset the placement is currently on', () => {
    const container = createContainer()
    mountLive2DDebugOverlay({ container, target: createTarget('upper-body') })
    expect(buttonOf(container, 'Upper body').getAttribute('aria-pressed')).toBe('true')
    expect(buttonOf(container, 'Full').getAttribute('aria-pressed')).toBe('false')
    buttonOf(container, 'Full').click()
    expect(buttonOf(container, 'Full').getAttribute('aria-pressed')).toBe('true')
  })

  it('returns to where the placement stood when the overlay opened', () => {
    const container = createContainer()
    const target = createTarget('full')
    mountLive2DDebugOverlay({ container, target })
    const reset = buttonOf(container, 'Reset')
    expect(reset.disabled).toBe(true)

    buttonOf(container, 'Upper body').click()
    expect(reset.disabled).toBe(false)
    reset.click()
    expect(target.applied()).toEqual({ offsetX: 0, offsetY: -0.5, scale: 0.5, units: 'stage' })
    expect(reset.disabled).toBe(true)
  })

  it('takes a placement the app applied as the new baseline', () => {
    const container = createContainer()
    let fit: ModelFit = 'full'
    const overlay = mountLive2DDebugOverlay({
      container,
      target: { getFit: () => fit, setFit: (next) => { fit = next } },
    })
    fit = 'upper-body'
    overlay.refresh()
    buttonOf(container, 'Full').click()
    buttonOf(container, 'Reset').click()
    expect(overlay.getFit()).toEqual({ offsetX: 0, offsetY: 0, scale: 1, units: 'stage' })
  })

  it('drops the hint once the tool has been touched', () => {
    const container = createContainer()
    mountLive2DDebugOverlay({ container, target: createTarget() })
    const hint = shadow(container).querySelector('.hint') as HTMLElement
    expect(hint.hidden).toBe(false)
    surfaceOf(container).dispatchEvent(pointer('pointerdown', { button: 0, clientX: 500, clientY: 250 }))
    expect(hint.hidden).toBe(true)
  })

  it('reveals the value when there is no clipboard to copy into', () => {
    const container = createContainer()
    mountLive2DDebugOverlay({ container, target: createTarget('full') })
    const value = shadow(container).querySelector('.value') as HTMLElement
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    buttonOf(container, 'Copy').click()
    expect(value.hidden).toBe(false)
    expect(value.textContent).toBe('{ scale: 0.5, offsetX: 0, offsetY: -0.5, units: \'stage\' }')
  })
})

describe('following the app', () => {
  it('re-reads the target when something else changes the placement', () => {
    const container = createContainer()
    let fit: ModelFit = 'upper-body'
    const overlay = mountLive2DDebugOverlay({
      container,
      target: { getFit: () => fit, setFit: (next) => { fit = next } },
    })
    fit = 'full'
    overlay.refresh()
    expect(valueOf(container)).toBe('{ scale: 0.5, offsetX: 0, offsetY: -0.5, units: \'stage\' }')
  })
})
