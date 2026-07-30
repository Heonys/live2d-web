'use client'

import type { ReactNode } from 'react'
import type { Live2DError } from '../core/errors'
import type { ModelFit } from '../core/fit'
import { useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import { fitModel } from '../core/fit'
import { LifecycleScope } from '../core/lifecycle'
import { ModelContext, StageContext } from './context'
import { ModelStore } from './store'

export interface Live2DModelProps {
  src: string
  fit?: ModelFit
  /** Retries after the initial attempt. */
  retries?: number
  onLoad?: (model: import('../core/contract').ModelHandle) => void
  onError?: (error: Live2DError) => void
  children?: ReactNode
}

function once(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function modelError(error: unknown) {
  if (error instanceof Live2DErrorClass)
    return error
  return new Live2DErrorClass(
    'model-load-failed',
    error instanceof Error ? error.message : String(error),
    { cause: error },
  )
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    let timeout: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(timeout)
      reject(signal.reason)
    }
    timeout = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export function Live2DModel({
  children,
  fit = 'upper-body',
  onError,
  onLoad,
  retries = 2,
  src,
}: Live2DModelProps) {
  const stageStore = useContext(StageContext)
  if (!stageStore) {
    throw new Live2DErrorClass(
      'invalid-tree',
      '<Live2DModel> must be rendered inside <Live2DStage>.',
    )
  }
  const currentStageStore = stageStore

  const owner = useMemo(() => Symbol('Live2DModel'), [])
  const modelStore = useMemo(() => new ModelStore(), [])
  const lifecycle = useMemo(() => new LifecycleScope(), [])
  const contextValue = useMemo(() => ({ lifecycle, store: modelStore }), [lifecycle, modelStore])
  const stageSnapshot = useSyncExternalStore(
    stageStore.subscribe,
    stageStore.getSnapshot,
    stageStore.getSnapshot,
  )
  const modelSnapshot = useSyncExternalStore(
    modelStore.subscribe,
    modelStore.getSnapshot,
    modelStore.getSnapshot,
  )
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  const fitRef = useRef(fit)
  onLoadRef.current = onLoad
  onErrorRef.current = onError
  fitRef.current = fit

  useEffect(() => {
    if (currentStageStore.claimModel(owner))
      return () => currentStageStore.releaseModel(owner)

    const error = new Live2DErrorClass(
      'invalid-tree',
      'live2d-jsx v0.1 supports exactly one <Live2DModel> per <Live2DStage>.',
    )
    currentStageStore.fail(error)
    onErrorRef.current?.(error)
  }, [currentStageStore, owner])

  useEffect(() => {
    const stage = stageSnapshot.stage
    const backend = stageSnapshot.backend
    if (!stage || !backend || !currentStageStore.isModelOwner(owner))
      return
    const currentStage = stage
    const currentBackend = backend

    if (typeof src !== 'string' || src.trim() === '') {
      const error = new Live2DErrorClass(
        'invalid-props',
        '<Live2DModel src> must be a non-empty model3.json URL string.',
      )
      currentStageStore.fail(error)
      onErrorRef.current?.(error)
      return
    }
    if (!Number.isInteger(retries) || retries < 0) {
      const error = new Live2DErrorClass(
        'invalid-props',
        'retries must be a non-negative integer.',
      )
      currentStageStore.fail(error)
      onErrorRef.current?.(error)
      return
    }

    const controller = new AbortController()
    let disposeResource: (() => void) | undefined
    currentStageStore.begin('model')

    async function load() {
      let lastError: Live2DError | undefined
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const model = await currentBackend.loadModel(currentStage, src, { signal: controller.signal })

          if (
            controller.signal.aborted
            || currentStageStore.getSnapshot().stage !== currentStage
            || !currentStageStore.isModelOwner(owner)
          ) {
            model.dispose()
            return
          }

          const resource = {
            handle: model,
            dispose: () => {},
          }
          resource.dispose = once(() => {
            lifecycle.disposeAll()
            modelStore.setHandle(null)
            model.dispose()
            currentStageStore.clearModelResource(owner, resource)
          })
          disposeResource = resource.dispose

          if (!currentStageStore.setModelResource(owner, resource))
            return
          modelStore.setHandle(model)
          model.setTransform(fitModel(
            currentStage.getSize(),
            model.getIntrinsicSize(),
            fitRef.current,
          ))
          currentStageStore.setModelReady(owner)
          onLoadRef.current?.(model)
          return
        }
        catch (error) {
          if (controller.signal.aborted)
            return
          disposeResource?.()
          disposeResource = undefined
          lastError = modelError(error)
          if (lastError.code === 'invalid-props' || attempt === retries)
            break
          try {
            await wait(attempt === 0 ? 250 : 500, controller.signal)
          }
          catch {
            if (controller.signal.aborted)
              return
            throw lastError
          }
        }
      }

      if (lastError) {
        currentStageStore.fail(lastError)
        onErrorRef.current?.(lastError)
      }
    }

    void load()

    return () => {
      controller.abort()
      disposeResource?.()
    }
  }, [
    lifecycle,
    modelStore,
    owner,
    retries,
    src,
    stageSnapshot.backend,
    stageSnapshot.stage,
    currentStageStore,
  ])

  useEffect(() => {
    const model = modelSnapshot.handle
    const stage = stageSnapshot.stage
    if (!model || !stage)
      return
    model.setTransform(fitModel(stage.getSize(), model.getIntrinsicSize(), fit))
  }, [fit, modelSnapshot.handle, stageSnapshot.layoutVersion, stageSnapshot.stage])

  return (
    <ModelContext.Provider value={contextValue}>
      {children}
    </ModelContext.Provider>
  )
}
