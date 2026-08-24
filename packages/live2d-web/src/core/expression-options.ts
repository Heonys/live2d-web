import type { ExpressionOptions } from './contract'
import { Live2DError } from './errors'

export interface ResolvedExpressionFade {
  fadeInSeconds?: number
  fadeOutSeconds?: number
}

function toSeconds(name: 'fadeInMs' | 'fadeOutMs', value: number | undefined) {
  if (value === undefined)
    return undefined
  if (!Number.isFinite(value) || value < 0) {
    throw new Live2DError(
      'invalid-props',
      `Expression ${name} must be a finite, non-negative number of milliseconds.`,
    )
  }
  return value / 1_000
}

export function resolveExpressionFade(
  options?: ExpressionOptions,
): ResolvedExpressionFade {
  if (options !== undefined && (typeof options !== 'object' || options === null)) {
    throw new Live2DError('invalid-props', 'Expression options must be an object.')
  }
  return {
    fadeInSeconds: toSeconds('fadeInMs', options?.fadeInMs),
    fadeOutSeconds: toSeconds('fadeOutMs', options?.fadeOutMs),
  }
}
