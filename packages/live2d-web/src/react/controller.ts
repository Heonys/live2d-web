import type {
  ExpressionOptions,
  ModelInfo,
  MotionOptions,
  MotionPlaybackResult,
  MotionSequenceResult,
  MotionSequenceStep,
} from '../core/contract'
import type { Live2DModelHandle, ParameterDriver } from '../core/runtime'
import { Live2DError } from '../core/errors'

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
  expression: (id?: string, options?: ExpressionOptions) => Promise<void>
  clearExpression: () => void
  getModelInfo: () => ModelInfo
  focus: (x: number, y: number) => void
  getParameter: (id: string) => number
  /** Persistent override until clearParameter() removes it. */
  setParameter: (id: string, value: number) => void
  clearParameter: (id: string) => void
  /** Writes a transient value after every SDK update. */
  addParameterDriver: (id: string, driver: ParameterDriver) => () => void
}

/**
 * Wraps one model's handle for React. The invalidation exists because a
 * controller handed to `onLoad` outlives the render that produced it, and using
 * it after unmount has to say so rather than reach a disposed model.
 */
export function createLive2DModelController(handle: Live2DModelHandle): {
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
      addParameterDriver: (id: string, driver: ParameterDriver) =>
        requireActive().addParameterDriver(id, driver),
      clearExpression: () => requireActive().clearExpression(),
      clearParameter: (id: string) => requireActive().clearParameter(id),
      expression: async (id?: string, options?: ExpressionOptions) =>
        requireActive().expression(id, options),
      focus: (x: number, y: number) => requireActive().focus(x, y),
      getModelInfo: () => requireActive().getModelInfo(),
      getParameter: (id: string) => requireActive().getParameter(id),
      isMotionPlaying: () => requireActive().isMotionPlaying(),
      motion: async (group: string, index?: number, options?: MotionOptions) =>
        requireActive().motion(group, index, options),
      playMotion: async (group: string, index?: number, options?: MotionOptions) =>
        requireActive().playMotion(group, index, options),
      sequence: async (steps: readonly MotionSequenceStep[]) =>
        requireActive().sequence(steps),
      setParameter: (id: string, value: number) => requireActive().setParameter(id, value),
    }),
    invalidate: () => { active = false },
  }
}
