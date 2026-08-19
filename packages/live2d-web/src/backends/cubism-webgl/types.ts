import type { ModelTransform, Size } from '../../core/contract'

export interface CubismWebGLBackendOptions {
  shaderBaseUrl?: string | URL
}

export interface StageFrameDriver {
  update: (deltaMs: number) => void
  draw: () => void
  resize: (width: number, height: number) => void
}

export interface LayoutBounds extends Size {
  centerX: number
  centerY: number
}

export interface ModelPlacement {
  bounds: LayoutBounds
  transform: ModelTransform
}
