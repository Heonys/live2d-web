import { describe, expect, it } from 'vitest'
import { resolveExpressionFade } from './expression-options'

describe('expression fade options', () => {
  it('keeps omitted values and converts zero and milliseconds', () => {
    expect(resolveExpressionFade()).toEqual({
      fadeInSeconds: undefined,
      fadeOutSeconds: undefined,
    })
    expect(resolveExpressionFade({ fadeInMs: 0, fadeOutMs: 500 })).toEqual({
      fadeInSeconds: 0,
      fadeOutSeconds: 0.5,
    })
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid value %s',
    (value) => {
      expect(() => resolveExpressionFade({ fadeInMs: value }))
        .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
      expect(() => resolveExpressionFade({ fadeOutMs: value }))
        .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    },
  )
})
