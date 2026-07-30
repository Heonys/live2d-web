import { describe, expect, it } from 'vitest'
import {
  MOUTH_HANDOFF_HOLD_MS,
  MOUTH_RELEASE_MS,
  MouthController,
} from './mouthController'

function frame(
  controller: MouthController,
  overrides: Partial<Parameters<MouthController['update']>[0]> = {},
) {
  return controller.update({
    deltaMs: 0,
    motionValue: 0.4,
    mouthOpen: 0.8,
    speaking: false,
    ...overrides,
  })
}

describe('mouthController', () => {
  it('overrides motion while speaking and clamps invalid mouth values', () => {
    const controller = new MouthController()

    expect(frame(controller, { mouthOpen: 1.8, speaking: true })).toBe(1)
    expect(frame(controller, { mouthOpen: -1, speaking: true })).toBe(0)
    expect(frame(controller, { mouthOpen: Number.NaN, speaking: true })).toBe(0)
  })

  it('crossfades for 200ms, holds zero for 500ms, then hands off', () => {
    const controller = new MouthController()
    expect(frame(controller, { mouthOpen: 0.8, speaking: true })).toBe(0.8)

    const halfway = frame(controller, { deltaMs: MOUTH_RELEASE_MS / 2 })
    expect(halfway).toBeCloseTo(0.6)

    expect(frame(controller, { deltaMs: MOUTH_RELEASE_MS / 2 })).toBe(0.4)
    expect(frame(controller, { deltaMs: 1 })).toBe(0)
    expect(frame(controller, { deltaMs: MOUTH_HANDOFF_HOLD_MS - 1 })).toBeNull()
    expect(frame(controller, { deltaMs: 16 })).toBeNull()
  })

  it('restarts ownership when speech resumes during release or hold', () => {
    const controller = new MouthController()
    frame(controller, { mouthOpen: 0.8, speaking: true })
    frame(controller, { deltaMs: 100 })
    expect(frame(controller, { mouthOpen: 0.3, speaking: true })).toBe(0.3)
    expect(frame(controller, { deltaMs: 100 })).toBeCloseTo(0.35)

    frame(controller, { deltaMs: 100 })
    frame(controller, { deltaMs: 100 })
    expect(frame(controller, { mouthOpen: 0.9, speaking: true })).toBe(0.9)
  })

  it('consumes release and hold across a large frame delta', () => {
    const controller = new MouthController()
    frame(controller, { speaking: true })

    expect(frame(controller, {
      deltaMs: MOUTH_RELEASE_MS + MOUTH_HANDOFF_HOLD_MS + 1,
    })).toBeNull()
  })

  it('ignores invalid and negative deltas', () => {
    const controller = new MouthController()
    frame(controller, { mouthOpen: 0.8, speaking: true })

    expect(frame(controller, { deltaMs: Number.NaN })).toBe(0.8)
    expect(frame(controller, { deltaMs: -20 })).toBe(0.8)
  })
})
