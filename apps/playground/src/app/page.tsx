'use client'

import type { ModelFit, ModelInfo } from 'live2d-web'
import type { Live2DModelController } from 'live2d-web/react'
import {
  LipSync,
  Live2DCanvas,
  Live2DModel,
  useLive2DCanvas,
} from 'live2d-web/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SYNTHETIC_LIPSYNC_PROFILE } from '../lib/syntheticLipSyncProfile'

interface AssetManifest {
  model3: string
}

interface MotionOption {
  group: string
  index: number
}

function Diagnostics() {
  const stage = useLive2DCanvas()
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
      <button type="button" onClick={retry}>Retry canvas</button>
    </div>
  )
}

export default function Home() {
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [assetError, setAssetError] = useState('')
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [motionValue, setMotionValue] = useState('')
  const [expression, setExpression] = useState('')
  const [hitReadout, setHitReadout] = useState('')
  const [mouthOpen, setMouthOpen] = useState(0)
  const [micActive, setMicActive] = useState(false)
  const [micError, setMicError] = useState('')
  const [mounted, setMounted] = useState(true)
  const [fixedQuality, setFixedQuality] = useState(false)
  const [lipSyncError, setLipSyncError] = useState('')
  const [lipSyncMode, setLipSyncMode] = useState<'demo' | 'source'>('demo')
  const [sourceActive, setSourceActive] = useState(false)
  const [sourceNode, setSourceNode] = useState<AudioNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micRef = useRef<{
    analyser: AnalyserNode
    data: Uint8Array<ArrayBuffer>
    smoothed: number
    source: MediaStreamAudioSourceNode
    stream: MediaStream
  } | null>(null)
  const signalRef = useRef<{
    gain: GainNode
    oscillator: OscillatorNode
  } | null>(null)

  // Volume-based mouth driver: honest microphone demo without a wLipSync
  // calibration profile. Reads the analyser once per frame.
  const micDriver = useMemo(() => ({
    getMouthOpen: () => {
      const mic = micRef.current
      if (!mic)
        return 0
      mic.analyser.getByteTimeDomainData(mic.data)
      let sum = 0
      for (let index = 0; index < mic.data.length; index++) {
        const value = (mic.data[index] - 128) / 128
        sum += value * value
      }
      const rms = Math.sqrt(sum / mic.data.length)
      mic.smoothed = mic.smoothed * 0.7 + Math.min(1, rms * 9) * 0.3
      return mic.smoothed
    },
    isSpeaking: () => micRef.current !== null,
  }), [])

  const stopMic = useCallback(() => {
    const mic = micRef.current
    micRef.current = null
    setMicActive(false)
    if (!mic)
      return
    try {
      mic.source.disconnect()
    }
    catch {
      // The context may already be closed during teardown.
    }
    for (const track of mic.stream.getTracks())
      track.stop()
  }, [])

  const startMic = useCallback(async () => {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      await context.resume()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      micRef.current = {
        analyser,
        data: new Uint8Array(analyser.fftSize),
        smoothed: 0,
        source,
        stream,
      }
      setMicActive(true)
    }
    catch (error) {
      setMicError(error instanceof Error ? error.message : String(error))
    }
  }, [])

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
        if (!response.ok) {
          throw new Error(
            'Demo assets are not available in this build. For local development, run LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets.',
          )
        }
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
      const mic = micRef.current
      micRef.current = null
      if (mic) {
        try {
          mic.source.disconnect()
        }
        catch {
          // Best-effort playground cleanup.
        }
        for (const track of mic.stream.getTracks())
          track.stop()
      }
      void audioContextRef.current?.close()
      audioContextRef.current = null
    }
  }, [])

  const motionOptions = useMemo<MotionOption[]>(() => {
    if (!modelInfo)
      return []
    return Object.entries(modelInfo.motions).flatMap(([group, count]) =>
      Array.from({ length: count }, (_, index) => ({ group, index })))
  }, [modelInfo])

  const handleLoad = useCallback((nextController: Live2DModelController) => {
    setController(nextController)
    const info = nextController.getModelInfo()
    setModelInfo(info)
    const groups = Object.entries(info.motions)
    const firstGroup = groups[0]
    setMotionValue(firstGroup && firstGroup[1] > 0 ? `${firstGroup[0]}:0` : '')
    setExpression(info.expressions[0] ?? '')
  }, [])

  const handleTap = useCallback((hitAreas: string[]) => {
    setHitReadout(hitAreas.length ? `Hit: ${hitAreas.join(', ')}` : 'Hit: none')
    if (!controller || !modelInfo)
      return
    const tapGroup = Object.keys(modelInfo.motions).find(group =>
      group.toLowerCase().includes('tap'))
    if (tapGroup)
      void controller.motion(tapGroup).catch(() => {})
  }, [controller, modelInfo])

  const playMotion = useCallback(() => {
    if (!controller || !motionValue)
      return
    const separator = motionValue.lastIndexOf(':')
    void controller
      .motion(motionValue.slice(0, separator), Number(motionValue.slice(separator + 1)))
      .catch(() => {})
  }, [controller, motionValue])

  const stage = manifest && mounted
    ? (
        <Live2DCanvas
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
          <Live2DModel
            fit={fit}
            followPointer
            src={manifest.model3}
            onLoad={handleLoad}
            onTap={handleTap}
          >
            {lipSyncMode === 'source'
              ? (
                  <LipSync
                    active={sourceActive}
                    profile={SYNTHETIC_LIPSYNC_PROFILE}
                    source={sourceNode}
                    onError={error => setLipSyncError(error.message)}
                  />
                )
              : micActive
                ? <LipSync driver={micDriver} />
                : <LipSync mouthOpen={mouthOpen} speaking={mouthOpen > 0} />}
          </Live2DModel>
          <Diagnostics />
          {hitReadout && <output className="hit-readout">{hitReadout}</output>}
          <p className="stage-hint">Click the character. She follows your pointer.</p>
        </Live2DCanvas>
      )
    : (
        <div className="empty-stage">
          {assetError || (mounted ? 'Loading assets…' : 'Canvas unmounted')}
        </div>
      )

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">live2d-web</p>
          <h1>A Live2D runtime for the web</h1>
          <p>
            Load a Cubism model, react to taps, follow the pointer and lip
            sync. No PixiJS, no globals, React optional.
          </p>
          <code className="install">npm install live2d-web</code>
        </div>
        <nav>
          <a href="https://github.com/Heonys/live2d-web">GitHub</a>
          <a href="/vanilla">Vanilla</a>
          <a href="/inspect">Inspector</a>
          <a href="/compare">Backends</a>
        </nav>
      </header>

      <section className="workspace">
        <div className="stage-shell">
          {stage}
        </div>

        <aside>
          <label>
            Motion
            <select
              aria-label="Motion"
              disabled={!motionOptions.length}
              value={motionValue}
              onChange={event => setMotionValue(event.target.value)}
            >
              {!motionOptions.length && <option value="">No motions</option>}
              {motionOptions.map(motion => (
                <option
                  key={`${motion.group}:${motion.index}`}
                  value={`${motion.group}:${motion.index}`}
                >
                  {motion.group}
                  {' '}
                  {motion.index + 1}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!controller || !motionValue}
            onClick={playMotion}
          >
            Play motion
          </button>

          <label>
            Expression
            <select
              aria-label="Expression"
              disabled={!modelInfo?.expressions.length}
              value={expression}
              onChange={event => setExpression(event.target.value)}
            >
              {!modelInfo?.expressions.length && <option value="">No expressions</option>}
              {modelInfo?.expressions.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!controller || !expression}
            onClick={() => void controller?.expression(expression).catch(() => {})}
          >
            Apply expression
          </button>

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

          {lipSyncMode === 'demo' && (
            <>
              <label>
                Mouth open
                <output>{mouthOpen.toFixed(2)}</output>
                <input
                  disabled={micActive}
                  max="1"
                  min="0"
                  step="0.01"
                  type="range"
                  value={mouthOpen}
                  onChange={event => setMouthOpen(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={() => micActive ? stopMic() : void startMic()}
              >
                {micActive ? 'Stop microphone' : 'Lip sync with microphone'}
              </button>
              {micError && <p className="note">{micError}</p>}
            </>
          )}

          <details className="dev-tools">
            <summary>Developer tools</summary>
            <div className="dev-tools-body">
              <label>
                Lip-sync mode
                <select
                  aria-label="Lip-sync mode"
                  value={lipSyncMode}
                  onChange={(event) => {
                    const mode = event.target.value as 'demo' | 'source'
                    if (mode === 'demo')
                      stopSourceSignal()
                    else
                      stopMic()
                    setLipSyncMode(mode)
                    setLipSyncError('')
                  }}
                >
                  <option value="demo">Demo (slider and microphone)</option>
                  <option value="source">Audio source</option>
                </select>
              </label>

              {lipSyncMode === 'source' && (
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
                {mounted ? 'Unmount canvas' : 'Mount canvas'}
              </button>

              <p className="note">
                Source mode owns its test AudioContext here. The library only
                adds and removes the analysis connection.
              </p>
            </div>
          </details>
        </aside>
      </section>
    </main>
  )
}
