import { describe, expect, it } from 'vitest'
import { hasMotionFadeOverride, resolveExpressionFade, resolveMotionFade } from './motion-options'

describe('motion fade options', () => {
  it('keeps omitted values unset and converts milliseconds to seconds', () => {
    expect(resolveMotionFade()).toEqual({
      fadeInSeconds: undefined,
      fadeOutSeconds: undefined,
    })
    expect(resolveMotionFade({ fadeInMs: 0, fadeOutMs: 400 })).toEqual({
      fadeInSeconds: 0,
      fadeOutSeconds: 0.4,
    })
  })

  it.each([
    ['fadeInMs', -1],
    ['fadeInMs', Number.NaN],
    ['fadeInMs', Number.POSITIVE_INFINITY],
    ['fadeOutMs', -1],
    ['fadeOutMs', Number.NaN],
    ['fadeOutMs', Number.NEGATIVE_INFINITY],
  ] as const)('rejects invalid %s values', (name, value) => {
    expect(() => resolveMotionFade({ [name]: value })).toThrowError(
      expect.objectContaining({ code: 'invalid-props' }),
    )
  })

  it('distinguishes model defaults from an explicit zero override', () => {
    expect(hasMotionFadeOverride(resolveMotionFade())).toBe(false)
    expect(hasMotionFadeOverride(resolveMotionFade({ fadeInMs: 0 }))).toBe(true)
  })

  it('applies the same contract to expressions', () => {
    expect(resolveExpressionFade({ fadeInMs: 0, fadeOutMs: 500 })).toEqual({
      fadeInSeconds: 0,
      fadeOutSeconds: 0.5,
    })
    expect(() => resolveExpressionFade({ fadeInMs: -1 }))
      .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    expect(() => resolveExpressionFade('smile' as never))
      .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    expect(() => resolveMotionFade('tap' as never))
      .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
  })
})
