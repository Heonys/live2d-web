import type { Live2DBackend } from '../../core/contract'
import type { CubismWebGLBackendOptions } from './types'
import { normalizeBaseUrl } from './assets'
import { CUBISM_WEBGL_SHADER_SOURCES } from './shaderSources.generated'
import { createWebGLStage } from './stage'

export type { CubismWebGLBackendOptions } from './types'

function defaultShaderBaseUrl() {
  // Keep the directory dynamic so application bundlers do not try to turn a
  // package-owned directory URL into one hashed asset. Published ESM still
  // resolves it beside the adapter entry; bundled sources cover relocated JS.
  return Reflect.construct(URL, [
    './cubism-webgl-shaders/',
    import.meta.url,
  ]) as URL
}

export function createCubismWebGLBackend(
  options: CubismWebGLBackendOptions = {},
): Live2DBackend {
  return {
    createStage: createWebGLStage,
    async loadModel(stage, url, loadOptions) {
      const shaderBaseUrl = normalizeBaseUrl(
        options.shaderBaseUrl
        ?? defaultShaderBaseUrl(),
      )
      // Framework reads the user-provided Core global during module
      // evaluation. Keeping it behind loadModel makes this public adapter
      // safe to import during SSR while runtime guarantees Core is ready.
      const { loadFrameworkModel } = await import('./model')
      return loadFrameworkModel(
        stage,
        url,
        shaderBaseUrl,
        options.shaderBaseUrl ? undefined : CUBISM_WEBGL_SHADER_SOURCES,
        loadOptions,
      )
    },
  }
}

export const cubismWebGL = createCubismWebGLBackend()
