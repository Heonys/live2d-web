import { describe, expect, it } from 'vitest'
import { CubismModelMatrix } from '#cubism-framework/math/cubismmodelmatrix'
import { fitModel } from '../../core/fit'
import { buildMvpMatrix, measureLayout } from './matrix'

describe('cubism CSS fit to clip-space matrix', () => {
  it('centers a translated model layout and preserves aspect ratio', () => {
    const layout = new CubismModelMatrix(4, 2)
    layout.setupFromLayout(new Map([['center_x', 0.25]]))
    const bounds = measureLayout({ height: 2, width: 4 }, layout)
    const stage = { height: 800, width: 400 }
    const transform = fitModel(stage, bounds, 'full')
    const mvp = buildMvpMatrix(stage, transform, layout, bounds)

    expect(mvp.transformX(0)).toBeCloseTo(0, 6)
    expect(mvp.transformY(0)).toBeCloseTo(0, 6)
    expect(mvp.transformX(-2)).toBeCloseTo(-1, 6)
    expect(mvp.transformX(2)).toBeCloseTo(1, 6)
    expect(mvp.transformY(-1)).toBeCloseTo(-0.25, 6)
    expect(mvp.transformY(1)).toBeCloseTo(0.25, 6)
  })

  it('uses CSS dimensions only, independently of backing-buffer DPR', () => {
    const layout = new CubismModelMatrix(2, 2)
    const bounds = measureLayout({ height: 2, width: 2 }, layout)
    const stage = { height: 300, width: 600 }
    const transform = fitModel(stage, bounds, {
      offsetX: 12,
      offsetY: -8,
      scale: 1.2,
    })
    const first = buildMvpMatrix(stage, transform, layout, bounds).getArray()
    const second = buildMvpMatrix(stage, transform, layout, bounds).getArray()

    expect([...first]).toEqual([...second])
  })
})
