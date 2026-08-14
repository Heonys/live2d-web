'use client'

import type { Live2DModelController } from './controller'
import type { Live2DCanvasState } from './store'
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { Live2DError } from '../core/errors'
import { ModelContext, StageContext } from './context'

export function useLive2DCanvas(): Live2DCanvasState {
  const store = useContext(StageContext)
  if (!store) {
    throw new Live2DError(
      'invalid-tree',
      'useLive2DCanvas() must be used inside <Live2DCanvas>.',
    )
  }
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function useLive2DModel(): Live2DModelController | null {
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
  ).controller
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
  const runtime = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  ).runtime
  const getterRef = useRef(getter)
  getterRef.current = getter

  useEffect(() => {
    if (!runtime)
      return
    return context.lifecycle.add(runtime.addParameterDriver(id, {
      getValue: () => getterRef.current(),
    }))
  }, [context.lifecycle, id, runtime])
}
