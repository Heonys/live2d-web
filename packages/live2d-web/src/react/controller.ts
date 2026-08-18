import type { ModelHandle, ModelInfo, MotionOptions } from '../core/contract'
import { Live2DError } from '../core/errors'

export interface Live2DModelController {
  /** Plays a motion. Resolves when playback finishes (or is interrupted). */
  motion: (group: string, index?: number, options?: MotionOptions) => Promise<void>
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
      setParameter: (id: string, value: number) => requireActive().setParameter(id, value),
    }),
    invalidate: () => { active = false },
  }
}
