'use client'

import type { ReactNode } from 'react'
import type { IdleMotion, Live2DAssetResolver } from '../core/contract'
import type { Live2DError } from '../core/errors'
import type { ModelFit } from '../core/fit'
import type { Live2DModelHandle } from '../core/runtime'
import type { Live2DModelController } from './controller'
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import { sameFit } from '../core/fit'
import { idleMotionIdentity, validateIdleMotion } from '../core/idle-motion'
import { LifecycleScope } from '../core/lifecycle'
import { ModelContext, RuntimeHostContext, StageContext } from './context'
import { createLive2DModelController } from './controller'
import { ModelStore } from './store'

export interface Live2DModelProps {
  src: string
  /**
   * Supplies the model's files instead of fetching them. `src` then names a
   * path inside that source. Keep the function referentially stable (useCallback
   * or a module constant): a new identity reloads the model.
   */
  resolveAsset?: Live2DAssetResolver
  fit?: ModelFit
  /**
   * Shows the placement overlay over the canvas so `fit` can be found by
   * dragging. The overlay is loaded on demand and reports what it applies
   * through `onFitChange`, which a controlled `fit` needs to keep the value.
   */
  debug?: boolean
  /** Receives every placement the debug overlay applies. */
  onFitChange?: (fit: ModelFit) => void
  /** Make the model look toward the pointer while it is over the canvas. */
  followPointer?: boolean
  /** Idle motion group name (default 'Idle'), or false to disable idle playback. */
  idleMotion?: IdleMotion
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
  debug = false,
  fit = 'upper-body',
  followPointer = false,
  idleMotion,
  onError,
  onFitChange,
  onLoad,
  onTap,
  paused = false,
  resolveAsset,
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

  // Read during render so the setter effect below has a real dependency; the
  // memoized value keeps a stable identity while the description is unchanged.
  const accessibility = currentRuntimeHost.accessibilityRef.current
  const owner = useMemo(() => Symbol('Live2DModel'), [])
  const modelStore = useMemo(() => new ModelStore(), [])
  const lifecycle = useMemo(() => new LifecycleScope(), [])
  const contextValue = useMemo(() => ({ lifecycle, store: modelStore }), [lifecycle, modelStore])
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  const onTapRef = useRef(onTap)
  const fitRef = useRef(fit)
  const debugRef = useRef(debug)
  const onFitChangeRef = useRef(onFitChange)
  const handleRef = useRef<Live2DModelHandle | null>(null)
  const lastErrorRef = useRef<Live2DError | null>(null)
  onLoadRef.current = onLoad
  onErrorRef.current = onError
  onTapRef.current = onTap
  fitRef.current = fit
  debugRef.current = debug
  onFitChangeRef.current = onFitChange
  const hasOnTap = onTap != null
  // Validate before touching the shape: a malformed prop must surface as the
  // same invalid-props error the vanilla API raises, not as a render crash.
  let idleError: Live2DError | null = null
  try {
    validateIdleMotion(idleMotion)
  }
  catch (error) {
    idleError = error as Live2DError
  }
  const idleIdentity = idleError ? `invalid:${idleError.message}` : idleMotionIdentity(idleMotion)
  const idleMotionRef = useRef<{
    error: Live2DError | null
    identity: string
    value: IdleMotion | undefined
  } | undefined>(undefined)
  if (!idleMotionRef.current || idleMotionRef.current.identity !== idleIdentity) {
    const value: IdleMotion | undefined = idleError
      ? false
      : idleMotion && typeof idleMotion === 'object'
        ? {
            group: idleMotion.group,
            weights: [...idleMotion.weights],
          }
        : idleMotion
    idleMotionRef.current = { error: idleError, identity: idleIdentity, value }
  }
  const stableIdleMotion = idleMotionRef.current.value
  const stableIdleError = idleMotionRef.current.error

  // The runtime reports a failed start and rejects start() with the same
  // error object, so identity is enough to keep this callback single-fire.
  const reportError = useCallback((error: Live2DError) => {
    if (lastErrorRef.current === error)
      return
    lastErrorRef.current = error
    onErrorRef.current?.(error)
  }, [])

  useEffect(() => {
    if (stableIdleError)
      reportError(stableIdleError)
  }, [stableIdleError, reportError])

  // Render errors arrive on the canvas now that it owns the stage, but they
  // still stop this model, so its onError has to hear about them.
  useEffect(() => {
    const unsubscribe = currentStageStore.subscribe(() => {
      const error = currentStageStore.getSnapshot().error
      if (error)
        reportError(error)
    })
    return () => {
      unsubscribe()
    }
  }, [currentStageStore, reportError])

  useEffect(() => {
    const runtime = currentRuntimeHost.runtime
    if (!runtime)
      return

    currentStageStore.registerModel(owner)
    let active = true
    let invalidateController: (() => void) | undefined
    let handle: Live2DModelHandle | undefined

    const dispose = once(() => {
      active = false
      invalidateController?.()
      invalidateController = undefined
      lifecycle.disposeAll()
      modelStore.setController(null)
      modelStore.setRuntime(null)
      handleRef.current = null
      handle?.dispose()
      handle = undefined
    })

    void runtime.addModel({
      fit: fitRef.current,
      idleMotion: stableIdleMotion,
      onFitChange: (next: ModelFit) => onFitChangeRef.current?.(next),
      resolveAsset,
      retries,
      src,
    })
      .then((added) => {
        if (!active) {
          added.dispose()
          return
        }
        handle = added
        handleRef.current = added
        modelStore.setRuntime(added)
        added.setDebug(debugRef.current)
        currentStageStore.setModelResource(owner, { dispose })
        const binding = createLive2DModelController(added)
        invalidateController = binding.invalidate
        modelStore.setController(binding.controller)
        currentStageStore.setModelReady(owner)
        onLoadRef.current?.(binding.controller)
      })
      .catch((error) => {
        if (!active)
          return
        const normalized = modelError(error)
        currentStageStore.fail(normalized)
        reportError(normalized)
      })

    return () => {
      dispose()
      currentStageStore.releaseModel(owner)
    }
  }, [
    currentRuntimeHost.runtime,
    currentStageStore,
    stableIdleMotion,
    lifecycle,
    modelStore,
    owner,
    reportError,
    resolveAsset,
    retries,
    src,
  ])

  // Compared by value: an inline object prop has a new identity every render,
  // and reapplying it would wipe what the debug overlay was dragged to.
  useEffect(() => {
    const handle = handleRef.current
    if (!handle || sameFit(handle.getFit(), fit))
      return
    handle.setFit(fit)
  }, [fit])

  useEffect(() => {
    handleRef.current?.setDebug(debug)
  }, [debug])

  // Accessibility and pausing belong to the canvas now that it owns the stage.
  // The props stay here so existing trees keep working: any paused model
  // pauses the canvas.
  useEffect(() => {
    currentRuntimeHost.runtime?.setAccessibility(accessibility)
  }, [accessibility, currentRuntimeHost.runtime])

  useEffect(() => {
    const runtime = currentRuntimeHost.runtime
    if (!runtime || !paused)
      return
    runtime.pause()
    return () => runtime.resume()
  }, [currentRuntimeHost.runtime, paused])

  // Pointer wiring lives in React (not CreateLive2DOptions) so toggling these
  // props never recreates the runtime or reloads the model.
  useEffect(() => {
    const container = currentRuntimeHost.container
    if (!container || (!followPointer && !hasOnTap))
      return
    // Per model, so one character can watch the cursor while another holds its
    // pose, and a tap reports only the hit areas of the model that was hit.
    const onPointerMove = (event: PointerEvent) => {
      handleRef.current?.focusAt(event.clientX, event.clientY)
    }
    // Matches the vanilla followPointer wiring: the gaze returns to the centre
    // once the pointer leaves, instead of freezing at its last position.
    const onPointerLeave = () => {
      const rect = container.getBoundingClientRect()
      handleRef.current?.focus(rect.width / 2, rect.height / 2)
    }
    const onClick = (event: MouseEvent) => {
      const handle = handleRef.current
      if (handle && onTapRef.current)
        onTapRef.current(handle.hitTest(event.clientX, event.clientY), event)
    }
    if (followPointer) {
      container.addEventListener('pointermove', onPointerMove)
      container.addEventListener('pointerleave', onPointerLeave)
    }
    if (hasOnTap)
      container.addEventListener('click', onClick)
    return () => {
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerleave', onPointerLeave)
      container.removeEventListener('click', onClick)
    }
  }, [currentRuntimeHost.container, followPointer, hasOnTap])

  return (
    <ModelContext.Provider value={contextValue}>
      {children}
    </ModelContext.Provider>
  )
}
