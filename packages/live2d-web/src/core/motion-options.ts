import type { ExpressionOptions, MotionOptions } from './contract'
import { Live2DError } from './errors'

export interface ResolvedFade {
  fadeInSeconds?: number
  fadeOutSeconds?: number
}

export type ResolvedMotionFade = ResolvedFade
export type ResolvedExpressionFade = ResolvedFade

type FadeSubject = 'Expression' | 'Motion'

function toSeconds(subject: FadeSubject, name: 'fadeInMs' | 'fadeOutMs', value: number | undefined) {
  if (value === undefined)
    return undefined
  if (!Number.isFinite(value) || value < 0) {
    throw new Live2DError(
      'invalid-props',
      `${subject} ${name} must be a finite, non-negative number of milliseconds.`,
    )
  }
  return value / 1_000
}

// Motions and expressions share one fade contract; keeping two copies meant
// keeping two validators in step by hand.
export function resolveFadeMs(
  subject: FadeSubject,
  options: { fadeInMs?: number, fadeOutMs?: number } | undefined,
): ResolvedFade {
  if (options !== undefined && (typeof options !== 'object' || options === null))
    throw new Live2DError('invalid-props', `${subject} options must be an object.`)
  return {
    fadeInSeconds: toSeconds(subject, 'fadeInMs', options?.fadeInMs),
    fadeOutSeconds: toSeconds(subject, 'fadeOutMs', options?.fadeOutMs),
  }
}

export function resolveMotionFade(options?: MotionOptions): ResolvedMotionFade {
  return resolveFadeMs('Motion', options)
}

export function resolveExpressionFade(options?: ExpressionOptions): ResolvedExpressionFade {
  return resolveFadeMs('Expression', options)
}

export function hasMotionFadeOverride(fade: ResolvedFade) {
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
