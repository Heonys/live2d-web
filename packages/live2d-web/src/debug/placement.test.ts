import { describe, expect, it } from 'vitest'
import { fitModel } from '../core/fit'
import {
  clampPlacement,
  fitToPlacement,
  formatPlacement,
  FULL_PLACEMENT,
  normalizeStagePoint,
  placementToFit,
  UPPER_BODY_PLACEMENT,
  zoomPlacementAtPoint,
} from './placement'

const STAGE = { width: 1600, height: 900 }
const MODEL = { width: 500, height: 1000 }

describe('placement presets', () => {
  it('reproduces the upper-body preset exactly', () => {
    expect(fitModel(STAGE, MODEL, placementToFit(UPPER_BODY_PLACEMENT)))
      .toEqual(fitModel(STAGE, MODEL, 'upper-body'))
  })

  it('reproduces the full preset exactly', () => {
    expect(fitModel(STAGE, MODEL, placementToFit(FULL_PLACEMENT)))
      .toEqual(fitModel(STAGE, MODEL, 'full'))
  })
})

describe('clampPlacement', () => {
  it('holds values inside the limits', () => {
    expect(clampPlacement({ offsetX: 9, offsetY: -9, scale: 99 }))
      .toEqual({ offsetX: 1, offsetY: -1, scale: 2.5 })
  })

  it('replaces a non-finite value rather than passing NaN to the renderer', () => {
    expect(clampPlacement({ offsetX: Number.NaN, offsetY: 0, scale: 1 }).offsetX).toBe(-1)
  })
})

describe('normalizeStagePoint', () => {
  const rect = { height: 900, left: 100, top: 50, width: 1600 }

  it('measures x from the center and y from the bottom', () => {
    expect(normalizeStagePoint({ x: 900, y: 950 }, rect)).toEqual({ x: 0, y: 0 })
  })

  it('reads the top-left corner as half a stage left and a stage up', () => {
    expect(normalizeStagePoint({ x: 100, y: 50 }, rect)).toEqual({ x: -0.5, y: -1 })
  })

  it('stays finite on a collapsed stage', () => {
    expect(normalizeStagePoint({ x: 5, y: 5 }, { height: 0, left: 0, top: 0, width: 0 }))
      .toEqual({ x: 0, y: 0 })
  })
})

describe('zoomPlacementAtPoint', () => {
  it('keeps the anchor still when zooming on it', () => {
    const placement = { offsetX: 0.2, offsetY: -0.3, scale: 1 }
    const zoomed = zoomPlacementAtPoint(placement, 2, { x: 0.2, y: -0.3 })
    expect(zoomed.offsetX).toBeCloseTo(0.2)
    expect(zoomed.offsetY).toBeCloseTo(-0.3)
    expect(zoomed.scale).toBe(2)
  })

  it('keeps the stage point under the cursor still', () => {
    const placement = { offsetX: 0, offsetY: 0, scale: 1 }
    const point = { x: 0.25, y: -0.5 }
    const zoomed = zoomPlacementAtPoint(placement, 1.5, point)
    // What sat under the cursor is at (point - offset) / scale in model space,
    // and must land back on the cursor at the new scale.
    expect(zoomed.offsetX + (point.x - placement.offsetX) / placement.scale * zoomed.scale)
      .toBeCloseTo(point.x)
    expect(zoomed.offsetY + (point.y - placement.offsetY) / placement.scale * zoomed.scale)
      .toBeCloseTo(point.y)
  })

  it('clamps the scale before deriving the offsets', () => {
    const zoomed = zoomPlacementAtPoint({ offsetX: 0, offsetY: 0, scale: 1 }, 99, { x: 0.5, y: 0 })
    expect(zoomed.scale).toBe(2.5)
  })
})

describe('fitToPlacement', () => {
  it('round-trips a stage-relative fit', () => {
    const placement = { offsetX: 0.1, offsetY: -0.4, scale: 1.25 }
    expect(fitToPlacement(placementToFit(placement), STAGE)).toEqual(placement)
  })

  it('divides pixel offsets by the stage they were measured against', () => {
    expect(fitToPlacement({ offsetX: 160, offsetY: -450, scale: 1 }, STAGE))
      .toEqual({ offsetX: 0.1, offsetY: -0.5, scale: 1 })
  })

  it('reads the presets', () => {
    expect(fitToPlacement('full', STAGE)).toEqual(FULL_PLACEMENT)
    expect(fitToPlacement('upper-body', STAGE)).toEqual(UPPER_BODY_PLACEMENT)
  })
})

describe('formatPlacement', () => {
  it('prints a value that can be pasted into a fit prop', () => {
    expect(formatPlacement({ offsetX: -0.123456, offsetY: 0.5, scale: 1.4 }))
      .toBe('{ scale: 1.4, offsetX: -0.123, offsetY: 0.5, units: \'stage\' }')
  })
})
