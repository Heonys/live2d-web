'use client'

import type { ModelHandle } from '../core/contract'
import type { StageState } from './store'
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { Live2DError } from '../core/errors'
import { ModelContext, StageContext } from './context'

export function useStage(): StageState {
  const store = useContext(StageContext)
  if (!store)
    throw new Live2DError('invalid-tree', 'useStage() must be used inside <Live2DStage>.')
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function useLive2DModel(): ModelHandle | null {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Live2DError(
      'invalid-tree',
      'useLive2DModel() must be used inside <Live2DModel>.',
    )
  }
  return useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  ).handle
}

export function useLive2DParameter(id: string, value: number): void {
  const model = useLive2DModel()
  useEffect(() => {
    model?.setParameter(id, value)
  }, [id, model, value])
}

export function useParameterDriver(id: string, getter: () => number): void {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Live2DError(
      'invalid-tree',
      'useParameterDriver() must be used inside <Live2DModel>.',
    )
  }
  const model = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  ).handle
  const getterRef = useRef(getter)
  getterRef.current = getter

  useEffect(() => {
    if (!model)
      return
    return context.lifecycle.add(model.onAfterMotionUpdate(() => {
      model.setParameter(id, getterRef.current())
    }))
  }, [context.lifecycle, id, model])
}
