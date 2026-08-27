import type { Live2DBackend, Live2DCanvasAccessibility } from '../core/contract'
import type { LifecycleScope } from '../core/lifecycle'
import type { AutoQualityPolicy } from '../core/quality'
import type { ModelStore, StageStore } from './store'
import { createContext } from 'react'

export const StageContext = createContext<StageStore | null>(null)

export interface RuntimeHostContextValue {
  /**
   * A ref, not a value: changing the canvas description must not change this
   * object's identity, because the runtime-creation effect depends on it and
   * would otherwise rebuild the stage and reload the model.
   */
  accessibilityRef: { readonly current: Live2DCanvasAccessibility | undefined }
  backend?: Live2DBackend
  container: HTMLElement | null
  coreUrl?: string
  maxFps?: number
  pauseWhenOffscreen?: boolean
  quality?: 'auto' | AutoQualityPolicy
  resolution?: number
  retryVersion: number
}

export const RuntimeHostContext = createContext<RuntimeHostContextValue | null>(null)

export interface ModelContextValue {
  lifecycle: LifecycleScope
  store: ModelStore
}

export const ModelContext = createContext<ModelContextValue | null>(null)
