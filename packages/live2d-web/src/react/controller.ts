import type { ModelHandle } from '../core/contract'
import { Live2DError } from '../core/errors'

export interface Live2DModelController {
  motion: (group: string, index?: number) => Promise<void>
  expression: (id?: string) => Promise<void>
  focus: (x: number, y: number) => void
  getParameter: (id: string) => number
  setParameter: (id: string, value: number) => void
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
      expression: async (id?: string) => requireActive().expression(id),
      focus: (x: number, y: number) => requireActive().focus(x, y),
      getParameter: (id: string) => requireActive().getParameter(id),
      motion: async (group: string, index?: number) => requireActive().motion(group, index),
      setParameter: (id: string, value: number) => requireActive().setParameter(id, value),
    }),
    invalidate: () => { active = false },
  }
}
