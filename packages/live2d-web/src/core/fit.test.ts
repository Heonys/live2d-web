import { describe, expect, it } from 'vitest'
import { fitModel, sameFit } from './fit'

describe('fitModel', () => {
  it('frames the upper body by default', () => {
    expect(fitModel(
      { width: 1600, height: 900 },
      { width: 500, height: 1000 },
    )).toEqual({ scale: 1.8, x: 800, y: 900 })
  })

  it('contains the full model', () => {
    expect(fitModel(
      { width: 1600, height: 900 },
      { width: 500, height: 1000 },
      'full',
    )).toEqual({ scale: 0.9, x: 800, y: 450 })
  })

  it('applies a custom multiplier and offsets to upper-body fit', () => {
    expect(fitModel(
      { width: 1600, height: 900 },
      { width: 500, height: 1000 },
      { scale: 0.75, offsetX: 10, offsetY: -20 },
    )).toEqual({ scale: 1.35, x: 810, y: 880 })
  })

  it('reads stage-relative offsets as a fraction of the stage', () => {
    expect(fitModel(
      { width: 1600, height: 900 },
      { width: 500, height: 1000 },
      { scale: 0.75, offsetX: 0.25, offsetY: -0.5, units: 'stage' },
    )).toEqual({ scale: 1.35, x: 1200, y: 450 })
  })

  it('holds a stage-relative placement across a resize', () => {
    const fit = { offsetX: 0.1, offsetY: -0.25, scale: 1, units: 'stage' } as const
    const model = { width: 500, height: 1000 }
    const small = fitModel({ width: 800, height: 450 }, model, fit)
    const large = fitModel({ width: 1600, height: 900 }, model, fit)
    expect(small.x / 800).toBeCloseTo(large.x / 1600)
    expect(small.y / 450).toBeCloseTo(large.y / 900)
  })

  it('keeps pixel offsets as the default so stored fits do not move', () => {
    const model = { width: 500, height: 1000 }
    const fit = { offsetX: 10, offsetY: -20, scale: 0.75 }
    expect(fitModel({ width: 1600, height: 900 }, model, fit))
      .toEqual(fitModel({ width: 1600, height: 900 }, model, { ...fit, units: 'px' }))
  })

  it('keeps invalid dimensions finite', () => {
    const result = fitModel(
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    )
    expect(result.scale).toBe(1e-6)
    expect(Number.isFinite(result.scale)).toBe(true)
  })
})

describe('sameFit', () => {
  it('sees two identical inline objects as the same placement', () => {
    expect(sameFit({ offsetX: 0.1, scale: 1 }, { offsetX: 0.1, scale: 1 })).toBe(true)
  })

  it('treats an omitted offset and unit as their defaults', () => {
    expect(sameFit({ scale: 1 }, { offsetX: 0, offsetY: 0, scale: 1, units: 'px' })).toBe(true)
  })

  it('separates the same numbers in different units', () => {
    expect(sameFit(
      { offsetX: 0.1, scale: 1 },
      { offsetX: 0.1, scale: 1, units: 'stage' },
    )).toBe(false)
  })

  it('separates the presets from each other and from an object', () => {
    expect(sameFit('full', 'upper-body')).toBe(false)
    expect(sameFit('full', { scale: 0.5 })).toBe(false)
    expect(sameFit('full', 'full')).toBe(true)
  })
})
