import type { ModelInfo, ModelParameterInfo } from '../../core/contract'
import type { FaceTrackingSignals } from './state'
import { describe, expect, it } from 'vitest'
import {
  MEDIAPIPE_BLENDSHAPES,
  PERFECT_SYNC_PARAMETER_IDS,
} from './blendshapes'
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

describe('mediaPipe Live2D mapping', () => {
  it('falls back to standard parameters when metadata is absent', () => {
    const bindings = createParameterBindings(info(), { mapping: 'auto' })
    const angle = bindings.find(binding => binding.id === 'ParamAngleX')!
    const mouth = bindings.find(binding => binding.id === 'ParamMouthOpenY')!

    expect(angle.read(signals())).toBeCloseTo(15)
    expect(mouth.read(signals({ jawOpen: 0.8 }))).toBeCloseTo(0.8)
  })

  it('uses actual model ranges and omits parameters that do not exist', () => {
    const bindings = createParameterBindings(info([
      { defaultValue: 0, id: 'ParamAngleX', maximum: 20, minimum: -20 },
      { defaultValue: 0, id: 'ParamMouthOpenY', maximum: 2, minimum: 0 },
    ]), { mapping: 'standard' })

    expect(bindings.map(binding => binding.id)).toEqual(['ParamAngleX', 'ParamMouthOpenY'])
    expect(bindings[0].read(signals())).toBeCloseTo(10)
    expect(bindings[1].read(signals({ jawOpen: 0.5 }))).toBeCloseTo(1)
  })

  it('disables mouth without affecting the other channels', () => {
    const bindings = createParameterBindings(info(), {
      channels: { mouth: false },
      mapping: 'standard',
    })

    expect(bindings.some(binding => binding.channel === 'mouth')).toBe(false)
    expect(bindings.some(binding => binding.channel === 'eyes')).toBe(true)
  })

  it('detects and maps all 52 Perfect Sync parameters', () => {
    const parameters = PERFECT_SYNC_PARAMETER_IDS.map(id => ({
      defaultValue: 0,
      id,
      maximum: 1,
      minimum: 0,
    }))
    expect(hasPerfectSyncParameters(info(parameters))).toBe(true)

    const bindings = createParameterBindings(info(parameters), { mapping: 'auto' })
    const perfect = bindings.filter(binding => PERFECT_SYNC_PARAMETER_IDS.includes(binding.id))
    expect(perfect).toHaveLength(52)
    expect(perfect.find(binding => binding.id === 'ParamJawOpen')?.read(
      signals({ jawOpen: 0.7 }),
    )).toBeCloseTo(0.7)
  })

  it('reports every missing parameter for forced Perfect Sync', () => {
    expect(() => createParameterBindings(info([]), { mapping: 'perfect-sync' })).toThrow(
      /ParamNeutral.*ParamBrowDownLeft.*ParamNoseSneerRight/,
    )
  })
})
