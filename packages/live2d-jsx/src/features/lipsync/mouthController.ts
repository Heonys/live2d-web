export const MOUTH_PARAMETER_ID = 'ParamMouthOpenY'
export const MOUTH_RELEASE_MS = 200
export const MOUTH_HANDOFF_HOLD_MS = 500

export interface MouthControllerFrame {
  deltaMs: number
  mouthOpen: number
  motionValue: number
  speaking: boolean
}

function clampMouthOpen(value: number) {
  if (!Number.isFinite(value))
    return 0
  return Math.min(1, Math.max(0, value))
}

function frameDelta(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function motionParameter(value: number) {
  return Number.isFinite(value) ? value : 0
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

/**
 * Backend- and React-neutral ownership state for ParamMouthOpenY.
 *
 * `update()` returns `null` once motion should retain control for the frame.
 */
export class MouthController {
  private holdRemainingMs = 0
  private lastForcedValue = 0
  private releaseRemainingMs = 0

  update(frame: MouthControllerFrame): number | null {
    if (frame.speaking) {
      this.lastForcedValue = clampMouthOpen(frame.mouthOpen)
      this.releaseRemainingMs = MOUTH_RELEASE_MS
      this.holdRemainingMs = MOUTH_HANDOFF_HOLD_MS
      return this.lastForcedValue
    }

    let remainingDeltaMs = frameDelta(frame.deltaMs)

    if (this.releaseRemainingMs > 0) {
      const consumedMs = Math.min(this.releaseRemainingMs, remainingDeltaMs)
      this.releaseRemainingMs -= consumedMs
      remainingDeltaMs -= consumedMs

      if (this.releaseRemainingMs > 0) {
        const progress = 1 - this.releaseRemainingMs / MOUTH_RELEASE_MS
        const blend = smoothstep(progress)
        return this.lastForcedValue * (1 - blend)
          + motionParameter(frame.motionValue) * blend
      }

      if (remainingDeltaMs === 0)
        return motionParameter(frame.motionValue)
    }

    if (this.holdRemainingMs > 0) {
      this.holdRemainingMs = Math.max(0, this.holdRemainingMs - remainingDeltaMs)
      if (this.holdRemainingMs > 0)
        return 0
    }

    return null
  }
}
