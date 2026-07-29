import type { Live2DBackend } from '../../core/contract'
import { Live2DError } from '../../core/errors'

const NOT_IMPLEMENTED
  = 'The pixi-v6 adapter is not implemented yet (waiting on the M0 spike — see docs/roadmap.md).'

/**
 * pixi-live2d-display@0.4 + PIXI v6 어댑터.
 * M0 스파이크(onAfterMotionUpdate 성립 검증) 통과 후 구현한다 — 스캐폴딩 단계에서는
 * 서브패스 진입점과 계약 타입만 고정한다. 그 전까지 pixi를 import하지 않는다.
 */
export const pixiV6: Live2DBackend = {
  createStage() {
    throw new Live2DError('adapter-error', NOT_IMPLEMENTED)
  },
  loadModel() {
    return Promise.reject(new Live2DError('adapter-error', NOT_IMPLEMENTED))
  },
}
