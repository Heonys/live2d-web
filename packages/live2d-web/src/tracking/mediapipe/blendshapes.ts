export const MEDIAPIPE_BLENDSHAPES = Object.freeze([
  '_neutral',
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
] as const)

export type MediaPipeBlendshape = typeof MEDIAPIPE_BLENDSHAPES[number]

// Live2D Perfect Sync models name their parameters after ARKit's 52 blendshapes.
// MediaPipe emits a different 52: it adds `_neutral` and lacks `tongueOut`.
// The two sets must not be conflated, or every real Perfect Sync model fails
// detection on the one parameter it never has.
export const ARKIT_BLENDSHAPES = Object.freeze([
  ...MEDIAPIPE_BLENDSHAPES.filter((name): name is Exclude<MediaPipeBlendshape, '_neutral'> => name !== '_neutral'),
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
