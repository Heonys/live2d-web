import type { ModelInfo, ModelParameterInfo } from '../../core/contract'
import type { MediaPipeBlendshape } from './blendshapes'
import type { FaceTrackingSignals } from './state'
import type { MediaPipeAttachOptions, MediaPipeFaceChannel } from './types'
import {
  hasPerfectSyncParameters,
  missingPerfectSyncParameters,
} from '../../core/perfect-sync'
import {
  ARKIT_BLENDSHAPES,
  PERFECT_SYNC_MINIMUM_PARAMETERS,
  PERFECT_SYNC_PARAMETER_IDS,
  perfectSyncParameterId,
} from './blendshapes'

export { hasPerfectSyncParameters, missingPerfectSyncParameters }

export interface ParameterBinding {
  channel: MediaPipeFaceChannel
  defaultValue: number
  id: string
  read: (signals: FaceTrackingSignals) => number
}

const STANDARD_PARAMETERS: Record<string, ModelParameterInfo> = {
  ParamAngleX: { defaultValue: 0, id: 'ParamAngleX', maximum: 30, minimum: -30 },
  ParamAngleY: { defaultValue: 0, id: 'ParamAngleY', maximum: 30, minimum: -30 },
  ParamAngleZ: { defaultValue: 0, id: 'ParamAngleZ', maximum: 30, minimum: -30 },
  ParamBodyAngleX: { defaultValue: 0, id: 'ParamBodyAngleX', maximum: 10, minimum: -10 },
  ParamBodyAngleY: { defaultValue: 0, id: 'ParamBodyAngleY', maximum: 10, minimum: -10 },
  ParamBodyAngleZ: { defaultValue: 0, id: 'ParamBodyAngleZ', maximum: 10, minimum: -10 },
  ParamEyeLOpen: { defaultValue: 1, id: 'ParamEyeLOpen', maximum: 1, minimum: 0 },
  ParamEyeROpen: { defaultValue: 1, id: 'ParamEyeROpen', maximum: 1, minimum: 0 },
  ParamEyeBallX: { defaultValue: 0, id: 'ParamEyeBallX', maximum: 1, minimum: -1 },
  ParamEyeBallY: { defaultValue: 0, id: 'ParamEyeBallY', maximum: 1, minimum: -1 },
  ParamBrowLY: { defaultValue: 0, id: 'ParamBrowLY', maximum: 1, minimum: -1 },
  ParamBrowRY: { defaultValue: 0, id: 'ParamBrowRY', maximum: 1, minimum: -1 },
  ParamMouthOpenY: { defaultValue: 0, id: 'ParamMouthOpenY', maximum: 1, minimum: 0 },
  ParamMouthForm: { defaultValue: 0, id: 'ParamMouthForm', maximum: 1, minimum: -1 },
  ParamCheek: { defaultValue: 0, id: 'ParamCheek', maximum: 1, minimum: 0 },
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

/**
 * A signal is a deflection from rest, never a position in the range. Every
 * MediaPipe coefficient rests at 0 once calibration subtracts the neutral, and
 * every Live2D parameter rests at its own defaultValue, which is often not a
 * rail: the official Hiyori opens its eyes at 1.0 inside 0..1.2 and Haru at 1.0
 * inside 0..2. Reading `minimum` as the resting value left those eyes
 * permanently over-open, and the first sixth of every blink (half, on Haru) was
 * spent undoing that before the lid moved at all.
 *
 * A rigger who authored no travel on the side a channel drives gets no movement
 * from it. The polarity is not inferable: the two published Hiyori rigs declare
 * ParamCheek as -1..0 and -1..1 under the same name, so a rule that guessed the
 * active rail would drive one of them backwards.
 */
function scaleFromDefault(value: number, parameter: ModelParameterInfo) {
  const normalized = clamp(value, -1, 1)
  return clamp(
    parameter.defaultValue + normalized * (normalized >= 0
      ? parameter.maximum - parameter.defaultValue
      : parameter.defaultValue - parameter.minimum),
    parameter.minimum,
    parameter.maximum,
  )
}

function score(signals: FaceTrackingSignals, name: MediaPipeBlendshape) {
  return signals.blendshapes.get(name) ?? 0
}

function parameterMap(info: ModelInfo) {
  return new Map((info.parameters ?? []).map(parameter => [parameter.id, parameter]))
}

function isEnabled(options: MediaPipeAttachOptions, channel: MediaPipeFaceChannel) {
  return options.channels?.[channel] !== false
}

/**
 * A sensitivity of 1 maps a degree of real head rotation onto a degree of
 * model rotation. MediaPipe estimates head rotation well below what the wearer
 * feels, so pose defaults higher; 3 is where a live camera stopped looking
 * understated (2026-08-25, one laptop camera below eye level). Facial
 * coefficients already arrive normalized and need no correction.
 */
const DEFAULT_SENSITIVITY: Record<MediaPipeFaceChannel, number> = {
  brows: 1,
  cheeks: 1,
  eyes: 1,
  mouth: 1,
  pose: 3,
}

function gain(options: MediaPipeAttachOptions, channel: MediaPipeFaceChannel) {
  return options.sensitivity?.[channel] ?? DEFAULT_SENSITIVITY[channel]
}

export function createParameterBindings(
  info: ModelInfo,
  options: MediaPipeAttachOptions,
): ParameterBinding[] {
  const parameters = parameterMap(info)
  const mapping = options.mapping === 'auto' || options.mapping === undefined
    ? hasPerfectSyncParameters(info) ? 'perfect-sync' : 'standard'
    : options.mapping

  if (mapping === 'perfect-sync' && !hasPerfectSyncParameters(info)) {
    const missing = missingPerfectSyncParameters(info)
    throw new Error(
      `Perfect Sync mapping needs at least ${PERFECT_SYNC_MINIMUM_PARAMETERS} of `
      + `${PERFECT_SYNC_PARAMETER_IDS.length} ARKit parameters; missing: ${missing.join(', ')}`,
    )
  }

  const bindings: ParameterBinding[] = []
  const add = (
    id: string,
    channel: MediaPipeFaceChannel,
    read: (signals: FaceTrackingSignals) => number,
    required = false,
  ) => {
    if (!isEnabled(options, channel))
      return
    const parameter = parameters.get(id) ?? (info.parameters ? undefined : STANDARD_PARAMETERS[id])
    if (!parameter && !required)
      return
    const range = parameter ?? STANDARD_PARAMETERS[id]
    if (!range)
      return
    // Sensitivity scales the distance from the parameter's own default, not the
    // incoming signal. That reads correctly on an inverted parameter too:
    // ParamEyeLOpen rests at 1, so the gain lands on the blink rather than on
    // the openness. The model's range still clamps, so turning sensitivity up
    // cannot push a parameter past what the rigger allowed.
    const channelGain = gain(options, channel)
    bindings.push({
      channel,
      defaultValue: range.defaultValue,
      id,
      read: (signals) => {
        const scaled = scaleFromDefault(read(signals), range)
        if (channelGain === 1)
          return scaled
        return clamp(
          range.defaultValue + (scaled - range.defaultValue) * channelGain,
          range.minimum,
          range.maximum,
        )
      },
    })
  }

  add('ParamAngleX', 'pose', signals => signals.pose.x / 30)
  add('ParamAngleY', 'pose', signals => signals.pose.y / 30)
  add('ParamAngleZ', 'pose', signals => signals.pose.z / 30)
  add('ParamBodyAngleX', 'pose', signals => signals.pose.x / 30 * 0.3)
  add('ParamBodyAngleY', 'pose', signals => signals.pose.y / 30 * 0.3)
  add('ParamBodyAngleZ', 'pose', signals => signals.pose.z / 30 * 0.3)

  if (mapping === 'perfect-sync') {
    for (const name of ARKIT_BLENDSHAPES) {
      // MediaPipe never reports tongueOut; leave that parameter at the model default.
      if (name === 'tongueOut')
        continue
      const channel: MediaPipeFaceChannel = name.startsWith('eye')
        ? 'eyes'
        : name.startsWith('brow')
          ? 'brows'
          : name.startsWith('cheek') || name.startsWith('nose')
            ? 'cheeks'
            : 'mouth'
      add(perfectSyncParameterId(name), channel, signals => score(signals, name))
    }
    return bindings
  }

  // A blink drives the lid down from wherever the rig rests it open, which is
  // not the top of its range.
  const blink = (
    blinkName: MediaPipeBlendshape,
    squintName: MediaPipeBlendshape,
  ) => (signals: FaceTrackingSignals) => -Math.max(
    score(signals, blinkName),
    score(signals, squintName) * 0.6,
  )
  add('ParamEyeLOpen', 'eyes', blink('eyeBlinkLeft', 'eyeSquintLeft'))
  add('ParamEyeROpen', 'eyes', blink('eyeBlinkRight', 'eyeSquintRight'))
  add('ParamEyeBallX', 'eyes', signals => (
    score(signals, 'eyeLookOutLeft') - score(signals, 'eyeLookInLeft')
    + score(signals, 'eyeLookInRight') - score(signals, 'eyeLookOutRight')
  ) / 2)
  add('ParamEyeBallY', 'eyes', signals => (
    score(signals, 'eyeLookUpLeft') + score(signals, 'eyeLookUpRight')
    - score(signals, 'eyeLookDownLeft') - score(signals, 'eyeLookDownRight')
  ) / 2)
  add('ParamBrowLY', 'brows', signals => Math.max(
    score(signals, 'browInnerUp'),
    score(signals, 'browOuterUpLeft'),
  ) - score(signals, 'browDownLeft'))
  add('ParamBrowRY', 'brows', signals => Math.max(
    score(signals, 'browInnerUp'),
    score(signals, 'browOuterUpRight'),
  ) - score(signals, 'browDownRight'))
  add('ParamMouthOpenY', 'mouth', signals => Math.max(
    score(signals, 'jawOpen'),
    score(signals, 'mouthFunnel') * 0.65,
  ))
  add('ParamMouthForm', 'mouth', signals => (
    score(signals, 'mouthSmileLeft') + score(signals, 'mouthSmileRight')
    - score(signals, 'mouthFrownLeft') - score(signals, 'mouthFrownRight')
  ) / 2)
  add('ParamCheek', 'cheeks', signals => Math.max(
    score(signals, 'cheekPuff'),
    score(signals, 'cheekSquintLeft'),
    score(signals, 'cheekSquintRight'),
  ))
  return bindings
}
