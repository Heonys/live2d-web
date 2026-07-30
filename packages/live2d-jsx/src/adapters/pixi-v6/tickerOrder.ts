import { UPDATE_PRIORITY } from '@pixi/ticker'

/**
 * PIXI runs larger priorities first. Keep these values separated so the
 * backend's frame contract cannot drift during refactors.
 */
export const PIXI_V6_TICKER_PRIORITY = {
  frame: UPDATE_PRIORITY.NORMAL,
  model: UPDATE_PRIORITY.HIGH,
  render: UPDATE_PRIORITY.LOW,
} as const
