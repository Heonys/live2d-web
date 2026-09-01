'use client'

import type { Live2DModelController } from 'live2d-web/react'
import type { AssetManifest } from '../lib/assetManifest'
import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { localizedDocPath, localizedPath } from '../i18n/site'
import { useSiteLocale, useSiteMessages } from '../i18n/SiteLocale'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../lib/assetManifest'
import { canBackgroundPrefetch, scheduleAfterPaintIdle, scheduleIdle } from './navigationPrefetch'
import { StageLoading } from './StageLoading'

const SPEECH_ATTACK_MS = 90
const SPEECH_RELEASE_MS = 150
const LANDING_MODEL_FIT = { offsetY: 16, scale: 1.12 } as const
const MOBILE_LANDING_MODEL_FIT = { offsetY: 8, scale: 1.22 } as const
const MOBILE_LANDING_QUERY = '(max-width: 620px)'

function subscribeMobileLayout(onStoreChange: () => void) {
  const query = window.matchMedia(MOBILE_LANDING_QUERY)
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function getMobileLayoutSnapshot() {
  return window.matchMedia(MOBILE_LANDING_QUERY).matches
}

function getServerMobileLayoutSnapshot() {
  return false
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function speechEnvelope(elapsedMs: number) {
  const attack = smoothstep(Math.min(1, elapsedMs / SPEECH_ATTACK_MS))
  const primary = 0.5 + Math.sin(elapsedMs / 74) * 0.23
  const detail = Math.sin(elapsedMs / 29 + 0.8) * 0.08
  return Math.min(0.86, Math.max(0.16, primary + detail)) * attack
}

export function LandingDemo() {
  const router = useRouter()
  const locale = useSiteLocale()
  const messages = useSiteMessages().landingDemo
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [mouth, setMouth] = useState(0)
  const [holdingSpeech, setHoldingSpeech] = useState(false)
  const [lipSyncActive, setLipSyncActive] = useState(false)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadPhase, setLoadPhase] = useState<'waiting' | 'assets' | 'model'>('waiting')
  const isMobileLayout = useSyncExternalStore(
    subscribeMobileLayout,
    getMobileLayoutSnapshot,
    getServerMobileLayoutSnapshot,
  )
  const animationFrameRef = useRef<number | null>(null)
  const holdingSpeechRef = useRef(false)
  const mouthRef = useRef(0)

  const cancelMouthAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const updateMouth = useCallback((value: number) => {
    mouthRef.current = value
    setMouth(value)
  }, [])

  const releaseSpeech = useCallback(() => {
    if (!holdingSpeechRef.current)
      return
    holdingSpeechRef.current = false
    setHoldingSpeech(false)
    cancelMouthAnimation()

    const initialValue = mouthRef.current
    if (initialValue <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateMouth(0)
      setLipSyncActive(false)
      return
    }

    const releaseStarted = performance.now()
    const releaseFrame = (now: number) => {
      const progress = Math.min(1, (now - releaseStarted) / SPEECH_RELEASE_MS)
      updateMouth(initialValue * (1 - smoothstep(progress)))
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(releaseFrame)
      }
      else {
        animationFrameRef.current = null
        updateMouth(0)
        setLipSyncActive(false)
      }
    }
    animationFrameRef.current = requestAnimationFrame(releaseFrame)
  }, [cancelMouthAnimation, updateMouth])

  const holdSpeech = useCallback(() => {
    if (holdingSpeechRef.current)
      return
    cancelMouthAnimation()
    holdingSpeechRef.current = true
    setHoldingSpeech(true)
    setLipSyncActive(true)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateMouth(0.62)
      return
    }

    const speechStarted = performance.now()
    const speechFrame = (now: number) => {
      if (!holdingSpeechRef.current)
        return
      updateMouth(speechEnvelope(now - speechStarted))
      animationFrameRef.current = requestAnimationFrame(speechFrame)
    }
    animationFrameRef.current = requestAnimationFrame(speechFrame)
  }, [cancelMouthAnimation, updateMouth])

  const retryModel = useCallback(() => {
    setController(null)
    setError('')
    setManifest(null)
    setLoadPhase('waiting')
    setLoadAttempt(attempt => attempt + 1)
  }, [])

  useEffect(() => {
    const request = new AbortController()
    let loadStarted = false
    let cancelScheduled = () => {}

    const loadAssets = () => {
      if (loadStarted || request.signal.aborted)
        return
      loadStarted = true
      setLoadPhase('assets')
      void fetch('/assets/live2d/hiyori/manifest.json', { signal: request.signal })
        .then((response) => {
          if (!response.ok)
            throw new Error(messages.localAssetsUnavailable)
          return response.json() as Promise<AssetManifest>
        })
        .then((loaded) => {
          warmUpModelAssets(loaded)
          setManifest(loaded)
          setLoadPhase('model')
        })
        .catch((reason: unknown) => {
          if (!request.signal.aborted)
            setError(reason instanceof Error ? reason.message : String(reason))
        })
    }

    const scheduleVisibleLoad = () => {
      if (loadStarted || document.visibilityState === 'hidden')
        return
      cancelScheduled()
      cancelScheduled = scheduleAfterPaintIdle(loadAssets, 500)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && !loadStarted) {
        cancelScheduled()
        cancelScheduled = () => {}
      }
      else {
        scheduleVisibleLoad()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    scheduleVisibleLoad()
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      cancelScheduled()
      request.abort()
    }
  }, [loadAttempt, messages.localAssetsUnavailable])

  useEffect(() => {
    window.addEventListener('blur', releaseSpeech)
    return () => {
      window.removeEventListener('blur', releaseSpeech)
      holdingSpeechRef.current = false
      cancelMouthAnimation()
    }
  }, [cancelMouthAnimation, releaseSpeech])

  useEffect(() => {
    if ((!controller && !error) || !canBackgroundPrefetch())
      return
    const timers: number[] = []
    const cancelIdle = scheduleIdle(() => {
      [
        localizedDocPath(locale),
        localizedPath(locale, '/playground'),
        localizedPath(locale, '/inspect'),
        localizedDocPath(locale, 'examples'),
      ].forEach((href, index) => {
        const timer = window.setTimeout((target: string) => router.prefetch(target), index * 120, href)
        timers.push(timer)
      })
    }, { delay: 250 })
    return () => {
      cancelIdle()
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [controller, error, locale, router])

  const playTap = useCallback(() => {
    if (!controller)
      return
    const info = controller.getModelInfo()
    const group = Object.keys(info.motions).find(name => name.toLowerCase().includes('tap'))
    if (group)
      void controller.motion(group).catch(() => {})
  }, [controller])

  return (
    <div className="landing-demo" data-load-phase={controller ? 'ready' : error ? 'error' : loadPhase}>
      <div className="landing-demo-meta">
        <span>Live demo</span>
        <span>WebGL2 · Cubism 3/4/5</span>
      </div>
      <div className="landing-stage" data-model-visible={Boolean(controller)}>
        {!controller && (
          <output className="landing-stage-status" aria-live="polite">
            <i aria-hidden="true" data-state={error ? 'error' : 'loading'} />
            <span>{error ? messages.error : messages.loading}</span>
          </output>
        )}
        {manifest
          ? (
              <Live2DCanvas
                accessibility={{
                  describedBy: 'landing-lip-sync-description',
                  label: messages.accessibility,
                }}
                coreUrl={CUBISM_CORE_URL}
                quality="auto"
                fallback={() => <StageLoading />}
              >
                <Live2DModel
                  fit={isMobileLayout ? MOBILE_LANDING_MODEL_FIT : LANDING_MODEL_FIT}
                  followPointer
                  idleMotion="Idle"
                  src={manifest.model3}
                  onLoad={setController}
                  onTap={playTap}
                >
                  <LipSync mouthOpen={mouth} speaking={lipSyncActive} />
                </Live2DModel>
              </Live2DCanvas>
            )
          : error
            ? (
                <div className="landing-demo-error" role="alert">
                  <p>{error}</p>
                  <button type="button" onClick={retryModel}>{messages.retry}</button>
                </div>
              )
            : loadPhase === 'waiting'
              ? null
              : <StageLoading />}
      </div>
      <div className="landing-demo-controls">
        <div className="landing-demo-action">
          <button disabled={!controller} type="button" onClick={playTap}>{messages.playMotion}</button>
        </div>
        <div className="landing-demo-action">
          <button
            aria-describedby="landing-lip-sync-description"
            aria-pressed={holdingSpeech}
            className="landing-hold-speech"
            data-active={holdingSpeech}
            data-mouth-open={mouth.toFixed(3)}
            disabled={!controller}
            type="button"
            onBlur={releaseSpeech}
            onKeyDown={(event) => {
              if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) {
                event.preventDefault()
                holdSpeech()
              }
            }}
            onKeyUp={(event) => {
              if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault()
                releaseSpeech()
              }
            }}
            onLostPointerCapture={releaseSpeech}
            onPointerCancel={releaseSpeech}
            onPointerDown={(event) => {
              if (event.button !== 0)
                return
              event.currentTarget.setPointerCapture(event.pointerId)
              holdSpeech()
            }}
            onPointerUp={(event) => {
              releaseSpeech()
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
          >
            <span className="landing-speech-meter" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {messages.holdToSpeak}
          </button>
          <span className="landing-visually-hidden" id="landing-lip-sync-description">
            {messages.simulation}
          </span>
        </div>
      </div>
    </div>
  )
}
