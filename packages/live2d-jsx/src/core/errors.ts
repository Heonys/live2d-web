export type Live2DErrorCode
  = 'core-missing' | 'model-load-failed' | 'render-error' | 'adapter-error'

/** 제품 약속 1: 조용한 실패 없음 — 모든 실패는 code가 붙은 이 에러로 표면화된다 */
export class Live2DError extends Error {
  readonly code: Live2DErrorCode

  constructor(code: Live2DErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'Live2DError'
    this.code = code
  }
}
