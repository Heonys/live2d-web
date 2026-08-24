import type {
  ModelHandle,
  ModelInfo,
  MotionOptions,
  MotionPlaybackResult,
  MotionSequenceResult,
  MotionSequenceStep,
} from '../core/contract'
import { Live2DError } from '../core/errors'
import { playMotionSequence } from '../core/motion-sequence'

export interface Live2DModelController {
  /** Plays a motion. Resolves when playback finishes (or is interrupted). */
  motion: (group: string, index?: number, options?: MotionOptions) => Promise<void>
  playMotion: (
    group: string,
    index?: number,
    options?: MotionOptions,
  ) => Promise<MotionPlaybackResult>
  sequence: (steps: readonly MotionSequenceStep[]) => Promise<MotionSequenceResult>
  isMotionPlaying: () => boolean
  expression: (id?: string) => Promise<void>
  clearExpression: () => void
  getModelInfo: () => ModelInfo
  focus: (x: number, y: number) => void
  getParameter: (id: string) => number
  /** Persistent override until clearParameter() removes it. */
  setParameter: (id: string, value: number) => void
  clearParameter: (id: string) => void
}

export function createLive2DModelController(
  handle: ModelHandle,
): {
  controller: Live2DModelController
  invalidate: () => void
} {
  let active = true
  const requireActive = () => {
    if (!active) {
      throw new Live2DError(
        'invalid-props',
        'This React Live2D model controller is no longer active.',
      )
    }
    return handle
  }
  return {
    controller: Object.freeze({
      clearExpression: () => requireActive().clearExpression(),
      clearParameter: (id: string) => requireActive().clearParameter(id),
      expression: async (id?: string) => requireActive().expression(id),
      focus: (x: number, y: number) => requireActive().focus(x, y),
      getModelInfo: () => requireActive().getModelInfo(),
      getParameter: (id: string) => requireActive().getParameter(id),
      isMotionPlaying: () => requireActive().isMotionPlaying(),
      motion: async (group: string, index?: number, options?: MotionOptions) =>
        requireActive().motion(group, index, options),
      playMotion: async (group: string, index?: number, options?: MotionOptions) => {
        const model = requireActive()
        if (!model.playMotion) {
          throw new Live2DError(
            'adapter-error',
            'The selected Live2D backend does not support detailed motion playback.',
          )
        }
        return model.playMotion(group, index, options)
      },
      sequence: async (steps: readonly MotionSequenceStep[]) => {
        const model = requireActive()
        if (!model.playMotion) {
          throw new Live2DError(
            'adapter-error',
            'The selected Live2D backend does not support motion sequences.',
          )
        }
        return playMotionSequence(
          steps,
          model.getModelInfo(),
          (group, index, options) => model.playMotion!(group, index, options),
        )
      },
      setParameter: (id: string, value: number) => requireActive().setParameter(id, value),
    }),
    invalidate: () => { active = false },
  }
}
