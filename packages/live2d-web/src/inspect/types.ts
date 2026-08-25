import type {
  Live2DAssetResolver,
  ModelInfo,
} from '../core/contract'
import type { Live2DAssetType } from '../core/errors'

export interface ModelInspectionLimits {
  maxAssetBytes?: number
  maxReferences?: number
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

export interface ModelCapabilityReport {
  model3Version?: number
  mocVersion?: number
  perfectSync: {
    compatible: boolean
    matched: number
    minimum: 45
    missing: readonly string[]
    total: 52
  }
  recommendedMapping: 'standard' | 'perfect-sync' | 'none'
  standardChannels: Readonly<Record<ModelTrackingChannel, ModelTrackingChannelSupport>>
}

export type InspectableModelInfo = ModelInfo
