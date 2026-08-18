import { Live2DError } from './errors'

export const DEFAULT_AUTO_QUALITY_POLICY = {
  desktopMaxResolution: 2,
  desktopPixelBudget: 4_000_000,
  longFrameMs: 33,
  longFrameRatioThreshold: 0.05,
  minResolution: 1,
  mobileMaxResolution: 1.5,
  mobilePixelBudget: 1_500_000,
  resolutionStep: 0.25,
  sampleWindowMs: 3_000,
} as const

/** Overrides for the automatic quality policy. Omitted fields use DEFAULT_AUTO_QUALITY_POLICY. */
export interface AutoQualityPolicy {
  /** Resolution (backing-buffer multiplier) cap on desktop. Default 2. */
  desktopMaxResolution?: number
  /** Backing-buffer pixel cap on desktop. Default 4,000,000. */
  desktopPixelBudget?: number
  /** Frame duration counted as "long". Default 33 ms. */
  longFrameMs?: number
  /** Long-frame ratio that triggers a downshift. Default 0.05 (5%). */
  longFrameRatioThreshold?: number
  /** Floor the resolution never drops below. Default 1. */
  minResolution?: number
  /** Resolution cap on mobile viewports. Default 1.5. */
  mobileMaxResolution?: number
  /** Backing-buffer pixel cap on mobile. Default 1,500,000. */
  mobilePixelBudget?: number
  /** Amount removed per downshift. Default 0.25. */
  resolutionStep?: number
  /** Measurement window per downshift decision. Default 3,000 ms. */
  sampleWindowMs?: number
}

export interface ResolvedAutoQualityPolicy {
  desktopMaxResolution: number
  desktopPixelBudget: number
  longFrameMs: number
  longFrameRatioThreshold: number
  minResolution: number
  mobileMaxResolution: number
  mobilePixelBudget: number
  resolutionStep: number
  sampleWindowMs: number
}

export interface QualityInput {
  width: number
  height: number
  devicePixelRatio: number
  mobile: boolean
}

function positive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0)
    throw new Live2DError('invalid-props', `${name} must be a finite number greater than 0.`)
  return value
}

export function resolveAutoQualityPolicy(policy?: AutoQualityPolicy): ResolvedAutoQualityPolicy {
  const resolved = {
    ...DEFAULT_AUTO_QUALITY_POLICY,
    ...policy,
  }

  positive(resolved.desktopMaxResolution, 'quality.desktopMaxResolution')
  positive(resolved.desktopPixelBudget, 'quality.desktopPixelBudget')
  positive(resolved.longFrameMs, 'quality.longFrameMs')
  positive(resolved.minResolution, 'quality.minResolution')
  positive(resolved.mobileMaxResolution, 'quality.mobileMaxResolution')
  positive(resolved.mobilePixelBudget, 'quality.mobilePixelBudget')
  positive(resolved.resolutionStep, 'quality.resolutionStep')
  positive(resolved.sampleWindowMs, 'quality.sampleWindowMs')
  if (
    !Number.isFinite(resolved.longFrameRatioThreshold)
    || resolved.longFrameRatioThreshold < 0
    || resolved.longFrameRatioThreshold > 1
  ) {
    throw new Live2DError(
      'invalid-props',
      'quality.longFrameRatioThreshold must be between 0 and 1.',
    )
  }
  if (
    resolved.mobileMaxResolution < resolved.minResolution
    || resolved.desktopMaxResolution < resolved.minResolution
  ) {
    throw new Live2DError(
      'invalid-props',
      'quality max resolutions must be greater than or equal to minResolution.',
    )
  }

  return resolved
}

function normalizeDimension(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1
}

export function selectInitialResolution(
  input: QualityInput,
  policy: ResolvedAutoQualityPolicy = DEFAULT_AUTO_QUALITY_POLICY,
): number {
  const width = normalizeDimension(input.width)
  const height = normalizeDimension(input.height)
  const maxResolution = input.mobile
    ? policy.mobileMaxResolution
    : policy.desktopMaxResolution
  const pixelBudget = input.mobile
    ? policy.mobilePixelBudget
    : policy.desktopPixelBudget
  const dpr = Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
    ? input.devicePixelRatio
    : policy.minResolution
  const budgetResolution = Math.sqrt(pixelBudget / (width * height))

  return Math.max(policy.minResolution, Math.min(dpr, maxResolution, budgetResolution))
}

export function selectLowerResolution(
  current: number,
  longFrameRatio: number,
  policy: ResolvedAutoQualityPolicy = DEFAULT_AUTO_QUALITY_POLICY,
): number {
  if (!Number.isFinite(current) || current <= policy.minResolution)
    return policy.minResolution
  if (
    !Number.isFinite(longFrameRatio)
    || longFrameRatio <= policy.longFrameRatioThreshold
  ) {
    return current
  }

  return Math.max(
    policy.minResolution,
    Math.round((current - policy.resolutionStep) * 100) / 100,
  )
}

export function isMobileViewport(width: number, height: number) {
  const coarsePointer = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches
  return coarsePointer || Math.min(width, height) < 768
}
