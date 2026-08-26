import type { Live2DAssetResolver } from '../core/contract'
import type { Live2DAssetType } from '../core/errors'

export interface ModelInspectionLimits {
  /** Maximum bytes read from one model asset. Defaults to 64 MiB. */
  maxAssetBytes?: number
  /** Maximum number of declared model assets. Defaults to 2,048. */
  maxReferences?: number
  /** Maximum bytes read across the model and its assets. Defaults to 256 MiB. */
  maxTotalBytes?: number
}

interface InspectModelSourceBase {
  limits?: ModelInspectionLimits
  signal?: AbortSignal
  src: string
}

export type InspectModelSourceOptions
  = | (InspectModelSourceBase & { resolveAsset?: never })
    | (InspectModelSourceBase & { resolveAsset: Live2DAssetResolver })

export type ModelInspectionStatus = 'compatible' | 'warning' | 'incompatible'
export type ModelInspectionSeverity = 'warning' | 'error'
export type ModelInspectionAssetStatus
  = 'available' | 'external' | 'missing' | 'too-large' | 'unreadable'

export type ModelInspectionFindingCode
  = | 'asset-too-large'
    | 'cross-origin-asset'
    | 'empty-reference'
    | 'external-asset'
    | 'invalid-model3'
    | 'missing-asset'
    | 'missing-file-reference'
    | 'too-many-references'
    | 'total-assets-too-large'
    | 'unreadable-asset'
    | 'unsupported-model3-version'

/** One stable, actionable content finding discovered during source inspection. */
export interface ModelInspectionFinding {
  assetType?: Live2DAssetType
  code: ModelInspectionFindingCode
  message: string
  path?: string
  severity: ModelInspectionSeverity
}

export interface ModelInspectionAsset {
  assetType: Live2DAssetType
  bytes?: number
  external: boolean
  path: string
  status: ModelInspectionAssetStatus
}

/** Aggregate source report. An error finding makes the report incompatible. */
export interface ModelInspectionReport {
  assets: readonly ModelInspectionAsset[]
  expressions: readonly string[]
  findings: readonly ModelInspectionFinding[]
  hitAreas: readonly string[]
  model3Version?: number
  motions: Readonly<Record<string, number>>
  source: string
  status: ModelInspectionStatus
}

export type ModelTrackingChannel = 'pose' | 'eyes' | 'brows' | 'mouth' | 'cheeks'
export type ModelTrackingChannelSupport = 'full' | 'partial' | 'missing'

/** Tracking parameter coverage derived from a loaded backend's ModelInfo. */
export interface ModelCapabilityReport {
  model3Version?: number
  mocVersion?: number
  perfectSync: {
    compatible: boolean
    matched: number
    minimum: number
    missing: readonly string[]
    total: number
  }
  recommendedMapping: 'standard' | 'perfect-sync' | 'none'
  standardChannels: Readonly<Record<ModelTrackingChannel, ModelTrackingChannelSupport>>
}
