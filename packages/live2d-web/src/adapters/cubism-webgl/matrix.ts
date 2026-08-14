import type { ModelTransform, Size } from '../../core/contract'
import type { LayoutBounds } from './types'
import { CubismMatrix44 } from '#cubism-framework/math/cubismmatrix44'

export function measureLayout(
  model: Size,
  layout: CubismMatrix44,
): LayoutBounds {
  const left = layout.transformX(-model.width / 2)
  const right = layout.transformX(model.width / 2)
  const bottom = layout.transformY(-model.height / 2)
  const top = layout.transformY(model.height / 2)
  return {
    centerX: (left + right) / 2,
    centerY: (bottom + top) / 2,
    height: Math.abs(top - bottom),
    width: Math.abs(right - left),
  }
}

export function buildMvpMatrix(
  stage: Size,
  transform: ModelTransform,
  layout: CubismMatrix44,
  bounds: LayoutBounds,
) {
  const matrix = new CubismMatrix44()
  const scaleX = 2 * transform.scale / Math.max(1, stage.width)
  const scaleY = 2 * transform.scale / Math.max(1, stage.height)
  const targetX = 2 * transform.x / Math.max(1, stage.width) - 1
  const targetY = 1 - 2 * transform.y / Math.max(1, stage.height)
  matrix.scale(scaleX, scaleY)
  matrix.translate(
    targetX - bounds.centerX * scaleX,
    targetY - bounds.centerY * scaleY,
  )
  matrix.multiplyByMatrix(layout)
  return matrix
}
