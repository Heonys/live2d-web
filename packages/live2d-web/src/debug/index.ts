import type { ModelFit } from '../core/fit'
import type { DebugPlacement } from './placement'
import { Live2DError } from '../core/errors'
import {
  clampPlacement,
  fitToPlacement,
  formatPlacement,
  FULL_PLACEMENT,
  normalizeStagePoint,
  placementToFit,
  samePlacement,
  UPPER_BODY_PLACEMENT,
  zoomPlacementAtPoint,
} from './placement'
import { DEBUG_OVERLAY_STYLES } from './styles'

export type { DebugPlacement } from './placement'

export interface Live2DDebugTarget {
  setFit: (fit: ModelFit) => void
  getFit: () => ModelFit
}

export interface Live2DDebugOverlay {
  /** Points the overlay at another model without remounting it. */
  setTarget: (target: Live2DDebugTarget) => void
  /** Re-reads the target after something else changed the placement. */
  refresh: () => void
  /** The placement currently applied, in the form the overlay writes. */
  getFit: () => ModelFit
  dispose: () => void
}

export interface MountLive2DDebugOverlayOptions {
  target: Live2DDebugTarget
  /** The element the model is rendered into. The overlay covers it. */
  container: HTMLElement
  /**
   * Receives every placement the overlay applies. React consumers need this:
   * `fit` is a controlled prop there, so a value only written to the runtime is
   * reverted by the next render that passes the old one.
   */
  onChange?: (fit: ModelFit) => void
}

const NUDGE = 0.01
const FINE_NUDGE = 0.001
const ZOOM_STEP = 0.05
const NUDGES: Record<string, readonly [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
}

function invalid(message: string): never {
  throw new Live2DError('invalid-props', message)
}

function assertTarget(target: unknown): asserts target is Live2DDebugTarget {
  if (!target || typeof target !== 'object')
    invalid('Debug overlay target must be a Live2D instance.')
  for (const method of ['setFit', 'getFit'] as const) {
    if (typeof (target as Record<string, unknown>)[method] !== 'function')
      invalid(`Debug overlay target must provide ${method}().`)
  }
}

/** Mounts a framework-free placement overlay over one loaded model. */
export function mountLive2DDebugOverlay(
  options: MountLive2DDebugOverlayOptions,
): Live2DDebugOverlay {
  if (typeof document === 'undefined')
    throw new Live2DError('browser-only', 'The Live2D debug overlay can only be mounted in a browser.')
  if (!options || typeof options !== 'object')
    invalid('mountLive2DDebugOverlay options must be an object.')
  assertTarget(options.target)
  if (!(options.container instanceof HTMLElement))
    invalid('mountLive2DDebugOverlay container must be an HTMLElement.')

  const { container } = options
  let target = options.target
  let disposed = false
  let frame = 0
  let pending = false
  let applying = false
  let copied = 0

  // The host is absolutely positioned, so a static container would place it
  // against the nearest positioned ancestor instead of the canvas. Restored on
  // dispose so the page is left as it was found.
  const previousPosition = container.style.position
  const position = getComputedStyle(container).position
  if (!position || position === 'static')
    container.style.position = 'relative'

  const host = document.createElement('div')
  host.dataset.live2dDebug = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = DEBUG_OVERLAY_STYLES

  const surface = document.createElement('div')
  surface.className = 'surface'
  surface.tabIndex = 0
  surface.setAttribute('role', 'application')
  surface.setAttribute('aria-label', 'Live2D placement. Drag to move, scroll to zoom, arrow keys to nudge.')
  surface.innerHTML = '<div class="frame"></div><div class="crosshair x"></div><div class="crosshair y"></div>'

  const bar = document.createElement('div')
  bar.className = 'bar'
  const zoom = document.createElement('output')
  zoom.className = 'zoom'

  // Revealed only when the clipboard refuses. Kept in the DOM either way so the
  // copy path and the placement have one source.
  const value = document.createElement('code')
  value.className = 'value'
  value.hidden = true

  const hint = document.createElement('p')
  hint.className = 'hint'
  hint.textContent = 'Drag to move, scroll to zoom, arrow keys to nudge.'

  const button = (label: string, onClick: () => void, className?: string) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.textContent = label
    if (className)
      element.className = className
    element.addEventListener('click', onClick)
    return element
  }

  const divider = () => {
    const element = document.createElement('span')
    element.className = 'divider'
    element.setAttribute('aria-hidden', 'true')
    return element
  }

  const stageRect = () => container.getBoundingClientRect()
  const readPlacement = (source: Live2DDebugTarget) => fitToPlacement(source.getFit(), {
    height: stageRect().height,
    width: stageRect().width,
  })
  let placement = readPlacement(target)

  let upperBody: HTMLButtonElement
  let full: HTMLButtonElement
  let resetButton: HTMLButtonElement
  let copyButton: HTMLButtonElement

  // Where the placement stood the last time it came from outside the overlay.
  // Reset undoes this session's dragging, not the app's own choice of fit.
  let baseline = { ...placement }

  const render = () => {
    value.textContent = formatPlacement(placement)
    zoom.textContent = `${Math.round(placement.scale * 100)}%`
    upperBody.setAttribute('aria-pressed', String(samePlacement(placement, UPPER_BODY_PLACEMENT)))
    full.setAttribute('aria-pressed', String(samePlacement(placement, FULL_PLACEMENT)))
    resetButton.disabled = samePlacement(placement, baseline)
  }

  const touched = () => {
    hint.hidden = true
  }

  const commit = (next: DebugPlacement) => {
    placement = clampPlacement(next)
    render()
    if (pending)
      return
    pending = true
    frame = requestAnimationFrame(() => {
      pending = false
      frame = 0
      if (disposed)
        return
      const fit = placementToFit(placement)
      // The target calls back into refresh(), and without this the overlay
      // would take its own write as an external one and move the baseline,
      // leaving Reset with nothing to return to.
      applying = true
      try {
        target.setFit(fit)
      }
      finally {
        applying = false
      }
      options.onChange?.(fit)
    })
  }

  const confirmCopy = (label: string) => {
    copyButton.textContent = label
    clearTimeout(copied)
    copied = window.setTimeout(() => {
      if (!disposed)
        copyButton.textContent = 'Copy'
    }, 2000)
  }

  const copy = () => {
    touched()
    // The literal it prints, verbatim. Wrapping it as `fit={...}` would assume
    // JSX, and this entry is reachable from createLive2D() just as well.
    const text = formatPlacement(placement)
    const clipboard = navigator.clipboard
    if (!clipboard) {
      value.hidden = false
      return
    }
    void clipboard.writeText(text)
      .then(() => confirmCopy('Copied'))
      // Without the clipboard there is no other way out of the tool, so the
      // value has to become selectable.
      .catch(() => { value.hidden = false })
  }

  const applyPreset = (preset: DebugPlacement) => {
    touched()
    commit({ ...preset })
  }

  const step = (amount: number) => {
    touched()
    zoomFromCenter(amount)
  }

  upperBody = button('Upper body', () => applyPreset(UPPER_BODY_PLACEMENT))
  full = button('Full', () => applyPreset(FULL_PLACEMENT))
  resetButton = button('Reset', () => applyPreset(baseline))
  copyButton = button('Copy', copy)

  bar.append(
    button('\u2212', () => step(-ZOOM_STEP), 'step'),
    zoom,
    button('+', () => step(ZOOM_STEP), 'step'),
    divider(),
    upperBody,
    full,
    resetButton,
    divider(),
    copyButton,
  )
  shadow.append(style, surface, hint, value, bar)
  container.append(host)
  render()

  function zoomFromCenter(amount: number) {
    commit(zoomPlacementAtPoint(
      placement,
      placement.scale + amount,
      { x: placement.offsetX, y: placement.offsetY },
    ))
  }

  let drag: { placement: DebugPlacement, pointerId: number, x: number, y: number } | null = null

  const setDragging = (dragging: boolean) => {
    surface.dataset.dragging = String(dragging)
    bar.dataset.dragging = String(dragging)
  }

  const onPointerDown = (event: PointerEvent) => {
    // A press on the overlay is an overlay interaction, never a model tap.
    event.stopPropagation()
    if (event.button !== 0)
      return
    touched()
    surface.setPointerCapture(event.pointerId)
    drag = { placement, pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setDragging(true)
    surface.focus()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId)
      return
    // followPointer listens on the container. Letting the move through while
    // dragging makes the model chase the cursor and slide under it at once.
    event.stopPropagation()
    const rect = stageRect()
    commit({
      ...drag.placement,
      offsetX: drag.placement.offsetX + (event.clientX - drag.x) / Math.max(1, rect.width),
      offsetY: drag.placement.offsetY + (event.clientY - drag.y) / Math.max(1, rect.height),
    })
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId)
      return
    event.stopPropagation()
    if (surface.hasPointerCapture(event.pointerId))
      surface.releasePointerCapture(event.pointerId)
    drag = null
    setDragging(false)
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    event.stopPropagation()
    touched()
    const pixels = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    commit(zoomPlacementAtPoint(
      placement,
      placement.scale * Math.exp(-pixels * 0.0015),
      normalizeStagePoint({ x: event.clientX, y: event.clientY }, stageRect()),
    ))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const direction = NUDGES[event.key]
    if (direction) {
      event.preventDefault()
      touched()
      const step = event.shiftKey ? FINE_NUDGE : NUDGE
      commit({
        ...placement,
        offsetX: placement.offsetX + direction[0] * step,
        offsetY: placement.offsetY + direction[1] * step,
      })
      return
    }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      touched()
      zoomFromCenter(ZOOM_STEP)
    }
    else if (event.key === '-') {
      event.preventDefault()
      touched()
      zoomFromCenter(-ZOOM_STEP)
    }
  }

  // The browser synthesizes a click after a press, and consumers hang onTap on
  // the container. Without this a drag also plays a motion.
  const onClick = (event: MouseEvent) => event.stopPropagation()

  surface.addEventListener('click', onClick)
  surface.addEventListener('pointerdown', onPointerDown)
  surface.addEventListener('pointermove', onPointerMove)
  surface.addEventListener('pointerup', onPointerUp)
  surface.addEventListener('pointercancel', onPointerUp)
  surface.addEventListener('wheel', onWheel, { passive: false })
  surface.addEventListener('keydown', onKeyDown)

  return {
    dispose() {
      if (disposed)
        return
      disposed = true
      clearTimeout(copied)
      if (frame)
        cancelAnimationFrame(frame)
      frame = 0
      pending = false
      surface.removeEventListener('click', onClick)
      surface.removeEventListener('pointerdown', onPointerDown)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', onPointerUp)
      surface.removeEventListener('pointercancel', onPointerUp)
      surface.removeEventListener('wheel', onWheel)
      surface.removeEventListener('keydown', onKeyDown)
      host.remove()
      container.style.position = previousPosition
    },
    getFit: () => placementToFit(placement),
    refresh() {
      if (disposed || applying)
        return
      placement = readPlacement(target)
      baseline = { ...placement }
      render()
    },
    setTarget(next: Live2DDebugTarget) {
      assertTarget(next)
      target = next
      placement = readPlacement(next)
      baseline = { ...placement }
      render()
    },
  }
}
