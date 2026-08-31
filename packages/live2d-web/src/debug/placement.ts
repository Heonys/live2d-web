import type { Size } from '../core/contract'
import type { ModelFit } from '../core/fit'

/**
 * A `fit` object in stage-relative units, which is what the overlay edits.
 * `scale` multiplies the upper-body fit; the offsets are fractions of the
 * stage, so a placement found at one size still holds at another.
 */
export interface DebugPlacement {
  scale: number
  offsetX: number
  offsetY: number
}

export const PLACEMENT_LIMITS = {
  offset: { max: 1, min: -1 },
  scale: { max: 2.5, min: 0.25 },
} as const

export const UPPER_BODY_PLACEMENT: DebugPlacement = Object.freeze({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
})

// `full` scales to min(widthScale, heightScale) centered, and the upper-body
// base is twice that, so half the base lands on the same size. Centering means
// half a stage height above the bottom the offsets are measured from.
export const FULL_PLACEMENT: DebugPlacement = Object.freeze({
  offsetX: 0,
  offsetY: -0.5,
  scale: 0.5,
})

function clampTo(value: number, { max, min }: { max: number, min: number }) {
  if (!Number.isFinite(value))
    return min
  return Math.min(max, Math.max(min, value))
}

export function clampPlacement(placement: DebugPlacement): DebugPlacement {
  return {
    offsetX: clampTo(placement.offsetX, PLACEMENT_LIMITS.offset),
    offsetY: clampTo(placement.offsetY, PLACEMENT_LIMITS.offset),
    scale: clampTo(placement.scale, PLACEMENT_LIMITS.scale),
  }
}

/**
 * Normalizes a client point into the space the offsets live in: horizontally
 * from the stage center, vertically from its bottom. Each axis has to match
 * the origin of the offset it moves, or zooming drifts along that axis.
 */
export function normalizeStagePoint(
  point: { x: number, y: number },
  rect: { height: number, left: number, top: number, width: number },
) {
  return {
    x: rect.width > 0 ? (point.x - rect.left) / rect.width - 0.5 : 0,
    y: rect.height > 0 ? (point.y - rect.top) / rect.height - 1 : 0,
  }
}

/**
 * Changes scale around a stage point while keeping what is under that point
 * visually stationary.
 */
export function zoomPlacementAtPoint(
  placement: DebugPlacement,
  scale: number,
  point: { x: number, y: number },
): DebugPlacement {
  const next = clampTo(scale, PLACEMENT_LIMITS.scale)
  const ratio = placement.scale === 0 ? 1 : next / placement.scale
  return clampPlacement({
    offsetX: point.x - (point.x - placement.offsetX) * ratio,
    offsetY: point.y - (point.y - placement.offsetY) * ratio,
    scale: next,
  })
}

export function samePlacement(left: DebugPlacement, right: DebugPlacement): boolean {
  return left.scale === right.scale
    && left.offsetX === right.offsetX
    && left.offsetY === right.offsetY
}

export function placementToFit(placement: DebugPlacement): ModelFit {
  return {
    offsetX: placement.offsetX,
    offsetY: placement.offsetY,
    scale: placement.scale,
    units: 'stage',
  }
}

/**
 * Reads any `fit` back into the overlay's space. Pixel offsets need the stage
 * they were measured against, which is why the current size is required.
 */
export function fitToPlacement(fit: ModelFit, stage: Size): DebugPlacement {
  if (fit === 'full')
    return { ...FULL_PLACEMENT }
  if (fit === 'upper-body')
    return { ...UPPER_BODY_PLACEMENT }
  const relative = fit.units === 'stage'
  const offsetX = fit.offsetX ?? 0
  const offsetY = fit.offsetY ?? 0
  return clampPlacement({
    offsetX: relative ? offsetX : (stage.width > 0 ? offsetX / stage.width : 0),
    offsetY: relative ? offsetY : (stage.height > 0 ? offsetY / stage.height : 0),
    scale: fit.scale,
  })
}

function round(value: number) {
  return Number(value.toFixed(3))
}

/** The placement as source a consumer can paste into a `fit` prop. */
export function formatPlacement(placement: DebugPlacement): string {
  const { offsetX, offsetY, scale } = placement
  return `{ scale: ${round(scale)}, offsetX: ${round(offsetX)}, offsetY: ${round(offsetY)}, units: 'stage' }`
}
