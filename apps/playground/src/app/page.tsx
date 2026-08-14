'use client'

import type { ModelFit } from 'live2d-web'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
import {
  LipSync,
  Live2DModel,
  Live2DStage,
  useStage,
} from 'live2d-web/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SYNTHETIC_LIPSYNC_PROFILE } from '../lib/syntheticLipSyncProfile'

interface AssetManifest {
  model3: string
}

function DriverLipSync({
  active,
  value,
}: {
  active: boolean
  value: number
}) {
  const stateRef = useRef({ active, value })
  stateRef.current = { active, value }
  const driver = useMemo(() => ({
    getMouthOpen: () => stateRef.current.value,
    isSpeaking: () => stateRef.current.active,
  }), [])
  return <LipSync driver={driver} />
}

function Diagnostics() {
  const stage = useStage()
  return (
    <output className="diagnostics" data-testid="stage-status">
      <strong>{stage.status}</strong>
      {stage.loadingStage && <span>{stage.loadingStage}</span>}
      {stage.render && (
        <>
          <span>
            {stage.render.width.toFixed(0)}
            ×
            {stage.render.height.toFixed(0)}
          </span>
          <span>
            DPR
            {' '}
            {stage.render.resolution.toFixed(2)}
          </span>
          <span>
            {(stage.render.bufferPixels / 1_000_000).toFixed(2)}
            MP
          </span>
        </>
      )}
    </output>
  )
}

function StageError({
  code,
  message,
  retry,
}: {
  code: string
  message: string
  retry: () => void
}) {
  return (
    <div className="stage-overlay error-panel" role="alert">
      <strong>{code}</strong>
      <p>{message}</p>
      <button type="button" onClick={retry}>Retry stage</button>
    </div>
  )
}

export default function Home() {
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [assetError, setAssetError] = useState('')
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [mouthOpen, setMouthOpen] = useState(0)
  const [driverSpeaking, setDriverSpeaking] = useState(true)
  const [mounted, setMounted] = useState(true)
  const [fixedQuality, setFixedQuality] = useState(false)
  const [lipSyncError, setLipSyncError] = useState('')
  const [lipSyncMode, setLipSyncMode] = useState<'driver' | 'source'>('driver')
  const [sourceActive, setSourceActive] = useState(false)
  const [sourceNode, setSourceNode] = useState<AudioNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const signalRef = useRef<{
    gain: GainNode
    oscillator: OscillatorNode
  } | null>(null)

  const stopSourceSignal = useCallback(() => {
    const signal = signalRef.current
    if (!signal)
      return
    signalRef.current = null
    setSourceActive(false)
    try {
      signal.oscillator.stop()
    }
    catch {
      // The oscillator may already have stopped during page teardown.
    }
    try {
      signal.oscillator.disconnect(signal.gain)
    }
    catch {
      // Best-effort playground cleanup.
    }
    const destination = audioContextRef.current?.destination
    if (destination) {
      try {
        signal.gain.disconnect(destination)
      }
      catch {
        // LipSync owns and removes its separate analysis edge.
      }
    }
  }, [])

  const startSourceSignal = useCallback(async () => {
    stopSourceSignal()
    const context = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = context
    await context.resume()

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 220
    gain.gain.value = 0.04
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    signalRef.current = { gain, oscillator }
    setLipSyncError('')
    setSourceNode(gain)
    setSourceActive(true)
  }, [stopSourceSignal])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Run `pnpm fetch-assets` before starting the playground.')
        return response.json() as Promise<AssetManifest>
      })
      .then(setManifest)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setAssetError(error instanceof Error ? error.message : String(error))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => {
      const signal = signalRef.current
      signalRef.current = null
      if (signal) {
        try {
          signal.oscillator.stop()
          signal.oscillator.disconnect()
          signal.gain.disconnect()
        }
        catch {
          // The browser can tear WebAudio down before React cleanup.
        }
      }
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])

  const stage = manifest && mounted
    ? (
        <Live2DStage
          backend={pixiV6}
          coreUrl="/assets/js/cubism/5.3/live2dcubismcore.min.js"
          {...(fixedQuality ? { resolution: 1 } : { quality: 'auto' as const })}
          fallback={loadingStage => (
            <div className="stage-overlay">
              Loading
              {' '}
              {loadingStage}
              …
            </div>
          )}
          errorFallback={(error, retry) => (
            <StageError code={error.code} message={error.message} retry={retry} />
          )}
        >
          <Live2DModel fit={fit} src={manifest.model3}>
            {lipSyncMode === 'driver'
              ? <DriverLipSync active={driverSpeaking} value={mouthOpen} />
              : (
                  <LipSync
                    active={sourceActive}
                    profile={SYNTHETIC_LIPSYNC_PROFILE}
                    source={sourceNode}
                    onError={error => setLipSyncError(error.message)}
                  />
                )}
          </Live2DModel>
          <Diagnostics />
        </Live2DStage>
      )
    : (
        <div className="empty-stage">
          {assetError || (mounted ? 'Loading local assets…' : 'Stage unmounted')}
        </div>
      )

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">LipSync v0.2 playground</p>
          <h1>Declarative Live2D for React</h1>
          <p>
            PIXI stays behind the adapter. The headless runtime owns loading,
            retries, fitting, quality and cleanup while React declares the tree.
          </p>
        </div>
        <a href="/vanilla">Vanilla playground</a>
      </header>

      <section className="workspace">
        <div className="stage-shell">
          {stage}
        </div>

        <aside>
          <label>
            Framing
            <select
              value={typeof fit === 'string' ? fit : 'upper-body'}
              onChange={event => setFit(event.target.value as 'upper-body' | 'full')}
            >
              <option value="upper-body">Upper body</option>
              <option value="full">Full model</option>
            </select>
          </label>

          <label>
            Lip-sync mode
            <select
              aria-label="Lip-sync mode"
              value={lipSyncMode}
              onChange={(event) => {
                const mode = event.target.value as 'driver' | 'source'
                if (mode === 'driver')
                  stopSourceSignal()
                setLipSyncMode(mode)
                setLipSyncError('')
              }}
            >
              <option value="driver">External driver</option>
              <option value="source">Audio source</option>
            </select>
          </label>

          {lipSyncMode === 'driver'
            ? (
                <>
                  <label>
                    ParamMouthOpenY
                    <output>{mouthOpen.toFixed(2)}</output>
                    <input
                      max="1"
                      min="0"
                      step="0.01"
                      type="range"
                      value={mouthOpen}
                      onChange={event => setMouthOpen(Number(event.target.value))}
                    />
                  </label>

                  <label className="toggle">
                    <input
                      checked={driverSpeaking}
                      type="checkbox"
                      onChange={event => setDriverSpeaking(event.target.checked)}
                    />
                    Driver speaking
                  </label>
                </>
              )
            : (
                <>
                  <button
                    type="button"
                    onClick={() => sourceActive
                      ? stopSourceSignal()
                      : void startSourceSignal()}
                  >
                    {sourceActive ? 'Stop test signal' : 'Start test signal'}
                  </button>
                  <output data-testid="lipsync-status">
                    {lipSyncError || (sourceActive ? 'source active' : 'source idle')}
                  </output>
                </>
              )}

          <label className="toggle">
            <input
              checked={fixedQuality}
              type="checkbox"
              onChange={event => setFixedQuality(event.target.checked)}
            />
            Fixed 1× resolution
          </label>

          <button type="button" onClick={() => setMounted(value => !value)}>
            {mounted ? 'Unmount stage' : 'Mount stage'}
          </button>

          <p className="note">
            Source mode owns its test AudioContext here. The library only adds
            and removes the analysis connection.
          </p>
        </aside>
      </section>
    </main>
  )
}
