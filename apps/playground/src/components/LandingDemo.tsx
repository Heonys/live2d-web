'use client'

import type { Live2DModelController } from 'live2d-web/react'
import type { AssetManifest } from '../lib/assetManifest'
import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../lib/assetManifest'
import { StageLoading } from './StageLoading'

const SPEECH_ATTACK_MS = 90
const SPEECH_RELEASE_MS = 150

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
  preload(CUBISM_CORE_URL, { as: 'script' })
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [mouth, setMouth] = useState(0)
  const [holdingSpeech, setHoldingSpeech] = useState(false)
  const [lipSyncActive, setLipSyncActive] = useState(false)
  const [error, setError] = useState('')
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

  useEffect(() => {
    const request = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: request.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Local demo assets are unavailable.')
        return response.json() as Promise<AssetManifest>
      })
      .then((loaded) => {
        warmUpModelAssets(loaded)
        setManifest(loaded)
      })
      .catch((reason: unknown) => {
        if (!request.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => request.abort()
  }, [])

  useEffect(() => {
    window.addEventListener('blur', releaseSpeech)
    return () => {
      window.removeEventListener('blur', releaseSpeech)
      holdingSpeechRef.current = false
      cancelMouthAnimation()
    }
  }, [cancelMouthAnimation, releaseSpeech])

  const playTap = useCallback(() => {
    if (!controller)
      return
    const info = controller.getModelInfo()
    const group = Object.keys(info.motions).find(name => name.toLowerCase().includes('tap'))
    if (group)
      void controller.motion(group).catch(() => {})
  }, [controller])

  return (
    <div className="landing-demo">
      <div className="landing-stage">
        <output className="landing-stage-status" aria-live="polite">
          <span data-state={error ? 'error' : controller ? 'ready' : 'loading'}>
            {error ? 'error' : controller ? 'ready' : 'loading'}
          </span>
          <span>WebGL2</span>
          <span>Cubism 4/5</span>
        </output>
        {manifest
          ? (
              <Live2DCanvas
                coreUrl={CUBISM_CORE_URL}
                quality="auto"
                fallback={() => <StageLoading />}
              >
                <Live2DModel
                  fit="upper-body"
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
            ? <p className="landing-demo-error">{error}</p>
            : <StageLoading />}
      </div>
      <div className="landing-demo-controls">
        <div className="landing-demo-action">
          <span>Motion</span>
          <button disabled={!controller} type="button" onClick={playTap}>Play motion</button>
        </div>
        <div className="landing-demo-action">
          <span>Lip sync</span>
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
            Hold to speak
          </button>
          <span className="landing-visually-hidden" id="landing-lip-sync-description">
            Simulates mouth movement without using a microphone.
          </span>
        </div>
      </div>
    </div>
  )
}
