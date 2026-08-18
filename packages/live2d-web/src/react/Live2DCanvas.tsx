'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { Live2DBackend } from '../core/contract'
import type { Live2DError } from '../core/errors'
import type { AutoQualityPolicy } from '../core/quality'
import type { LoadingStage } from './store'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { RuntimeHostContext, StageContext } from './context'
import { StageStore } from './store'

interface BaseLive2DCanvasProps {
  /** Omit to use the official Framework-based cubism-webgl adapter. */
  backend?: Live2DBackend
  coreUrl?: string
  maxFps?: number
  /** Pause rendering while the canvas is outside the viewport. Default true. */
  pauseWhenOffscreen?: boolean
  className?: string
  style?: CSSProperties
  fallback?: (stage: LoadingStage) => ReactNode
  errorFallback?: (error: Live2DError, retry: () => void) => ReactNode
  onError?: (error: Live2DError) => void
  children?: ReactNode
}

export type Live2DCanvasQualityProps
  = | { quality?: 'auto' | AutoQualityPolicy, resolution?: never }
    | { quality?: never, resolution: number }

export type Live2DCanvasProps = BaseLive2DCanvasProps & Live2DCanvasQualityProps

function useStableQuality(quality: 'auto' | AutoQualityPolicy | undefined) {
  const policy = typeof quality === 'object' ? quality : undefined
  const auto = quality === 'auto'
  return useMemo(() => {
    if (!policy)
      return auto ? 'auto' as const : undefined
    return { ...policy }
    // Scalar dependencies keep an inline policy from rebooting the runtime.
    // eslint-disable-next-line react/exhaustive-deps
  }, [
    auto,
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

export function Live2DCanvas(props: Live2DCanvasProps) {
  const {
    backend,
    children,
    className,
    coreUrl,
    errorFallback,
    fallback,
    maxFps,
    onError,
    pauseWhenOffscreen,
    style,
  } = props
  const quality = 'quality' in props ? props.quality : undefined
  const stableQuality = useStableQuality(quality)
  const resolution = 'resolution' in props ? props.resolution : undefined
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [retryVersion, setRetryVersion] = useState(0)
  const retry = useMemo(() => () => setRetryVersion(version => version + 1), [])
  const store = useMemo(() => new StageStore(retry), [retry])
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  )
  const lastReportedErrorRef = useRef<Live2DError | undefined>(undefined)
  const runtimeHost = useMemo(() => ({
    backend,
    container,
    coreUrl,
    maxFps,
    pauseWhenOffscreen,
    quality: stableQuality,
    resolution,
    retryVersion,
  }), [backend, container, coreUrl, maxFps, pauseWhenOffscreen, resolution, retryVersion, stableQuality])

  useEffect(() => {
    if (!snapshot.error || snapshot.error === lastReportedErrorRef.current)
      return
    lastReportedErrorRef.current = snapshot.error
    onError?.(snapshot.error)
  }, [onError, snapshot.error])

  useEffect(() => {
    return () => store.disposeModelResource()
  }, [store])

  const loadingNode = snapshot.status === 'loading' && snapshot.loadingStage
    ? fallback?.(snapshot.loadingStage)
    : null
  const errorNode = snapshot.status === 'error' && snapshot.error
    ? errorFallback?.(snapshot.error, retry)
    : null

  return (
    <StageContext.Provider value={store}>
      <RuntimeHostContext.Provider value={runtimeHost}>
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
            ref={setContainer}
            data-live2d-canvas=""
            style={{ height: '100%', touchAction: 'none', width: '100%' }}
          />
          {children}
          {loadingNode}
          {errorNode}
        </div>
      </RuntimeHostContext.Provider>
    </StageContext.Provider>
  )
}
