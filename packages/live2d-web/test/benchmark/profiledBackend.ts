import type { Live2DBackend } from '../../src/core/contract'
import type { BenchmarkDiagnostics } from './collector'
import { normalizeBaseUrl } from '../../src/adapters/cubism-webgl/assets'
import { CUBISM_WEBGL_SHADER_SOURCES } from '../../src/adapters/cubism-webgl/shaderSources.generated'
import { createWebGLStage } from '../../src/adapters/cubism-webgl/stage'

export function createProfiledCubismWebGLBackend(
  diagnostics: BenchmarkDiagnostics,
): Live2DBackend {
  return {
    createStage(element, options) {
      return createWebGLStage(element, options, diagnostics.createStage())
    },
    async loadModel(stage, url, options) {
      const { loadFrameworkModel } = await import(
        '../../src/adapters/cubism-webgl/model',
      )
      return loadFrameworkModel(
        stage,
        url,
        normalizeBaseUrl('/assets/live2d/benchmark-shaders/'),
        CUBISM_WEBGL_SHADER_SOURCES,
        options,
      )
    },
  }
}
