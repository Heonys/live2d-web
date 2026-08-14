import type { Live2DBackend } from '../core/contract'
import type { LifecycleScope } from '../core/lifecycle'
import type { AutoQualityPolicy } from '../core/quality'
import type { ModelStore, StageStore } from './store'
import { createContext } from 'react'

export const StageContext = createContext<StageStore | null>(null)

export interface RuntimeHostContextValue {
  backend: Live2DBackend
  container: HTMLElement | null
  coreUrl?: string
  maxFps?: number
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
