const INITIAL_NOISE_FLOOR = 0.008
const CALIBRATION_MS = 1_500
const CALIBRATION_SAMPLE_CAP = 0.04
const NOISE_FLOOR_MULTIPLIER = 2.4
const MINIMUM_THRESHOLD = 0.01
const MINIMUM_DYNAMIC_RANGE = 0.045
const DYNAMIC_RANGE_MULTIPLIER = 5
const ATTACK_SMOOTHING = 0.45
const RELEASE_SMOOTHING = 0.16
const SPEAKING_ON_LEVEL = 0.12
const SPEAKING_OFF_LEVEL = 0.05

export interface VolumeLipSyncDriver {
  sample: (rms: number, elapsedMs: number) => void
  getMouthOpen: () => number
  isSpeaking: () => boolean
}

function finiteRms(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function normalizedElapsed(value: number, previous: number) {
  if (!Number.isFinite(value))
    return previous
  return Math.max(previous, value, 0)
}

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value))
}

/**
 * Turns caller-sampled RMS volume into a stable mouth-open driver.
 * The caller retains ownership of audio capture, analysis and scheduling.
 */
export function createVolumeLipSync(): VolumeLipSyncDriver {
  let elapsedMs = 0
  let mouthOpen = 0
  let noiseFloor = INITIAL_NOISE_FLOOR
  let speaking = false

  return {
    sample(rawRms, rawElapsedMs) {
      const rms = finiteRms(rawRms)
      elapsedMs = normalizedElapsed(rawElapsedMs, elapsedMs)

      if (elapsedMs <= CALIBRATION_MS) {
        noiseFloor = noiseFloor * 0.92
          + Math.min(rms, CALIBRATION_SAMPLE_CAP) * 0.08
      }
      else if (!speaking && rms < noiseFloor * 2) {
        noiseFloor = noiseFloor * 0.995 + rms * 0.005
      }

      const threshold = Math.max(
        MINIMUM_THRESHOLD,
        noiseFloor * NOISE_FLOOR_MULTIPLIER,
      )
      const dynamicRange = Math.max(
        MINIMUM_DYNAMIC_RANGE,
        threshold * DYNAMIC_RANGE_MULTIPLIER,
      )
      const target = clampUnit((rms - threshold) / dynamicRange)
      const smoothing = target > mouthOpen
        ? ATTACK_SMOOTHING
        : RELEASE_SMOOTHING
      mouthOpen += (target - mouthOpen) * smoothing
      mouthOpen = clampUnit(mouthOpen)

      speaking = speaking
        ? mouthOpen >= SPEAKING_OFF_LEVEL
        : mouthOpen >= SPEAKING_ON_LEVEL
    },
    getMouthOpen: () => mouthOpen,
    isSpeaking: () => speaking,
  }
}
