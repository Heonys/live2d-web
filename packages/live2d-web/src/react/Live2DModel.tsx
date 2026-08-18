'use client'

import type { ReactNode } from 'react'
import type { ModelHandle } from '../core/contract'
import type { Live2DError } from '../core/errors'
import type { ModelFit } from '../core/fit'
import type { CreateLive2DOptions } from '../core/runtime'
import type { Live2DModelController } from './controller'
import { useContext, useEffect, useMemo, useRef } from 'react'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import { LifecycleScope } from '../core/lifecycle'
import { Live2DRuntime } from '../core/runtime'
import { ModelContext, RuntimeHostContext, StageContext } from './context'
import { createLive2DModelController } from './controller'
import { ModelStore } from './store'

export interface Live2DModelProps {
  src: string
  fit?: ModelFit
  /** Make the model look toward the pointer while it is over the canvas. */
  followPointer?: boolean
  /** Idle motion group name (default 'Idle'), or false to disable idle playback. */
  idleMotion?: string | false
  /** Pauses rendering declaratively (e.g. while a modal is open). */
  paused?: boolean
  /** Retries after the initial attempt. */
  retries?: number
  onLoad?: (model: Live2DModelController) => void
  onError?: (error: Live2DError) => void
  /** Called on canvas taps with the hit-area names under the pointer. */
  onTap?: (hitAreas: string[], event: MouseEvent) => void
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

export function Live2DModel({
  children,
  fit = 'upper-body',
  followPointer = false,
  idleMotion,
  onError,
  onLoad,
  onTap,
  paused = false,
  retries = 2,
  src,
}: Live2DModelProps) {
  const stageStore = useContext(StageContext)
  const runtimeHost = useContext(RuntimeHostContext)
  if (!stageStore || !runtimeHost) {
    throw new Live2DErrorClass(
      'invalid-tree',
      '<Live2DModel> must be rendered inside <Live2DCanvas>.',
    )
  }
  const currentStageStore = stageStore
  const currentRuntimeHost = runtimeHost

  const owner = useMemo(() => Symbol('Live2DModel'), [])
  const modelStore = useMemo(() => new ModelStore(), [])
  const lifecycle = useMemo(() => new LifecycleScope(), [])
  const contextValue = useMemo(() => ({ lifecycle, store: modelStore }), [lifecycle, modelStore])
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  const onTapRef = useRef(onTap)
  const fitRef = useRef(fit)
  const runtimeRef = useRef<Live2DRuntime | null>(null)
  onLoadRef.current = onLoad
  onErrorRef.current = onError
  onTapRef.current = onTap
  fitRef.current = fit
  const hasOnTap = onTap != null

  useEffect(() => {
    if (currentStageStore.claimModel(owner))
      return () => currentStageStore.releaseModel(owner)

    const error = new Live2DErrorClass(
      'invalid-tree',
      'live2d-web v0.1 supports exactly one <Live2DModel> per <Live2DCanvas>.',
    )
    currentStageStore.fail(error)
    onErrorRef.current?.(error)
  }, [currentStageStore, owner])

  useEffect(() => {
    const container = currentRuntimeHost.container
    if (!container || !currentStageStore.isModelOwner(owner))
      return

    let active = true
    let resource: { dispose: () => void, handle: ModelHandle } | undefined
    let invalidateController: (() => void) | undefined
    const runtime = new Live2DRuntime({
      backend: currentRuntimeHost.backend,
      container,
      coreUrl: currentRuntimeHost.coreUrl,
      fit: fitRef.current,
      idleMotion,
      maxFps: currentRuntimeHost.maxFps,
      pauseWhenOffscreen: currentRuntimeHost.pauseWhenOffscreen,
      quality: currentRuntimeHost.quality,
      resolution: currentRuntimeHost.resolution,
      retries,
      src,
    } as CreateLive2DOptions)
    runtimeRef.current = runtime
    modelStore.setRuntime(runtime)
    const unsubscribe = runtime.subscribe(() => {
      currentStageStore.syncRuntime(runtime.getState())
    })
    currentStageStore.syncRuntime(runtime.getState())

    const dispose = once(() => {
      active = false
      unsubscribe()
      invalidateController?.()
      invalidateController = undefined
      lifecycle.disposeAll()
      modelStore.setController(null)
      modelStore.setRuntime(null)
      runtime.dispose()
      if (resource)
        currentStageStore.clearModelResource(owner, resource)
      if (runtimeRef.current === runtime)
        runtimeRef.current = null
    })

    void runtime.start()
      .then(() => {
        if (!active) {
          runtime.dispose()
          return
        }
        const model = runtime.getModelHandle()
        if (!model) {
          throw new Live2DErrorClass(
            'model-load-failed',
            'The runtime became ready without a model handle.',
          )
        }
        resource = { dispose, handle: model }
        if (!currentStageStore.setModelResource(owner, resource))
          return
        const controllerBinding = createLive2DModelController(model)
        invalidateController = controllerBinding.invalidate
        const controller = controllerBinding.controller
        modelStore.setController(controller)
        currentStageStore.setModelReady(owner)
        onLoadRef.current?.(controller)
      })
      .catch((error) => {
        if (!active)
          return
        const normalized = modelError(error)
        currentStageStore.fail(normalized)
        onErrorRef.current?.(normalized)
      })

    return () => {
      dispose()
    }
  }, [
    currentRuntimeHost,
    currentStageStore,
    idleMotion,
    lifecycle,
    modelStore,
    owner,
    retries,
    src,
  ])

  useEffect(() => {
    runtimeRef.current?.setFit(fit)
  }, [fit])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime)
      return
    if (paused) {
      runtime.pause()
      return () => runtime.resume()
    }
  }, [currentRuntimeHost, paused, src])

  // Pointer wiring lives in React (not CreateLive2DOptions) so toggling these
  // props never recreates the runtime or reloads the model.
  useEffect(() => {
    const container = currentRuntimeHost.container
    if (!container || (!followPointer && !hasOnTap))
      return
    const onPointerMove = (event: PointerEvent) => {
      const runtime = runtimeRef.current
      if (runtime?.getState().status === 'ready')
        runtime.focusAt(event.clientX, event.clientY)
    }
    const onClick = (event: MouseEvent) => {
      const runtime = runtimeRef.current
      if (runtime && onTapRef.current)
        onTapRef.current(runtime.hitTest(event.clientX, event.clientY), event)
    }
    if (followPointer)
      container.addEventListener('pointermove', onPointerMove)
    if (hasOnTap)
      container.addEventListener('click', onClick)
    return () => {
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('click', onClick)
    }
  }, [currentRuntimeHost.container, followPointer, hasOnTap])

  return (
    <ModelContext.Provider value={contextValue}>
      {children}
    </ModelContext.Provider>
  )
}
