import type { LifecycleScope } from '../core/lifecycle'
import type { ModelStore, StageStore } from './store'
import { createContext } from 'react'

export const StageContext = createContext<StageStore | null>(null)

export interface ModelContextValue {
  lifecycle: LifecycleScope
  store: ModelStore
}

export const ModelContext = createContext<ModelContextValue | null>(null)
