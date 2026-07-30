import { describe, expect, it } from 'vitest'
import { fitModel } from './fit'

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

  it('keeps invalid dimensions finite', () => {
    const result = fitModel(
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    )
    expect(result.scale).toBe(1e-6)
    expect(Number.isFinite(result.scale)).toBe(true)
  })
})
