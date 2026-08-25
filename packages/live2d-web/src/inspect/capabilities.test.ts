import type { ModelInfo, ModelParameterInfo } from '../core/contract'
import { describe, expect, it } from 'vitest'
import {
  PERFECT_SYNC_PARAMETER_IDS,
} from '../core/perfect-sync'
import { inspectModelCapabilities } from './capabilities'

function info(ids: readonly string[]): ModelInfo {
  const parameters: ModelParameterInfo[] = ids.map(id => ({
    defaultValue: 0,
    id,
    maximum: 1,
    minimum: -1,
  }))
  return {
    expressions: [],
    hitAreas: [],
    model3Version: 3,
    mocVersion: 6,
    motions: {},
    parameters,
  }
}

describe('model tracking capability inspection', () => {
  it('distinguishes full, partial and missing standard channels', () => {
    const report = inspectModelCapabilities(info([
      'ParamAngleX',
      'ParamAngleY',
      'ParamAngleZ',
      'ParamEyeLOpen',
      'ParamMouthOpenY',
    ]))
    expect(report.standardChannels).toEqual({
      brows: 'missing',
      cheeks: 'missing',
      eyes: 'partial',
      mouth: 'partial',
      pose: 'full',
    })
    expect(report.recommendedMapping).toBe('standard')
    expect(report).toMatchObject({ model3Version: 3, mocVersion: 6 })
  })

  it('uses the shared 45-of-52 Perfect Sync boundary', () => {
    const at44 = inspectModelCapabilities(info(PERFECT_SYNC_PARAMETER_IDS.slice(0, 44)))
    const at45 = inspectModelCapabilities(info(PERFECT_SYNC_PARAMETER_IDS.slice(0, 45)))
    const at52 = inspectModelCapabilities(info(PERFECT_SYNC_PARAMETER_IDS))

    expect(at44.perfectSync).toMatchObject({ compatible: false, matched: 44 })
    expect(at44.recommendedMapping).not.toBe('perfect-sync')
    expect(at45.perfectSync).toMatchObject({ compatible: true, matched: 45 })
    expect(at45.recommendedMapping).toBe('perfect-sync')
    expect(at52.perfectSync).toMatchObject({ compatible: true, matched: 52, missing: [] })
  })

  it('reports no mapping when parameter metadata is unavailable', () => {
    expect(inspectModelCapabilities({
      expressions: [],
      hitAreas: [],
      motions: {},
    }).recommendedMapping).toBe('none')
  })
})
