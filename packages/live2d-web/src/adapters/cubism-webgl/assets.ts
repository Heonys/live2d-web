import type { Live2DAssetType } from '../../core/errors'
import type { CubismBenchmarkStageDiagnostics } from './diagnostics'
import { Live2DError } from '../../core/errors'
import { measureAsync, measureSync } from './diagnostics'

export function resolveAssetUrl(path: string, modelUrl: string) {
  return new URL(path, modelUrl).href
}

export function normalizeBaseUrl(value: string | URL) {
  const base = typeof window === 'undefined' ? undefined : window.location.href
  const url = value instanceof URL
    ? new URL(value.href)
    : base
      ? new URL(value, base)
      : new URL(value)
  if (!url.pathname.endsWith('/'))
    url.pathname += '/'
  return url.href
}

function assetDetails(assetType: Live2DAssetType, url: string, httpStatus?: number) {
  return {
    assetType,
    backend: 'cubism-webgl',
    httpStatus,
    url,
  } as const
}

async function checkedResponse(
  url: string,
  assetType: Live2DAssetType,
  signal: AbortSignal | undefined,
) {
  let response: Response
  try {
    response = await fetch(url, { signal })
  }
  catch (error) {
    if (signal?.aborted)
      throw signal.reason
    throw new Live2DError(
      'model-load-failed',
      `Failed to load ${url}.`,
      { cause: error, details: assetDetails(assetType, url) },
    )
  }
  if (!response.ok) {
    throw new Live2DError(
      'model-load-failed',
      `Failed to load ${url}: HTTP ${response.status}`,
      { details: assetDetails(assetType, url, response.status) },
    )
  }
  return response
}

export async function fetchArrayBuffer(
  url: string,
  assetType: Live2DAssetType,
  signal?: AbortSignal,
) {
  const response = await checkedResponse(url, assetType, signal)
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0) {
    throw new Live2DError(
      'model-load-failed',
      `Loaded an empty asset from ${url}.`,
      { details: assetDetails(assetType, url) },
    )
  }
  return buffer
}

export async function decodeImage(
  blob: Blob,
  url: string,
  signal?: AbortSignal,
): Promise<TexImageSource> {
  if (signal?.aborted)
    throw signal.reason
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { premultiplyAlpha: 'premultiply' })
    }
    catch (error) {
      if (signal?.aborted)
        throw signal.reason
      throw new Live2DError(
        'model-load-failed',
        `Failed to decode model texture ${url}.`,
        { cause: error, details: assetDetails('texture', url) },
      )
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      const onAbort = () => reject(signal?.reason)
      signal?.addEventListener('abort', onAbort, { once: true })
      image.onload = () => {
        signal?.removeEventListener('abort', onAbort)
        resolve(image)
      }
      image.onerror = () => {
        signal?.removeEventListener('abort', onAbort)
        reject(new Live2DError(
          'model-load-failed',
          `Failed to decode model texture ${url}.`,
          { details: assetDetails('texture', url) },
        ))
      }
      image.src = objectUrl
    })
  }
  finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function closeTextureSource(source: TexImageSource) {
  if ('close' in source && typeof source.close === 'function')
    source.close()
}

export async function fetchTextureSource(
  url: string,
  signal?: AbortSignal,
  diagnostics?: CubismBenchmarkStageDiagnostics,
): Promise<TexImageSource> {
  const blob = await measureAsync(diagnostics, 'textureFetch', async () => {
    const response = await checkedResponse(url, 'texture', signal)
    return response.blob()
  })
  return measureAsync(
    diagnostics,
    'textureDecode',
    () => decodeImage(blob, url, signal),
  )
}

export function uploadTexture(
  gl: WebGL2RenderingContext,
  source: TexImageSource,
  url: string,
  diagnostics?: CubismBenchmarkStageDiagnostics,
) {
  const texture = gl.createTexture()
  if (!texture) {
    closeTextureSource(source)
    throw new Live2DError(
      'render-error',
      `WebGL failed to create a texture for ${url}.`,
      { details: assetDetails('texture', url) },
    )
  }
  const previousPremultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)
  try {
    measureSync(diagnostics, 'load', 'textureUpload', () => {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      )
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.bindTexture(gl.TEXTURE_2D, null)
    })
    return texture
  }
  catch (error) {
    gl.deleteTexture(texture)
    if (error instanceof Live2DError)
      throw error
    throw new Live2DError(
      'render-error',
      `Failed to upload model texture ${url} to WebGL.`,
      { cause: error, details: assetDetails('texture', url) },
    )
  }
  finally {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previousPremultiply)
    closeTextureSource(source)
  }
}

export async function createTexture(
  gl: WebGL2RenderingContext,
  url: string,
  signal?: AbortSignal,
  diagnostics?: CubismBenchmarkStageDiagnostics,
) {
  const source = await fetchTextureSource(url, signal, diagnostics)
  if (signal?.aborted) {
    closeTextureSource(source)
    throw signal.reason
  }
  return uploadTexture(gl, source, url, diagnostics)
}
