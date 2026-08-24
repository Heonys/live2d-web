import type {
  ModelInfo,
  MotionPlaybackResult,
  MotionSequenceResult,
  MotionSequenceStep,
} from './contract'
import { Live2DError } from './errors'
import { validateMotionOptions } from './motion-options'

export type DetailedMotionPlayer = (
  group: string,
  index?: number,
  options?: MotionSequenceStep['options'],
) => Promise<MotionPlaybackResult>

export function validateMotionSequence(
  steps: readonly MotionSequenceStep[],
  modelInfo: ModelInfo,
) {
  if (!Array.isArray(steps))
    throw new Live2DError('invalid-props', 'Motion sequence steps must be an array.')

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex]
    if (typeof step !== 'object' || step === null || Array.isArray(step)) {
      throw new Live2DError(
        'invalid-props',
        `Motion sequence step ${stepIndex} must be an object.`,
      )
    }
    if (typeof step.group !== 'string' || step.group.trim() === '') {
      throw new Live2DError(
        'invalid-props',
        `Motion sequence step ${stepIndex} needs a non-empty group.`,
      )
    }
    const count = modelInfo.motions[step.group]
    if (!Number.isInteger(count) || count <= 0) {
      throw new Live2DError(
        'invalid-props',
        `Unknown Live2D motion group in sequence step ${stepIndex}: ${step.group}.`,
      )
    }
    if (
      step.index !== undefined
      && (!Number.isInteger(step.index) || step.index < 0 || step.index >= count)
    ) {
      throw new Live2DError(
        'invalid-props',
        `Motion index ${step.index} is outside group ${step.group} in sequence step ${stepIndex}.`,
      )
    }
    validateMotionOptions(step.options)
  }
}

export async function playMotionSequence(
  steps: readonly MotionSequenceStep[],
  modelInfo: ModelInfo,
  play: DetailedMotionPlayer,
): Promise<MotionSequenceResult> {
  validateMotionSequence(steps, modelInfo)
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex]
    const result = await play(step.group, step.index, step.options)
    if (result.status !== 'completed') {
      return {
        completedSteps: stepIndex,
        status: result.status,
        stepIndex,
      }
    }
  }
  return { completedSteps: steps.length, status: 'completed' }
}
