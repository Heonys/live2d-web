import type { ModelTransform, Size } from './contract'

export type ModelFit
  = | 'upper-body'
    | 'full'
    | {
      /** Multiplier applied to the upper-body fit. */
      scale: number
      /** Horizontal offset from the upper-body centered position. */
      offsetX?: number
      /** Vertical offset from the upper-body bottom position. */
      offsetY?: number
      /**
       * How the offsets are read. `'px'` (the default) treats them as CSS
       * pixels, which is fixed to the stage size they were measured at.
       * `'stage'` treats them as a fraction of the stage width and height, so
       * the placement holds when the stage resizes.
       */
      units?: 'px' | 'stage'
    }

/**
 * Compares by value, because an inline `fit={{ ... }}` prop is a new object on
 * every render. Reapplying it each time is wasted work on its own, and it wipes
 * whatever the debug overlay has been dragged to.
 */
export function sameFit(left: ModelFit, right: ModelFit): boolean {
  if (left === right)
    return true
  if (typeof left === 'string' || typeof right === 'string')
    return false
  return left.scale === right.scale
    && (left.offsetX ?? 0) === (right.offsetX ?? 0)
    && (left.offsetY ?? 0) === (right.offsetY ?? 0)
    && (left.units ?? 'px') === (right.units ?? 'px')
}

function safeScale(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1e-6
}

export function fitModel(
  stage: Size,
  model: Size,
  fit: ModelFit = 'upper-body',
): ModelTransform {
  const widthScale = stage.width / model.width
  const heightScale = stage.height / model.height

  if (fit === 'full') {
    return {
      scale: safeScale(Math.min(widthScale, heightScale)),
      x: stage.width / 2,
      y: stage.height / 2,
    }
  }

  const baseScale = safeScale(Math.min(widthScale * 2, heightScale * 2))
  if (fit === 'upper-body') {
    return {
      scale: baseScale,
      x: stage.width / 2,
      y: stage.height,
    }
  }

  const offsetX = fit.offsetX ?? 0
  const offsetY = fit.offsetY ?? 0
  const relative = fit.units === 'stage'
  return {
    scale: safeScale(baseScale * fit.scale),
    x: stage.width / 2 + (relative ? offsetX * stage.width : offsetX),
    y: stage.height + (relative ? offsetY * stage.height : offsetY),
  }
}
