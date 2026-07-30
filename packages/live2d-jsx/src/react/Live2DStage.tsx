'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { Live2DBackend } from '../core/contract'
import type { Live2DError } from '../core/errors'
import type { AutoQualityPolicy, ResolvedAutoQualityPolicy } from '../core/quality'
import type { LoadingStage } from './store'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ensureCubismCore } from '../core/ensureCubismCore'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import {
  isMobileViewport,
  resolveAutoQualityPolicy,
  selectInitialResolution,
  selectLowerResolution,
} from '../core/quality'
import { StageContext } from './context'
import { StageStore } from './store'

interface BaseLive2DStageProps {
  backend: Live2DBackend
  coreUrl?: string
  maxFps?: number
  className?: string
  style?: CSSProperties
  fallback?: (stage: LoadingStage) => ReactNode
  errorFallback?: (error: Live2DError, retry: () => void) => ReactNode
  onError?: (error: Live2DError) => void
  children?: ReactNode
}

export type StageQualityProps
  = | { quality?: 'auto' | AutoQualityPolicy, resolution?: never }
    | { quality?: never, resolution: number }

export type Live2DStageProps = BaseLive2DStageProps & StageQualityProps

function asLive2DError(error: unknown, fallbackCode: 'adapter-error' | 'render-error') {
  if (error instanceof Live2DErrorClass)
    return error
  return new Live2DErrorClass(
    fallbackCode,
    error instanceof Error ? error.message : String(error),
    { cause: error },
  )
}

function validateFixedResolution(resolution: number | undefined) {
  if (
    resolution !== undefined
    && (!Number.isFinite(resolution) || resolution < 1)
  ) {
    throw new Live2DErrorClass(
      'invalid-props',
      'resolution must be a finite number greater than or equal to 1.',
    )
  }
}

function validateQualityProps(hasConflict: boolean) {
  if (hasConflict) {
    throw new Live2DErrorClass(
      'invalid-props',
      'quality and resolution are mutually exclusive.',
    )
  }
}

function useResolvedQuality(
  quality: 'auto' | AutoQualityPolicy | undefined,
): { policy?: ResolvedAutoQualityPolicy, error?: Live2DError } {
  const policy = typeof quality === 'object' ? quality : undefined
  const useDefaultPolicy = quality === 'auto' || quality === undefined

  return useMemo(() => {
    try {
      return { policy: resolveAutoQualityPolicy(policy) }
    }
    catch (error) {
      return { error: asLive2DError(error, 'adapter-error') }
    }
    // The scalar values intentionally make inline policy objects stable.
    // eslint-disable-next-line react/exhaustive-deps
  }, [
    useDefaultPolicy,
    policy?.desktopMaxResolution,
    policy?.desktopPixelBudget,
    policy?.longFrameMs,
    policy?.longFrameRatioThreshold,
    policy?.minResolution,
    policy?.mobileMaxResolution,
    policy?.mobilePixelBudget,
    policy?.resolutionStep,
    policy?.sampleWindowMs,
  ])
}

export function Live2DStage(props: Live2DStageProps) {
  const {
    backend,
    children,
    className,
    coreUrl,
    errorFallback,
    fallback,
    maxFps,
    onError,
    style,
  } = props
  const fixedResolution = 'resolution' in props ? props.resolution : undefined
  const quality = 'quality' in props ? props.quality : undefined
  const hasConflictingQualityProps = quality !== undefined && fixedResolution !== undefined
  const resolvedQuality = useResolvedQuality(quality)
  const containerRef = useRef<HTMLDivElement>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const retry = useMemo(() => () => setRetryVersion(version => version + 1), [])
  const store = useMemo(() => new StageStore(retry), [retry])
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  const lastReportedErrorRef = useRef<Live2DError | undefined>(undefined)

  useEffect(() => {
    if (!snapshot.error || snapshot.error === lastReportedErrorRef.current)
      return
    lastReportedErrorRef.current = snapshot.error
    onError?.(snapshot.error)
  }, [onError, snapshot.error])

  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return
    const containerElement = container

    let disposed = false
    let resizeAnimationFrame = 0
    let stage: ReturnType<Live2DBackend['createStage']> | undefined
    let resizeObserver: ResizeObserver | undefined
    let unsubscribeFrame: (() => void) | undefined
    let unsubscribeError: (() => void) | undefined
    let lastWidth = 0
    let lastHeight = 0
    let elapsedMs = 0
    let frameCount = 0
    let longFrameCount = 0

    const fail = (error: unknown, code: 'adapter-error' | 'render-error' = 'adapter-error') => {
      if (!disposed)
        store.fail(asLive2DError(error, code))
    }

    const resize = () => {
      resizeAnimationFrame = 0
      if (!stage || disposed)
        return
      const rect = containerElement.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      if (
        Math.abs(width - lastWidth) < 0.5
        && Math.abs(height - lastHeight) < 0.5
      ) {
        return
      }
      lastWidth = width
      lastHeight = height

      if (fixedResolution === undefined && resolvedQuality.policy) {
        const cap = selectInitialResolution({
          devicePixelRatio: window.devicePixelRatio,
          height,
          mobile: isMobileViewport(width, height),
          width,
        }, resolvedQuality.policy)
        if (cap < stage.getResolution()) {
          stage.setResolution(cap)
          store.notifyResolution(stage)
        }
      }

      stage.resize(width, height)
      store.notifyLayout(stage)
    }

    const scheduleResize = () => {
      if (!resizeAnimationFrame)
        resizeAnimationFrame = requestAnimationFrame(resize)
    }

    const onVisibilityChange = () => {
      if (!stage)
        return
      if (document.hidden) {
        stage.pause()
      }
      else {
        elapsedMs = 0
        frameCount = 0
        longFrameCount = 0
        stage.resume()
        scheduleResize()
      }
    }

    async function boot() {
      if (resolvedQuality.error) {
        store.fail(resolvedQuality.error)
        return
      }
      try {
        validateQualityProps(hasConflictingQualityProps)
        validateFixedResolution(fixedResolution)
      }
      catch (error) {
        fail(error)
        return
      }

      store.begin('core')
      await ensureCubismCore(coreUrl)
      if (disposed)
        return

      store.begin('stage')
      const rect = containerElement.getBoundingClientRect()
      lastWidth = Math.max(1, rect.width)
      lastHeight = Math.max(1, rect.height)
      const resolution = fixedResolution ?? selectInitialResolution({
        devicePixelRatio: window.devicePixelRatio,
        height: lastHeight,
        mobile: isMobileViewport(lastWidth, lastHeight),
        width: lastWidth,
      }, resolvedQuality.policy!)

      stage = backend.createStage(containerElement, {
        height: lastHeight,
        maxFps,
        resolution,
        width: lastWidth,
      })
      unsubscribeError = stage.onError(error => fail(error, 'render-error'))

      if (fixedResolution === undefined && resolvedQuality.policy) {
        const policy = resolvedQuality.policy
        unsubscribeFrame = stage.onFrame((deltaMs) => {
          elapsedMs += deltaMs
          frameCount++
          if (deltaMs > policy.longFrameMs)
            longFrameCount++
          if (elapsedMs < policy.sampleWindowMs)
            return

          const ratio = frameCount ? longFrameCount / frameCount : 0
          const current = stage!.getResolution()
          const next = selectLowerResolution(current, ratio, policy)
          if (next < current) {
            stage!.setResolution(next)
            store.notifyResolution(stage!)
          }
          elapsedMs = 0
          frameCount = 0
          longFrameCount = 0
        })
      }

      resizeObserver = typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(scheduleResize)
      resizeObserver?.observe(containerElement)
      document.addEventListener('visibilitychange', onVisibilityChange)

      if (disposed)
        return
      store.setStage(stage, backend)
    }

    void boot().catch(error => fail(error))

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      resizeObserver?.disconnect()
      cancelAnimationFrame(resizeAnimationFrame)
      unsubscribeFrame?.()
      unsubscribeError?.()
      // React effect ordering is not relied upon: the Stage owns this final guard.
      store.disposeModelResource()
      if (stage) {
        store.clearStage(stage)
        stage.dispose()
      }
    }
  }, [
    backend,
    coreUrl,
    fixedResolution,
    hasConflictingQualityProps,
    maxFps,
    resolvedQuality.error,
    resolvedQuality.policy,
    retryVersion,
    store,
  ])

  const loadingNode = snapshot.status === 'loading' && snapshot.loadingStage
    ? fallback?.(snapshot.loadingStage)
    : null
  const errorNode = snapshot.status === 'error' && snapshot.error
    ? errorFallback?.(snapshot.error, retry)
    : null

  return (
    <StageContext.Provider value={store}>
      <div
        className={className}
        style={{
          height: '100%',
          position: 'relative',
          width: '100%',
          ...style,
        }}
      >
        <div
          ref={containerRef}
          data-live2d-stage=""
          style={{ height: '100%', touchAction: 'none', width: '100%' }}
        />
        {children}
        {loadingNode}
        {errorNode}
      </div>
    </StageContext.Provider>
  )
}
