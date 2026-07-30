export type Live2DErrorCode
  = | 'browser-only'
    | 'core-missing'
    | 'invalid-props'
    | 'invalid-tree'
    | 'model-load-failed'
    | 'render-error'
    | 'adapter-error'

export class Live2DError extends Error {
  readonly code: Live2DErrorCode

  constructor(code: Live2DErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'Live2DError'
    this.code = code
  }
}
