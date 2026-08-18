// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CubismRenderer } from '#cubism-framework/rendering/cubismrenderer'
import { getFrameworkReferenceCount } from './framework-manager'
import { loadFrameworkModel } from './model'
import { createWebGLStage } from './stage'

// The Framework reads Core blend constants while evaluating cubismmodel.ts, so
// the global has to exist before this file's imports run.
vi.hoisted(() => {
  const blendTypes = [
    'Normal',
    'AddGlow',
    'Add',
    'Darken',
    'Multiply',
    'ColorBurn',
    'LinearBurn',
    'Lighten',
    'Screen',
    'ColorDodge',
    'Overlay',
    'SoftLight',
    'HardLight',
    'LinearLight',
    'Hue',
    'Color',
    'AddCompatible',
    'MultiplyCompatible',
  ]
  Object.assign(globalThis, {
    Live2DCubismCore: {
      Memory: { initializeAmountOfMemory: () => {} },
      MocVersion_53: 6,
      Version: { csmGetVersion: () => 0x05030000 },
      ...Object.fromEntries(blendTypes.map((name, index) => [
        `ColorBlendType_${name}`,
        index,
      ])),
    },
  })
})

CubismRenderer.staticRelease = () => {}

const MODEL3 = JSON.stringify({
  FileReferences: { Moc: 'model.moc3', Textures: [] },
  Version: 3,
})

function createGl() {
  return {
    COLOR_BUFFER_BIT: 0x4000,
    FRAMEBUFFER: 0x8D40,
    bindFramebuffer: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    getExtension: vi.fn(() => ({ loseContext: vi.fn() })),
    isContextLost: vi.fn(() => false),
    viewport: vi.fn(),
  } as unknown as WebGL2RenderingContext
}

describe('cubism-webgl model disposal', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createGl())
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('.model3.json')) {
        return {
          arrayBuffer: async () => new TextEncoder().encode(MODEL3).buffer,
          ok: true,
          status: 200,
        } as unknown as Response
      }
      throw new DOMException('Aborted', 'AbortError')
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.querySelectorAll('canvas').forEach(canvas => canvas.remove())
  })

  it('releases the framework when the stage is disposed mid-load', async () => {
    const stage = createWebGLStage(document.body, { height: 100, width: 200 })
    const pending = loadFrameworkModel(
      stage,
      '/models/hiyori/hiyori.model3.json',
      '/shaders/',
      undefined,
    )
    stage.dispose()

    await expect(pending).rejects.toThrow()
    expect(getFrameworkReferenceCount()).toBe(0)
  })
})
