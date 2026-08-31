import { CubismWebGLOffscreenManager } from '#cubism-framework/rendering/cubismoffscreenmanager'
import { CubismShaderManager_WebGL } from '#cubism-framework/rendering/cubismshader_webgl'

/**
 * The Framework keeps its compiled programs and offscreen buffers in registries
 * keyed by GL context, not by model. Releasing them when any one model goes
 * would take the shaders out from under the models still drawing on that
 * canvas, so the last model out does the releasing.
 */
const counts = new Map<WebGL2RenderingContext, number>()

function once(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

export function acquireRenderContext(gl: WebGL2RenderingContext) {
  counts.set(gl, (counts.get(gl) ?? 0) + 1)
  return once(() => {
    const remaining = (counts.get(gl) ?? 1) - 1
    if (remaining > 0) {
      counts.set(gl, remaining)
      return
    }
    counts.delete(gl)
    CubismWebGLOffscreenManager.getInstance().removeContext(gl)
    CubismShaderManager_WebGL.getInstance().releaseContext(gl)
  })
}

export function getRenderContextCount(gl: WebGL2RenderingContext) {
  return counts.get(gl) ?? 0
}
