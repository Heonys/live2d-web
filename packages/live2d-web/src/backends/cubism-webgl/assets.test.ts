import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTexture,
  decodeImage,
  fetchArrayBuffer,
  normalizeBaseUrl,
  resolveAssetUrl,
} from './assets'

describe('cubism asset URLs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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

  it('reports the final asset URL, kind and HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 404,
      statusText: 'Not Found',
    })))

    await expect(fetchArrayBuffer(
      'https://cdn.example.com/models/motions/tap.motion3.json',
      'motion',
    )).rejects.toMatchObject({
      code: 'model-load-failed',
      details: {
        assetType: 'motion',
        backend: 'cubism-webgl',
        httpStatus: 404,
        url: 'https://cdn.example.com/models/motions/tap.motion3.json',
      },
    })
  })

  it('keeps network failures attributable to their asset', async () => {
    const cause = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(cause))

    await expect(fetchArrayBuffer(
      'https://cdn.example.com/models/hiyori.moc3',
      'moc3',
    )).rejects.toMatchObject({
      cause,
      details: {
        assetType: 'moc3',
        backend: 'cubism-webgl',
        url: 'https://cdn.example.com/models/hiyori.moc3',
      },
    })
  })

  it('keeps image decode failures attributable to the texture URL', async () => {
    const cause = new DOMException('invalid image', 'EncodingError')
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(cause))

    await expect(decodeImage(
      new Blob(['not an image']),
      'https://cdn.example.com/models/texture.png',
    )).rejects.toMatchObject({
      cause,
      code: 'model-load-failed',
      details: {
        assetType: 'texture',
        backend: 'cubism-webgl',
        url: 'https://cdn.example.com/models/texture.png',
      },
    })
  })

  it('keeps WebGL upload failures attributable to the texture URL', async () => {
    const cause = new Error('invalid texture upload')
    const texture = {} as WebGLTexture
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Blob(['image']))))
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const gl = {
      CLAMP_TO_EDGE: 1,
      LINEAR: 2,
      LINEAR_MIPMAP_LINEAR: 3,
      RGBA: 4,
      TEXTURE_2D: 5,
      TEXTURE_MAG_FILTER: 6,
      TEXTURE_MIN_FILTER: 7,
      TEXTURE_WRAP_S: 8,
      TEXTURE_WRAP_T: 9,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 10,
      UNSIGNED_BYTE: 11,
      bindTexture: vi.fn(),
      createTexture: vi.fn(() => texture),
      deleteTexture: vi.fn(),
      generateMipmap: vi.fn(),
      getParameter: vi.fn(() => false),
      pixelStorei: vi.fn(),
      texImage2D: vi.fn(() => { throw cause }),
      texParameteri: vi.fn(),
    } as unknown as WebGL2RenderingContext

    await expect(createTexture(
      gl,
      'https://cdn.example.com/models/texture.png',
    )).rejects.toMatchObject({
      cause,
      code: 'render-error',
      details: {
        assetType: 'texture',
        backend: 'cubism-webgl',
        url: 'https://cdn.example.com/models/texture.png',
      },
    })
    expect(gl.deleteTexture).toHaveBeenCalledWith(texture)
  })
})
