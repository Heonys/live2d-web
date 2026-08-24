import { describe, expect, it } from 'vitest'
import {
  idleMotionIdentity,
  resolveIdleMotion,
  selectIdleMotionIndex,
  validateIdleMotion,
} from './idle-motion'

describe('weighted idle motion', () => {
  it('preserves string and disabled configurations', () => {
    expect(resolveIdleMotion(undefined, () => 0)).toEqual({ group: 'Idle' })
    expect(resolveIdleMotion('Rest', () => 0)).toEqual({ group: 'Rest' })
    expect(resolveIdleMotion(false, () => 0)).toBe(false)
  })

  it('requires exact non-negative weights with at least one positive entry', () => {
    expect(resolveIdleMotion(
      { group: 'Idle', weights: [5, 0, 1] },
      () => 3,
    )).toEqual({ group: 'Idle', weights: [5, 0, 1] })
    expect(() => resolveIdleMotion(
      { group: 'Idle', weights: [1] },
      () => 2,
    )).toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    expect(() => validateIdleMotion({ group: 'Idle', weights: [0, 0] }))
      .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateIdleMotion({ group: 'Idle', weights: [1, invalid] }))
        .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    }
    expect(() => resolveIdleMotion(
      { group: 'Missing', weights: [1] },
      () => 0,
    )).toThrowError(expect.objectContaining({ code: 'invalid-props' }))
  })

  it('selects weighted boundaries without choosing zero-weight entries', () => {
    const weights = [1, 0, 3]
    expect(selectIdleMotionIndex(3, weights, () => 0)).toBe(0)
    expect(selectIdleMotionIndex(3, weights, () => 0.249)).toBe(0)
    expect(selectIdleMotionIndex(3, weights, () => 0.25)).toBe(2)
    expect(selectIdleMotionIndex(3, weights, () => 1)).toBe(2)
    expect(selectIdleMotionIndex(
      2,
      [Number.MAX_VALUE, Number.MAX_VALUE],
      () => 0,
    )).toBe(0)
  })

  it('keeps uniform selection and stable value identities', () => {
    expect(selectIdleMotionIndex(3, undefined, () => 0)).toBe(0)
    expect(selectIdleMotionIndex(3, undefined, () => 0.5)).toBe(1)
    expect(selectIdleMotionIndex(3, undefined, () => 1)).toBe(2)
    expect(idleMotionIdentity({ group: 'Idle', weights: [1, 0] }))
      .toBe(idleMotionIdentity({ group: 'Idle', weights: [1, 0] }))
  })
})
