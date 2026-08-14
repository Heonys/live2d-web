import { describe, expect, it } from 'vitest'
import { parseShaderErrorDetails } from './error-details'

describe('cubism model error details', () => {
  it('extracts a failed shader URL and HTTP status', () => {
    expect(parseShaderErrorDetails(new Error(
      'Failed to load shader https://cdn.example.com/shaders/mask.frag: HTTP 503',
    ))).toEqual({
      assetType: 'shader',
      backend: 'cubism-webgl',
      httpStatus: 503,
      url: 'https://cdn.example.com/shaders/mask.frag',
    })
  })

  it('still identifies compile failures as shader errors', () => {
    expect(parseShaderErrorDetails(new Error('Shader compile failed'))).toEqual({
      assetType: 'shader',
      backend: 'cubism-webgl',
      httpStatus: undefined,
      url: undefined,
    })
  })
})
