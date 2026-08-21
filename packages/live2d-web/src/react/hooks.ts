'use client'

import type {
  CreateLive2DOptions,
  Live2DInstance,
  Live2DRuntimeState,
} from '../core/runtime'
import type { Live2DModelController } from './controller'
import type { Live2DCanvasState } from './store'
import {
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Live2DError } from '../core/errors'
import { Live2DRuntime } from '../core/runtime'
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
    // setParameter is a persistent override; without this cleanup the value
    // would keep overriding motion curves after unmount or an id change.
    return () => {
      try {
        model?.clearParameter(id)
      }
      catch {
        // The controller may already be invalidated during teardown.
      }
    }
  }, [id, model, value])
}

export interface UseLive2DOptions
  extends Omit<CreateLive2DOptions, 'container'> {
  /** Pass null until the container ref is attached. */
  container: HTMLElement | null
}

export interface UseLive2DResult {
  error: Live2DError | undefined
  /** Non-null once the model is ready. */
  instance: Live2DInstance | null
  /** Disposes the current generation and starts a fresh one. */
  retry: () => void
  state: Live2DRuntimeState
}

/**
 * Owns a vanilla Live2D instance from React: creation, StrictMode replays,
 * state subscription and disposal. Changing container or src recreates the
 * instance; change other options by remounting with a key.
 */
export function useLive2D(options: UseLive2DOptions): UseLive2DResult {
  const [runtime, setRuntime] = useState<Live2DRuntime | null>(null)
  const [version, setVersion] = useState(0)
  const [, forceRender] = useReducer((count: number) => count + 1, 0)
  const optionsRef = useRef(options)
  optionsRef.current = options
  const { container, src } = options

  useEffect(() => {
    if (!container) {
      queueMicrotask(() => setRuntime(null))
      return
    }
    let active = true
    const generation = new Live2DRuntime({
      ...optionsRef.current,
      container,
    } as CreateLive2DOptions)
    // Publishing asynchronously avoids a synchronous effect state write while
    // still creating a fresh runtime for StrictMode's setup-cleanup replay.
    queueMicrotask(() => {
      if (active)
        setRuntime(generation)
    })
    const unsubscribe = generation.subscribe(forceRender)
    void generation.start().catch(() => {
      // The failure is already reflected in the runtime state.
    })
    return () => {
      active = false
      unsubscribe()
      generation.dispose()
      queueMicrotask(() => {
        setRuntime(current => (current === generation ? null : current))
      })
    }
  }, [container, src, version])

  const state: Live2DRuntimeState = runtime?.getState()
    ?? { loadingStage: 'core', status: 'loading' }
  return {
    error: state.error,
    instance: runtime && state.status === 'ready' ? runtime : null,
    retry: () => setVersion(current => current + 1),
    state,
  }
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
