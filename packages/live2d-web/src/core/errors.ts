export type Live2DErrorCode
  = | 'browser-only'
    | 'core-missing'
    | 'webgl-unsupported'
    | 'invalid-props'
    | 'invalid-tree'
    | 'lipsync-error'
    | 'model-load-failed'
    | 'render-error'
    | 'adapter-error'

export type Live2DAssetType
  = | 'core'
    | 'model3'
    | 'moc3'
    | 'texture'
    | 'physics'
    | 'pose'
    | 'user-data'
    | 'motion'
    | 'expression'
    | 'shader'

export interface Live2DErrorDetails {
  readonly assetType?: Live2DAssetType
  readonly backend?: string
  readonly url?: string
  readonly httpStatus?: number
}

export interface Live2DErrorOptions extends ErrorOptions {
  details?: Live2DErrorDetails
}

export class Live2DError extends Error {
  readonly code: Live2DErrorCode
  readonly details?: Readonly<Live2DErrorDetails>

  constructor(code: Live2DErrorCode, message: string, options?: Live2DErrorOptions) {
    super(message, options)
    this.name = 'Live2DError'
    this.code = code
    this.details = options?.details
      ? Object.freeze({ ...options.details })
      : undefined
  }
}
