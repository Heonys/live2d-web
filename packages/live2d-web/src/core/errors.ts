export type Live2DErrorCode
  /** Called outside a browser (SSR, worker, tests without DOM). */
  = | 'browser-only'
    /** Cubism Core is not loaded and no working coreUrl was provided. */
    | 'core-missing'
    /** The backend requires WebGL2 and the browser could not create it. */
    | 'webgl-unsupported'
    /** An option or argument value is invalid; never retried. */
    | 'invalid-props'
    /** A React component is mounted outside its required parent. */
    | 'invalid-tree'
    /** Lip sync failed; only the feature stops, the stage keeps running. */
    | 'lipsync-error'
    /** A model asset failed to fetch or parse (see details.assetType/url). */
    | 'model-load-failed'
    /** The stage or renderer failed after setup (including context loss). */
    | 'render-error'
    /** The backend rejected the call (e.g. a foreign StageHandle). */
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
