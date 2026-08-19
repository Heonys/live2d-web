import type { Live2DBackend } from '../../src/core/contract'
import type { BenchmarkDiagnostics } from './collector'
import { normalizeBaseUrl } from '../../src/backends/cubism-webgl/assets'
import { CUBISM_WEBGL_SHADER_SOURCES } from '../../src/backends/cubism-webgl/shaderSources.generated'
import { createWebGLStage } from '../../src/backends/cubism-webgl/stage'

export function createProfiledCubismWebGLBackend(
  diagnostics: BenchmarkDiagnostics,
): Live2DBackend {
  return {
    createStage(element, options) {
      return createWebGLStage(element, options, diagnostics.createStage())
    },
    async loadModel(stage, url, options) {
      const { loadFrameworkModel } = await import(
        '../../src/backends/cubism-webgl/model',
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
