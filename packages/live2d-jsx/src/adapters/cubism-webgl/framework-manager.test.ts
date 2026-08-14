import { afterEach, describe, expect, it } from 'vitest'
import { CubismRenderer } from '#cubism-framework/rendering/cubismrenderer'
import {
  acquireFramework,
  getFrameworkReferenceCount,
} from './framework-manager'

Object.assign(globalThis, {
  Live2DCubismCore: {
    ColorBlendType_Normal: 0,
    Memory: { initializeAmountOfMemory: () => {} },
    MocVersion_53: 6,
    Version: { csmGetVersion: () => 0x05030000 },
  },
})
CubismRenderer.staticRelease = () => {}

const cleanups: Array<() => void> = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse())
    cleanup()
  expect(getFrameworkReferenceCount()).toBe(0)
})

describe('cubism Framework lifetime', () => {
  it('rejects a Core that does not expose the 5.3 API', () => {
    const core = (globalThis as typeof globalThis & {
      Live2DCubismCore: {
        MocVersion_53?: number
      }
    }).Live2DCubismCore
    const version = core.MocVersion_53
    delete core.MocVersion_53
    expect(() => acquireFramework()).toThrow('requires Live2D Cubism Core 5.3')
    core.MocVersion_53 = version
  })

  it('keeps Framework alive until the last model releases it', () => {
    const releaseFirst = acquireFramework()
    cleanups.push(releaseFirst)
    const releaseSecond = acquireFramework()
    cleanups.push(releaseSecond)

    expect(getFrameworkReferenceCount()).toBe(2)
    releaseFirst()
    expect(getFrameworkReferenceCount()).toBe(1)
    releaseFirst()
    expect(getFrameworkReferenceCount()).toBe(1)
    releaseSecond()
    expect(getFrameworkReferenceCount()).toBe(0)
  })
})
