import { describe, expect, it } from 'vitest'
import {
  median,
  medianByKey,
  quantile,
  summarize,
} from '../../../../benchmarks/lib/metrics'

describe('benchmark metrics', () => {
  it('calculates interpolated quantiles and ignores non-finite samples', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5)
    expect(quantile([Number.NaN, 10, 20], 0.95)).toBe(19.5)
    expect(quantile([], 0.5)).toBeNull()
  })

  it('summarizes samples and aggregates repetition medians', () => {
    expect(summarize([1, 2, 3])).toEqual({
      count: 3,
      p50: 2,
      p95: 2.9,
      p99: 2.98,
    })
    expect(median([9, 1, 5])).toBe(5)
    expect(medianByKey([
      { draw: 3, frame: 10 },
      { draw: 1, frame: 30 },
      { draw: 2, frame: 20 },
    ])).toEqual({ draw: 2, frame: 20 })
  })
})
