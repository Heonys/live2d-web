import { describe, expect, it } from 'vitest'
import { PIXI_V6_TICKER_PRIORITY } from './tickerOrder'

describe('pixi-v6 ticker order', () => {
  it('runs model/after-motion work before stage callbacks and rendering', () => {
    expect(PIXI_V6_TICKER_PRIORITY.model)
      .toBeGreaterThan(PIXI_V6_TICKER_PRIORITY.frame)
    expect(PIXI_V6_TICKER_PRIORITY.frame)
      .toBeGreaterThan(PIXI_V6_TICKER_PRIORITY.render)
  })
})
