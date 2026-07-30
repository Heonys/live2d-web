import type { ModelTransform, Size } from './contract'

export type ModelFit
  = | 'upper-body'
    | 'full'
    | {
      /** Multiplier applied to the upper-body fit. */
      scale: number
      /** CSS-pixel offset from the upper-body centered position. */
      offsetX?: number
      /** CSS-pixel offset from the upper-body bottom position. */
      offsetY?: number
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

  return {
    scale: safeScale(baseScale * fit.scale),
    x: stage.width / 2 + (fit.offsetX ?? 0),
    y: stage.height + (fit.offsetY ?? 0),
  }
}
