import type { ModelInfo, ModelParameterInfo } from '../../core/contract'
import type { FaceTrackingSignals } from './state'
import { describe, expect, it } from 'vitest'
import { MEDIAPIPE_BLENDSHAPES, PERFECT_SYNC_MINIMUM_PARAMETERS, PERFECT_SYNC_PARAMETER_IDS } from './blendshapes'
import { createParameterBindings, hasPerfectSyncParameters } from './mapping'

function info(parameters?: ModelParameterInfo[]): ModelInfo {
  return { expressions: [], hitAreas: [], motions: {}, parameters }
}

function signals(scores: Record<string, number> = {}): FaceTrackingSignals {
  return {
    blendshapes: new Map(MEDIAPIPE_BLENDSHAPES.map(name => [name, scores[name] ?? 0])),
    pose: { x: 15, y: -10, z: 5 },
  }
}

// A VTube Studio style rig: ARKit names, ParamTongueOut present, no ParamNeutral,
// and two cheek parameters the rigger left out.
const PERFECT_SYNC_MODEL: ModelParameterInfo[] = [
  'ParamBrowDownLeft',
  'ParamBrowDownRight',
  'ParamBrowInnerUp',
  'ParamBrowOuterUpLeft',
  'ParamBrowOuterUpRight',
  'ParamCheekPuff',
  'ParamEyeBlinkLeft',
  'ParamEyeBlinkRight',
  'ParamEyeLookDownLeft',
  'ParamEyeLookDownRight',
  'ParamEyeLookInLeft',
  'ParamEyeLookInRight',
  'ParamEyeLookOutLeft',
  'ParamEyeLookOutRight',
  'ParamEyeLookUpLeft',
  'ParamEyeLookUpRight',
  'ParamEyeSquintLeft',
  'ParamEyeSquintRight',
  'ParamEyeWideLeft',
  'ParamEyeWideRight',
  'ParamJawForward',
  'ParamJawLeft',
  'ParamJawOpen',
  'ParamJawRight',
  'ParamMouthClose',
  'ParamMouthDimpleLeft',
  'ParamMouthDimpleRight',
  'ParamMouthFrownLeft',
  'ParamMouthFrownRight',
  'ParamMouthFunnel',
  'ParamMouthLeft',
  'ParamMouthLowerDownLeft',
  'ParamMouthLowerDownRight',
  'ParamMouthPressLeft',
  'ParamMouthPressRight',
  'ParamMouthPucker',
  'ParamMouthRight',
  'ParamMouthRollLower',
  'ParamMouthRollUpper',
  'ParamMouthShrugLower',
  'ParamMouthShrugUpper',
  'ParamMouthSmileLeft',
  'ParamMouthSmileRight',
  'ParamMouthStretchLeft',
  'ParamMouthStretchRight',
  'ParamMouthUpperUpLeft',
  'ParamMouthUpperUpRight',
  'ParamNoseSneerLeft',
  'ParamNoseSneerRight',
  'ParamTongueOut',
].map(id => ({ defaultValue: 0, id, maximum: 1, minimum: 0 }))

describe('mediaPipe Live2D mapping', () => {
  it('falls back to standard parameters when metadata is absent', () => {
    const bindings = createParameterBindings(info(), {
      mapping: 'auto',
      sensitivity: { pose: 1 },
    })
    const angle = bindings.find(binding => binding.id === 'ParamAngleX')!
    const mouth = bindings.find(binding => binding.id === 'ParamMouthOpenY')!

    expect(angle.read(signals())).toBeCloseTo(15)
    expect(mouth.read(signals({ jawOpen: 0.8 }))).toBeCloseTo(0.8)
  })

  it('uses actual model ranges and omits parameters that do not exist', () => {
    const bindings = createParameterBindings(info([
      { defaultValue: 0, id: 'ParamAngleX', maximum: 20, minimum: -20 },
      { defaultValue: 0, id: 'ParamMouthOpenY', maximum: 2, minimum: 0 },
    ]), { mapping: 'standard', sensitivity: { pose: 1 } })

    expect(bindings.map(binding => binding.id)).toEqual(['ParamAngleX', 'ParamMouthOpenY'])
    expect(bindings[0].read(signals())).toBeCloseTo(10)
    expect(bindings[1].read(signals({ jawOpen: 0.5 }))).toBeCloseTo(1)
  })

  // MediaPipe reports head rotation conservatively; the multiplier is how a
  // consumer compensates without the library guessing their camera placement.
  it('scales pose by its sensitivity and still clamps to the model range', () => {
    const angleX = (pose: number) => createParameterBindings(info(), {
      mapping: 'standard',
      sensitivity: { pose },
    }).find(binding => binding.id === 'ParamAngleX')!.read(signals())

    expect(angleX(1)).toBeCloseTo(15)
    expect(angleX(2)).toBeCloseTo(30)
    // ParamAngleX tops out at 30, so a 5x request cannot exceed the rig.
    expect(angleX(5)).toBeCloseTo(30)
  })

  // A live camera at 1 looked understated enough to read as broken, so pose
  // ships amplified. Pin it: a retune should be a deliberate edit.
  it('amplifies pose by default and leaves the other channels alone', () => {
    const bindings = createParameterBindings(info(), { mapping: 'standard' })
    const read = (id: string, scores?: Record<string, number>) =>
      bindings.find(binding => binding.id === id)!.read(signals(scores))

    expect(read('ParamAngleX')).toBeCloseTo(30) // 15 degrees, tripled, clamped
    expect(read('ParamAngleZ')).toBeCloseTo(15) // 5 degrees, tripled
    expect(read('ParamMouthOpenY', { jawOpen: 0.4 })).toBeCloseTo(0.4)
  })

  // ParamEyeLOpen rests at 1 and falls toward 0, so a gain on the raw signal
  // would amplify openness instead of the blink.
  it('scales an inverted parameter away from its own default', () => {
    const eyes = (sensitivity: number) => createParameterBindings(info(), {
      mapping: 'standard',
      sensitivity: { eyes: sensitivity },
    }).find(binding => binding.id === 'ParamEyeLOpen')!

    expect(eyes(1).read(signals({ eyeBlinkLeft: 0.2 }))).toBeCloseTo(0.8)
    expect(eyes(2).read(signals({ eyeBlinkLeft: 0.2 }))).toBeCloseTo(0.6)
    expect(eyes(2).read(signals())).toBeCloseTo(1)
  })

  it('disables mouth without affecting the other channels', () => {
    const bindings = createParameterBindings(info(), {
      channels: { mouth: false },
      mapping: 'standard',
    })

    expect(bindings.some(binding => binding.channel === 'mouth')).toBe(false)
    expect(bindings.some(binding => binding.channel === 'eyes')).toBe(true)
  })

  it('recognises a real Perfect Sync model by its ARKit parameter names', () => {
    expect(hasPerfectSyncParameters(info(PERFECT_SYNC_MODEL))).toBe(true)

    const bindings = createParameterBindings(info(PERFECT_SYNC_MODEL), { mapping: 'auto' })
    const ids = bindings.map(binding => binding.id)

    expect(ids).toContain('ParamJawOpen')
    expect(ids).toContain('ParamMouthSmileLeft')
    expect(bindings.find(binding => binding.id === 'ParamJawOpen')?.read(
      signals({ jawOpen: 0.7 }),
    )).toBeCloseTo(0.7)
  })

  // `_neutral` is a MediaPipe artefact, and MediaPipe has no tongue signal, so
  // neither may become a binding even when the model declares ParamTongueOut.
  it('never binds ParamNeutral or ParamTongueOut', () => {
    const bindings = createParameterBindings(info(PERFECT_SYNC_MODEL), { mapping: 'perfect-sync' })
    const ids = bindings.map(binding => binding.id)

    expect(ids).not.toContain('ParamNeutral')
    expect(ids).not.toContain('ParamTongueOut')
  })

  it('binds only the ARKit parameters the model actually declares', () => {
    const bindings = createParameterBindings(info(PERFECT_SYNC_MODEL), { mapping: 'perfect-sync' })
    const ids = bindings.map(binding => binding.id)

    expect(ids).not.toContain('ParamCheekSquintLeft')
    expect(ids).not.toContain('ParamCheekSquintRight')
    expect(ids.filter(id => id !== 'ParamAngleX' && !id.startsWith('ParamAngle') && !id.startsWith('ParamBodyAngle')))
      .toHaveLength(PERFECT_SYNC_MODEL.length - 1)
  })

  it('reports the missing ARKit parameters for forced Perfect Sync below the threshold', () => {
    expect(() => createParameterBindings(info([]), { mapping: 'perfect-sync' })).toThrow(
      /ParamBrowDownLeft.*ParamTongueOut/,
    )
    expect(() => createParameterBindings(info([]), { mapping: 'perfect-sync' })).not.toThrow(
      /ParamNeutral/,
    )
  })

  it('keeps gaze polarity stable', () => {
    const bindings = createParameterBindings(info(), { mapping: 'standard' })
    const eyeX = bindings.find(binding => binding.id === 'ParamEyeBallX')!
    const eyeY = bindings.find(binding => binding.id === 'ParamEyeBallY')!

    expect(eyeX.read(signals({ eyeLookInRight: 1, eyeLookOutLeft: 1 }))).toBeGreaterThan(0)
    expect(eyeX.read(signals({ eyeLookInLeft: 1, eyeLookOutRight: 1 }))).toBeLessThan(0)
    expect(eyeY.read(signals({ eyeLookUpLeft: 1, eyeLookUpRight: 1 }))).toBeGreaterThan(0)
    expect(eyeY.read(signals({ eyeLookDownLeft: 1, eyeLookDownRight: 1 }))).toBeLessThan(0)
  })

  // The threshold is a heuristic chosen without a real model; pin the edge so
  // a later retune is a deliberate change, not drift.
  it('switches to Perfect Sync exactly at the minimum parameter count', () => {
    const declare = (count: number) => info(
      PERFECT_SYNC_PARAMETER_IDS.slice(0, count).map(id => ({ defaultValue: 0, id, maximum: 1, minimum: 0 })),
    )

    expect(hasPerfectSyncParameters(declare(PERFECT_SYNC_MINIMUM_PARAMETERS - 1))).toBe(false)
    expect(hasPerfectSyncParameters(declare(PERFECT_SYNC_MINIMUM_PARAMETERS))).toBe(true)
    expect(() => createParameterBindings(declare(PERFECT_SYNC_MINIMUM_PARAMETERS - 1), { mapping: 'perfect-sync' }))
      .toThrow(/needs at least 45/)
  })
})
