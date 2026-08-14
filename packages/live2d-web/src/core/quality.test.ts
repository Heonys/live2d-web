import { describe, expect, it } from 'vitest'
import { Live2DError } from './errors'
import {
  resolveAutoQualityPolicy,
  selectInitialResolution,
  selectLowerResolution,
} from './quality'

describe('auto quality', () => {
  it('caps mobile DPR at 1.5 and desktop DPR at 2', () => {
    const policy = resolveAutoQualityPolicy()
    expect(selectInitialResolution({
      width: 390,
      height: 844,
      devicePixelRatio: 3,
      mobile: true,
    }, policy)).toBe(1.5)
    expect(selectInitialResolution({
      width: 1280,
      height: 720,
      devicePixelRatio: 3,
      mobile: false,
    }, policy)).toBe(2)
  })

  it('obeys the backing-buffer pixel budget', () => {
    const policy = resolveAutoQualityPolicy()
    const resolution = selectInitialResolution({
      width: 1000,
      height: 1000,
      devicePixelRatio: 3,
      mobile: true,
    }, policy)
    expect(1000 * 1000 * resolution ** 2).toBeCloseTo(1_500_000)
  })

  it('only lowers by one step when the long-frame threshold is exceeded', () => {
    const policy = resolveAutoQualityPolicy()
    expect(selectLowerResolution(1.5, 0.05, policy)).toBe(1.5)
    expect(selectLowerResolution(1.5, 0.051, policy)).toBe(1.25)
    expect(selectLowerResolution(1.25, 0.2, policy)).toBe(1)
    expect(selectLowerResolution(1, 1, policy)).toBe(1)
  })

  it('rejects invalid policy values', () => {
    expect(() => resolveAutoQualityPolicy({ mobilePixelBudget: 0 }))
      .toThrowError(Live2DError)
    expect(() => resolveAutoQualityPolicy({ longFrameRatioThreshold: 2 }))
      .toThrowError(Live2DError)
  })
})
