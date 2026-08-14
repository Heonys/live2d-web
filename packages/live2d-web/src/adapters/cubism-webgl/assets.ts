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

async function checkedResponse(url: string, signal: AbortSignal | undefined) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Live2DError(
      'model-load-failed',
      `Failed to load ${url}: HTTP ${response.status}`,
    )
  }
  return response
}

export async function fetchArrayBuffer(url: string, signal?: AbortSignal) {
  const response = await checkedResponse(url, signal)
  const buffer = await response.arrayBuffer()
  if (buffer.byteLength === 0) {
    throw new Live2DError('model-load-failed', `Loaded an empty asset from ${url}.`)
  }
  return buffer
}

async function decodeImage(blob: Blob, signal?: AbortSignal): Promise<TexImageSource> {
  if (signal?.aborted)
    throw signal.reason
  if (typeof createImageBitmap === 'function')
    return createImageBitmap(blob, { premultiplyAlpha: 'premultiply' })

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
        reject(new Live2DError('model-load-failed', 'Failed to decode a model texture.'))
      }
      image.src = objectUrl
    })
  }
  finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function createTexture(
  gl: WebGL2RenderingContext,
  url: string,
  signal?: AbortSignal,
  diagnostics?: CubismBenchmarkStageDiagnostics,
) {
  const blob = await measureAsync(diagnostics, 'textureFetch', async () => {
    const response = await checkedResponse(url, signal)
    return response.blob()
  })
  const source = await measureAsync(
    diagnostics,
    'textureDecode',
    () => decodeImage(blob, signal),
  )
  if (signal?.aborted) {
    if ('close' in source && typeof source.close === 'function')
      source.close()
    throw signal.reason
  }

  const texture = gl.createTexture()
  if (!texture) {
    if ('close' in source && typeof source.close === 'function')
      source.close()
    throw new Live2DError('render-error', `WebGL failed to create a texture for ${url}.`)
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
    throw error
  }
  finally {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previousPremultiply)
    if ('close' in source && typeof source.close === 'function')
      source.close()
  }
}
