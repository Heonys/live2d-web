// 코어 배럴 — pixi import 금지(계약 순수성 규칙, docs/architecture.md).
// 어댑터는 서브패스로만 노출한다: live2d-jsx/adapters/pixi-v6
export type { Live2DBackend, ModelHandle, StageHandle, StageOptions } from './core/contract'
export { ensureCubismCore } from './core/ensureCubismCore'
export { Live2DError } from './core/errors'
export type { Live2DErrorCode } from './core/errors'
