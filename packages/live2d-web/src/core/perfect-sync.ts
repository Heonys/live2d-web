// ARKit's 52 blendshapes are a model contract, not a MediaPipe runtime
// dependency. Keep the names in a renderer/provider-neutral module so the
// optional inspector can assess a rig without loading tracking code.
export const ARKIT_BLENDSHAPES = Object.freeze([
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
] as const)

export type ArkitBlendshape = typeof ARKIT_BLENDSHAPES[number]

export function perfectSyncParameterId(name: ArkitBlendshape) {
  return `Param${name[0].toUpperCase()}${name.slice(1)}`
}

export const PERFECT_SYNC_PARAMETER_IDS = Object.freeze(
  ARKIT_BLENDSHAPES.map(perfectSyncParameterId),
)

/** A model is treated as Perfect Sync once it declares at least this many ARKit parameters. */
export const PERFECT_SYNC_MINIMUM_PARAMETERS = 45
