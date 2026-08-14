import { describe, expect, it } from 'vitest'
import { Live2DError } from './errors'

describe('live2DError', () => {
  it('copies and freezes public diagnostic details', () => {
    const details = {
      assetType: 'texture' as const,
      backend: 'cubism-webgl',
      httpStatus: 404,
      url: 'https://cdn.example.com/texture.png',
    }
    const error = new Live2DError('model-load-failed', 'missing', { details })
    details.url = 'https://cdn.example.com/changed.png'

    expect(error.details).toEqual({
      assetType: 'texture',
      backend: 'cubism-webgl',
      httpStatus: 404,
      url: 'https://cdn.example.com/texture.png',
    })
    expect(Object.isFrozen(error.details)).toBe(true)
  })
})
