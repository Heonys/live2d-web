import type { ResolvedMotionFade } from '../../core/motion-options'
import { hasMotionFadeOverride } from '../../core/motion-options'

export interface MotionFadeTarget {
  setFadeInTime: (seconds: number) => void
  setFadeOutTime: (seconds: number) => void
}

export interface CachedMotionAsset<T> {
  buffer: ArrayBuffer
  motion: T
}

export interface PlaybackMotion<T> {
  /** True means the Framework queue must delete the object after playback. */
  autoDelete: boolean
  motion: T
  /** Releases a per-play object if queue ownership was never transferred. */
  releaseBeforeStart: () => void
  /** Marks a per-play object as owned by the Framework queue. */
  transferToQueue: () => void
}

export function applyMotionFade<T extends MotionFadeTarget>(
  motion: T,
  fade: ResolvedMotionFade,
) {
  if (fade.fadeInSeconds !== undefined)
    motion.setFadeInTime(fade.fadeInSeconds)
  if (fade.fadeOutSeconds !== undefined)
    motion.setFadeOutTime(fade.fadeOutSeconds)
  return motion
}

export function preparePlaybackMotion<T extends MotionFadeTarget>(
  asset: CachedMotionAsset<T>,
  fade: ResolvedMotionFade,
  parse: (buffer: ArrayBuffer) => T,
  release: (motion: T) => void,
): PlaybackMotion<T> {
  if (!hasMotionFadeOverride(fade)) {
    return {
      autoDelete: false,
      motion: asset.motion,
      releaseBeforeStart() {},
      transferToQueue() {},
    }
  }

  const motion = applyMotionFade(parse(asset.buffer), fade)
  let owned = true
  return {
    autoDelete: true,
    motion,
    releaseBeforeStart() {
      if (!owned)
        return
      owned = false
      release(motion)
    },
    transferToQueue() {
      owned = false
    },
  }
}
