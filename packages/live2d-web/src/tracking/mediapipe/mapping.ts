import type { ModelInfo, ModelParameterInfo } from '../../core/contract'
import type { MediaPipeBlendshape } from './blendshapes'
import type { FaceTrackingSignals } from './state'
import type { MediaPipeAttachOptions, MediaPipeFaceChannel } from './types'
import {
  ARKIT_BLENDSHAPES,
  PERFECT_SYNC_MINIMUM_PARAMETERS,
  PERFECT_SYNC_PARAMETER_IDS,
  perfectSyncParameterId,
} from './blendshapes'

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

function scaleSigned(value: number, parameter: ModelParameterInfo) {
  const normalized = clamp(value, -1, 1)
  return clamp(
    parameter.defaultValue + normalized * (normalized >= 0
      ? parameter.maximum - parameter.defaultValue
      : parameter.defaultValue - parameter.minimum),
    parameter.minimum,
    parameter.maximum,
  )
}

function scaleUnit(value: number, parameter: ModelParameterInfo) {
  return clamp(
    parameter.minimum + clamp(value, 0, 1) * (parameter.maximum - parameter.minimum),
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

export function missingPerfectSyncParameters(info: ModelInfo) {
  const ids = new Set(info.parameters?.map(parameter => parameter.id) ?? [])
  return PERFECT_SYNC_PARAMETER_IDS.filter(id => !ids.has(id))
}

// Riggers routinely drop a few ARKit parameters (tongue, cheeks), so demanding
// all 52 would reject nearly every real model.
export function hasPerfectSyncParameters(info: ModelInfo) {
  const missing = missingPerfectSyncParameters(info).length
  return PERFECT_SYNC_PARAMETER_IDS.length - missing >= PERFECT_SYNC_MINIMUM_PARAMETERS
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
    normalized: 'signed' | 'unit',
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
    bindings.push({
      channel,
      defaultValue: range.defaultValue,
      id,
      read: signals => normalized === 'unit'
        ? scaleUnit(read(signals), range)
        : scaleSigned(read(signals), range),
    })
  }

  add('ParamAngleX', 'pose', 'signed', signals => signals.pose.x / 30)
  add('ParamAngleY', 'pose', 'signed', signals => signals.pose.y / 30)
  add('ParamAngleZ', 'pose', 'signed', signals => signals.pose.z / 30)
  add('ParamBodyAngleX', 'pose', 'signed', signals => signals.pose.x / 30 * 0.3)
  add('ParamBodyAngleY', 'pose', 'signed', signals => signals.pose.y / 30 * 0.3)
  add('ParamBodyAngleZ', 'pose', 'signed', signals => signals.pose.z / 30 * 0.3)

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
      add(perfectSyncParameterId(name), channel, 'unit', signals => score(signals, name))
    }
    return bindings
  }

  add('ParamEyeLOpen', 'eyes', 'unit', signals => 1 - Math.max(
    score(signals, 'eyeBlinkLeft'),
    score(signals, 'eyeSquintLeft') * 0.6,
  ))
  add('ParamEyeROpen', 'eyes', 'unit', signals => 1 - Math.max(
    score(signals, 'eyeBlinkRight'),
    score(signals, 'eyeSquintRight') * 0.6,
  ))
  add('ParamEyeBallX', 'eyes', 'signed', signals => (
    score(signals, 'eyeLookOutLeft') - score(signals, 'eyeLookInLeft')
    + score(signals, 'eyeLookInRight') - score(signals, 'eyeLookOutRight')
  ) / 2)
  add('ParamEyeBallY', 'eyes', 'signed', signals => (
    score(signals, 'eyeLookUpLeft') + score(signals, 'eyeLookUpRight')
    - score(signals, 'eyeLookDownLeft') - score(signals, 'eyeLookDownRight')
  ) / 2)
  add('ParamBrowLY', 'brows', 'signed', signals => Math.max(
    score(signals, 'browInnerUp'),
    score(signals, 'browOuterUpLeft'),
  ) - score(signals, 'browDownLeft'))
  add('ParamBrowRY', 'brows', 'signed', signals => Math.max(
    score(signals, 'browInnerUp'),
    score(signals, 'browOuterUpRight'),
  ) - score(signals, 'browDownRight'))
  add('ParamMouthOpenY', 'mouth', 'unit', signals => Math.max(
    score(signals, 'jawOpen'),
    score(signals, 'mouthFunnel') * 0.65,
  ))
  add('ParamMouthForm', 'mouth', 'signed', signals => (
    score(signals, 'mouthSmileLeft') + score(signals, 'mouthSmileRight')
    - score(signals, 'mouthFrownLeft') - score(signals, 'mouthFrownRight')
  ) / 2)
  add('ParamCheek', 'cheeks', 'unit', signals => Math.max(
    score(signals, 'cheekPuff'),
    score(signals, 'cheekSquintLeft'),
    score(signals, 'cheekSquintRight'),
  ))
  return bindings
}
