import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createTexture,
  decodeImage,
  fetchArrayBuffer,
  normalizeBaseUrl,
  resolveAssetUrl,
  virtualAssetPath,
  virtualModelUrl,
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

describe('resolver-backed models', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function bytes(text: string) {
    return new TextEncoder().encode(text).buffer as ArrayBuffer
  }

  it('resolves sibling assets against the model path, not the page', () => {
    const modelUrl = virtualModelUrl('hiyori/hiyori.model3.json')
    expect(virtualAssetPath(resolveAssetUrl('hiyori.moc3', modelUrl)))
      .toBe('hiyori/hiyori.moc3')
    expect(virtualAssetPath(resolveAssetUrl('motion/m01.motion3.json', modelUrl)))
      .toBe('hiyori/motion/m01.motion3.json')
  })

  it('keeps a traversing path inside the source', () => {
    const modelUrl = virtualModelUrl('a/b/model.model3.json')
    expect(virtualAssetPath(resolveAssetUrl('../../../../x.moc3', modelUrl)))
      .toBe('x.moc3')
  })

  // Archives from CJK riggers name files in their own script. The URL machinery
  // percent-encodes those, so without decoding every lookup in a file map keyed
  // by the real names would miss.
  it('hands the resolver decoded non-ascii paths', async () => {
    const resolveAsset = vi.fn(async () => bytes('data'))
    const modelUrl = virtualModelUrl('model.model3.json')
    await fetchArrayBuffer(
      resolveAssetUrl('exp/手姿势切换.exp3.json', modelUrl),
      'expression',
      undefined,
      resolveAsset,
    )
    expect(resolveAsset).toHaveBeenCalledWith('exp/手姿势切换.exp3.json', undefined)
  })

  it('accepts both Blob and ArrayBuffer from the resolver', async () => {
    const modelUrl = virtualModelUrl('model.model3.json')
    const fromBuffer = await fetchArrayBuffer(
      resolveAssetUrl('a.moc3', modelUrl),
      'moc3',
      undefined,
      () => bytes('buffer'),
    )
    const fromBlob = await fetchArrayBuffer(
      resolveAssetUrl('b.moc3', modelUrl),
      'moc3',
      undefined,
      () => new Blob(['blob']),
    )
    expect(new TextDecoder().decode(fromBuffer)).toBe('buffer')
    expect(new TextDecoder().decode(fromBlob)).toBe('blob')
  })

  it('reports the declared path when the resolver has no such file', async () => {
    const modelUrl = virtualModelUrl('nested/model.model3.json')
    const failure = fetchArrayBuffer(
      resolveAssetUrl('motion/gone.motion3.json', modelUrl),
      'motion',
      undefined,
      () => undefined,
    )
    await expect(failure).rejects.toMatchObject({
      code: 'model-load-failed',
      // A missing file is as final as a 404, so the runtime must not retry it.
      details: { httpStatus: 404, url: 'nested/motion/gone.motion3.json' },
    })
    await expect(failure).rejects.toThrow('nested/motion/gone.motion3.json')
  })

  it('surfaces a resolver that throws', async () => {
    const modelUrl = virtualModelUrl('model.model3.json')
    await expect(fetchArrayBuffer(
      resolveAssetUrl('a.moc3', modelUrl),
      'moc3',
      undefined,
      () => {
        throw new Error('storage is gone')
      },
    )).rejects.toThrow('resolveAsset threw while loading a.moc3.')
  })

  // A model may declare an absolute URL for a CDN-hosted texture; that is a
  // real address and has to keep going over the network.
  it('fetches absolute urls declared inside a resolver-backed model', async () => {
    const fetchMock = vi.fn(async () => ({
      blob: async () => new Blob(['remote']),
      ok: true,
      status: 200,
    } as unknown as Response))
    vi.stubGlobal('fetch', fetchMock)
    const resolveAsset = vi.fn(() => bytes('local'))
    const modelUrl = virtualModelUrl('model.model3.json')

    const buffer = await fetchArrayBuffer(
      resolveAssetUrl('https://cdn.example.com/shared.png', modelUrl),
      'texture',
      undefined,
      resolveAsset,
    )

    expect(new TextDecoder().decode(buffer)).toBe('remote')
    expect(resolveAsset).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example.com/shared.png', { signal: undefined })
  })

  it('still fetches when no resolver is given', async () => {
    const fetchMock = vi.fn(async () => ({
      blob: async () => new Blob(['served']),
      ok: true,
      status: 200,
    } as unknown as Response))
    vi.stubGlobal('fetch', fetchMock)

    const buffer = await fetchArrayBuffer('https://cdn.example.com/a.moc3', 'moc3')

    expect(new TextDecoder().decode(buffer)).toBe('served')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
