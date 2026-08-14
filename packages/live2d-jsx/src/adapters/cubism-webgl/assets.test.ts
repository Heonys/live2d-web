import { describe, expect, it } from 'vitest'
import { normalizeBaseUrl, resolveAssetUrl } from './assets'

describe('cubism asset URLs', () => {
  it('resolves model assets from the final model URL', () => {
    expect(resolveAssetUrl(
      '../textures/face.png',
      'https://cdn.example.com/models/hiyori/Hiyori.model3.json?rev=3',
    )).toBe('https://cdn.example.com/models/textures/face.png')
  })

  it('normalizes an explicit shader directory', () => {
    expect(normalizeBaseUrl('https://cdn.example.com/shaders'))
      .toBe('https://cdn.example.com/shaders/')
  })
})
