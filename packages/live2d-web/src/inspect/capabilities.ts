import type { ModelInfo } from '../core/contract'
import type {
  ModelCapabilityReport,
  ModelTrackingChannel,
  ModelTrackingChannelSupport,
} from './types'
import {
  PERFECT_SYNC_MINIMUM_PARAMETERS,
  PERFECT_SYNC_PARAMETER_IDS,
} from '../core/perfect-sync'

const STANDARD_CHANNEL_PARAMETERS: Readonly<Record<ModelTrackingChannel, readonly string[]>> = {
  brows: ['ParamBrowLY', 'ParamBrowRY'],
  cheeks: ['ParamCheek'],
  eyes: ['ParamEyeLOpen', 'ParamEyeROpen', 'ParamEyeBallX', 'ParamEyeBallY'],
  mouth: ['ParamMouthOpenY', 'ParamMouthForm'],
  pose: ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ'],
}

function channelSupport(
  ids: ReadonlySet<string>,
  required: readonly string[],
): ModelTrackingChannelSupport {
  const matched = required.filter(id => ids.has(id)).length
  if (matched === 0)
    return 'missing'
  return matched === required.length ? 'full' : 'partial'
}

/** Reports Standard channel and ARKit Perfect Sync coverage from model metadata. */
export function inspectModelCapabilities(info: ModelInfo): ModelCapabilityReport {
  const parameterIds = new Set(info.parameters?.map(parameter => parameter.id) ?? [])
  const standardChannels = Object.fromEntries(
    Object.entries(STANDARD_CHANNEL_PARAMETERS).map(([channel, required]) => [
      channel,
      channelSupport(parameterIds, required),
    ]),
  ) as Record<ModelTrackingChannel, ModelTrackingChannelSupport>
  const missing = PERFECT_SYNC_PARAMETER_IDS.filter(id => !parameterIds.has(id))
  const matched = PERFECT_SYNC_PARAMETER_IDS.length - missing.length
  const perfectSync = matched >= PERFECT_SYNC_MINIMUM_PARAMETERS
  const standard = Object.values(standardChannels).some(value => value !== 'missing')

  return {
    model3Version: info.model3Version,
    mocVersion: info.mocVersion,
    perfectSync: {
      compatible: perfectSync,
      matched,
      minimum: PERFECT_SYNC_MINIMUM_PARAMETERS,
      missing,
      total: 52,
    },
    recommendedMapping: perfectSync ? 'perfect-sync' : standard ? 'standard' : 'none',
    standardChannels: Object.freeze(standardChannels),
  }
}
