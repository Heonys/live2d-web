/**
 * 어댑터 계약 — docs/architecture.md의 백엔드 계약이 SoT.
 * 여기와 문서가 어긋나면 문서를 먼저 고친다.
 * 계약 순수성 규칙: Cubism 도메인 언어로만 쓴다. PIXI 개념 유입 금지.
 */

export interface StageOptions {
  width: number
  height: number
  /** 슈퍼샘플 배율. 기본 2 — 버퍼를 2배로 만들고 CSS로 축소(autoDensity 미사용) */
  resolution?: number
  maxFps?: number
}

export interface StageHandle {
  resize: (width: number, height: number) => void
  /** 페이지 좌표 → 렌더러 버퍼 좌표. focus()가 소비한다 */
  toWorld: (clientX: number, clientY: number) => { x: number, y: number }
  dispose: () => void
}

export interface ModelHandle {
  setParameter: (id: string, value: number) => void
  focus: (x: number, y: number) => void
  motion: (group: string, index?: number) => Promise<void>
  expression: (id?: string) => Promise<void>
  /**
   * SDK 모션 업데이트 직후에 콜백을 실행한다. 립싱크 등 파라미터를 "최종 확정"
   * 하는 코드의 유일한 진입점. 반환값은 해제 함수.
   * 이 훅의 성립 여부가 M0 스파이크의 검증 대상이다.
   */
  onAfterMotionUpdate: (cb: (deltaMs: number) => void) => () => void
  dispose: () => void
}

export interface Live2DBackend {
  /** Cubism Core 존재 검증 포함 — 없으면 명확한 에러로 즉시 실패 */
  createStage: (el: HTMLElement, opts: StageOptions) => StageHandle
  loadModel: (stage: StageHandle, url: string) => Promise<ModelHandle>
}
