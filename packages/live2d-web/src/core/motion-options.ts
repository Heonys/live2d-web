import type { MotionOptions } from './contract'
import { Live2DError } from './errors'

export interface ResolvedMotionFade {
  fadeInSeconds?: number
  fadeOutSeconds?: number
}

function toSeconds(name: 'fadeInMs' | 'fadeOutMs', value: number | undefined) {
  if (value === undefined)
    return undefined
  if (!Number.isFinite(value) || value < 0) {
    throw new Live2DError(
      'invalid-props',
      `Motion ${name} must be a finite, non-negative number of milliseconds.`,
    )
  }
  return value / 1_000
}

export function resolveMotionFade(options?: MotionOptions): ResolvedMotionFade {
  return {
    fadeInSeconds: toSeconds('fadeInMs', options?.fadeInMs),
    fadeOutSeconds: toSeconds('fadeOutMs', options?.fadeOutMs),
  }
}

export function hasMotionFadeOverride(fade: ResolvedMotionFade) {
  return fade.fadeInSeconds !== undefined || fade.fadeOutSeconds !== undefined
}

export function validateMotionOptions(options: MotionOptions | undefined) {
  if (options === undefined)
    return
  if (typeof options !== 'object' || options === null) {
    throw new Live2DError('invalid-props', 'Motion options must be an object.')
  }
  if (
    options.priority !== undefined
    && options.priority !== 'force'
    && options.priority !== 'idle'
    && options.priority !== 'normal'
  ) {
    throw new Live2DError(
      'invalid-props',
      'Motion priority must be \'force\', \'idle\' or \'normal\'.',
    )
  }
  resolveMotionFade(options)
}
