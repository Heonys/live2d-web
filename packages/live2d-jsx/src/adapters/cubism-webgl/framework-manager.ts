import { CubismFramework } from '#cubism-framework/live2dcubismframework'
import { Live2DError } from '../../core/errors'

interface CubismCore53Global {
  ColorBlendType_Normal?: number
  MocVersion_53?: number
}

let referenceCount = 0

function once(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

export function acquireFramework() {
  if (referenceCount === 0) {
    const core = (globalThis as typeof globalThis & {
      Live2DCubismCore?: CubismCore53Global
    }).Live2DCubismCore
    if (
      !core
      || typeof core.MocVersion_53 !== 'number'
      || typeof core.ColorBlendType_Normal !== 'number'
    ) {
      throw new Live2DError(
        'core-missing',
        'cubism-webgl requires Live2D Cubism Core 5.3.',
      )
    }
    if (!CubismFramework.startUp())
      throw new Error('CubismFramework.startUp() failed')
    CubismFramework.initialize()
  }
  referenceCount++
  return once(() => {
    referenceCount--
    if (referenceCount === 0 && CubismFramework.isInitialized())
      CubismFramework.dispose()
  })
}

export function getFrameworkReferenceCount() {
  return referenceCount
}
