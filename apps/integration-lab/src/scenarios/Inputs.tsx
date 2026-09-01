import type { Live2DInstance, VolumeLipSyncDriver } from 'live2d-web'
import type {
  MediaPipeFaceTracker,
  MediaPipeWorkerFaceTracker,
} from 'live2d-web/tracking/mediapipe'
import { createLive2D, createVolumeLipSync } from 'live2d-web'
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AssetError, ControlGroup, ScenarioHeader, StatusPill } from '../components/Shared'
import {
  CORE_URL,
  MEDIAPIPE_MODEL_URL,
  MEDIAPIPE_WASM_URL,
  TRACKING_PORTRAIT_URL,
} from '../constants'
import { recordError, setLabModels, setLabStatus } from '../diagnostics'
import { useManifest } from '../useManifest'

type FaceTracker = MediaPipeFaceTracker | MediaPipeWorkerFaceTracker
type Execution = 'main' | 'worker'

function rmsFromAnalyser(analyser: AnalyserNode, samples: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(samples)
  let sum = 0
  for (const sample of samples)
    sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

export function Inputs() {
  const { error, manifest, retry } = useManifest()
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Live2DInstance | null>(null)
  const volumeRef = useRef<VolumeLipSyncDriver>(createVolumeLipSync())
  const volumeFrameRef = useRef(0)
  const micCleanupRef = useRef<(() => void) | null>(null)
  const trackerRef = useRef<FaceTracker | null>(null)
  const trackingDetachRef = useRef<(() => void) | null>(null)
  const trackingFrameRef = useRef(0)
  const trackingGenerationRef = useRef(0)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [execution, setExecution] = useState<Execution>('main')
  const [manualVolume, setManualVolume] = useState(0)
  const [micStatus, setMicStatus] = useState('idle')
  const [runtimeStatus, setRuntimeStatus] = useState('idle')
  const [trackingError, setTrackingError] = useState('')
  const [trackingStatus, setTrackingStatus] = useState('idle')

  const stopSynthetic = useCallback(() => {
    cancelAnimationFrame(volumeFrameRef.current)
    volumeFrameRef.current = 0
  }, [])

  const stopMicrophone = useCallback(() => {
    micCleanupRef.current?.()
    micCleanupRef.current = null
    setMicStatus('idle')
  }, [])

  const stopTracking = useCallback(() => {
    trackingGenerationRef.current += 1
    cancelAnimationFrame(trackingFrameRef.current)
    trackingFrameRef.current = 0
    trackingDetachRef.current?.()
    trackingDetachRef.current = null
    trackerRef.current?.dispose()
    trackerRef.current = null
    cameraStreamRef.current?.getTracks().forEach(track => track.stop())
    cameraStreamRef.current = null
    if (videoRef.current)
      videoRef.current.srcObject = null
    setTrackingStatus('disposed')
  }, [])

  useEffect(() => {
    if (!manifest || !containerRef.current)
      return
    let active = true
    const driver = createVolumeLipSync()
    for (let elapsed = 0; elapsed <= 1_600; elapsed += 20)
      driver.sample(0, elapsed)
    volumeRef.current = driver
    // The effect owns this runtime, so loading starts synchronously with it.
    // eslint-disable-next-line react/set-state-in-effect
    setRuntimeStatus('loading')
    void createLive2D({
      accessibility: { label: 'Live2D input integration preview' },
      container: containerRef.current,
      coreUrl: CORE_URL,
      fit: { offsetY: 0.05, scale: 0.76, units: 'stage' },
      onError: recordError,
      src: manifest.model3,
    }).then((instance) => {
      if (!active) {
        instance.dispose()
        return
      }
      instanceRef.current = instance
      instance.addLipSync({ driver })
      setRuntimeStatus('ready')
      setLabStatus('ready', '/inputs')
      setLabModels(1)
    }).catch((caught) => {
      recordError(caught)
      setRuntimeStatus('error')
      setLabStatus('error', '/inputs')
    })
    return () => {
      active = false
      stopSynthetic()
      stopMicrophone()
      stopTracking()
      instanceRef.current?.dispose()
      instanceRef.current = null
      setLabModels(0)
      setLabStatus('disposed', '/inputs')
    }
  }, [manifest, stopMicrophone, stopSynthetic, stopTracking])

  const updateManualVolume = (value: number) => {
    setManualVolume(value)
    volumeRef.current.sample(value, 2_000 + performance.now())
  }

  const startSynthetic = () => {
    stopSynthetic()
    const startedAt = performance.now()
    const sample = (now: number) => {
      const elapsed = now - startedAt
      const envelope = Math.max(0, Math.sin(elapsed / 180)) * 0.18
      volumeRef.current.sample(envelope, 2_000 + elapsed)
      setManualVolume(Number(envelope.toFixed(3)))
      volumeFrameRef.current = requestAnimationFrame(sample)
    }
    volumeFrameRef.current = requestAnimationFrame(sample)
  }

  const startMicrophone = async () => {
    stopSynthetic()
    stopMicrophone()
    setMicStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const context = new AudioContext()
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      let frame = 0
      const startedAt = performance.now()
      const tick = (now: number) => {
        const rms = rmsFromAnalyser(analyser, samples)
        volumeRef.current.sample(rms, now - startedAt)
        setManualVolume(Number(rms.toFixed(3)))
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      micCleanupRef.current = () => {
        cancelAnimationFrame(frame)
        source.disconnect()
        analyser.disconnect()
        stream.getTracks().forEach(track => track.stop())
        void context.close()
      }
      setMicStatus('active')
    }
    catch (caught) {
      recordError(caught)
      setMicStatus('error')
    }
  }

  const createTracker = async () => execution === 'worker'
    ? createMediaPipeFaceTracker({
        execution: 'worker',
        modelAssetPath: MEDIAPIPE_MODEL_URL,
        wasmPath: MEDIAPIPE_WASM_URL,
        workerFactory: () => new Worker(new URL('../tracking.worker.ts', import.meta.url), { type: 'module' }),
      })
    : createMediaPipeFaceTracker({
        execution: 'main',
        modelAssetPath: MEDIAPIPE_MODEL_URL,
        wasmPath: MEDIAPIPE_WASM_URL,
      })

  const attachTracker = (tracker: FaceTracker) => {
    const instance = instanceRef.current
    if (!instance)
      throw new Error('The Live2D model is not ready.')
    trackerRef.current = tracker
    trackingDetachRef.current = tracker.attach(instance, {
      channels: { mouth: false },
      mapping: 'auto',
      sensitivity: { eyes: 1, pose: 1.35 },
    })
  }

  const runPortrait = async () => {
    stopTracking()
    setTrackingError('')
    const generation = ++trackingGenerationRef.current
    setTrackingStatus('initializing')
    try {
      const image = new Image()
      image.src = TRACKING_PORTRAIT_URL
      await image.decode()
      const tracker = await createTracker()
      if (generation !== trackingGenerationRef.current) {
        tracker.dispose()
        return
      }
      attachTracker(tracker)
      const startedAt = performance.now()
      let status = 'calibrating'
      for (let frame = 0; frame < 40 && status === 'calibrating'; frame += 1) {
        const update = await tracker.update(image, startedAt + frame * 34)
        if (update.status !== 'skipped')
          status = update.status
      }
      setTrackingStatus(status)
    }
    catch (caught) {
      recordError(caught)
      setTrackingError(caught instanceof Error ? caught.message : String(caught))
      setTrackingStatus('error')
    }
  }

  const startCamera = async () => {
    stopTracking()
    setTrackingError('')
    const generation = ++trackingGenerationRef.current
    setTrackingStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      const video = videoRef.current
      if (!video)
        throw new Error('Camera preview is unavailable.')
      cameraStreamRef.current = stream
      video.srcObject = stream
      await video.play()
      const tracker = await createTracker()
      if (generation !== trackingGenerationRef.current) {
        tracker.dispose()
        stream.getTracks().forEach(track => track.stop())
        return
      }
      attachTracker(tracker)
      let pending = false
      const tick = (now: number) => {
        trackingFrameRef.current = requestAnimationFrame(tick)
        if (pending)
          return
        pending = true
        void Promise.resolve(tracker.update(video, now)).then((update) => {
          if (generation === trackingGenerationRef.current && update.status !== 'skipped')
            setTrackingStatus(update.status)
        }).catch((caught) => {
          recordError(caught)
          setTrackingStatus('error')
        }).finally(() => { pending = false })
      }
      trackingFrameRef.current = requestAnimationFrame(tick)
    }
    catch (caught) {
      recordError(caught)
      setTrackingError(caught instanceof Error ? caught.message : String(caught))
      setTrackingStatus('error')
    }
  }

  const simulateFaceLost = async () => {
    const tracker = trackerRef.current
    if (!tracker)
      return
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const startedAt = performance.now()
    try {
      let status = trackingStatus
      for (let frame = 0; frame < 40 && status !== 'lost'; frame += 1) {
        const update = await tracker.update(canvas, startedAt + frame * 34)
        if (update.status !== 'skipped')
          status = update.status
      }
      setTrackingStatus(status)
    }
    catch (caught) {
      recordError(caught)
      setTrackingError(caught instanceof Error ? caught.message : String(caught))
      setTrackingStatus('error')
    }
  }

  return (
    <main>
      <ScenarioHeader eyebrow="Optional integrations" title="Audio & Tracking">
        Exercise caller-owned microphone and camera lifecycles while one runtime combines lip sync with face tracking.
      </ScenarioHeader>
      {error && !manifest && <AssetError message={error} retry={retry} />}
      <div className="input-layout">
        <section className="input-stage" data-testid="input-stage">
          <div ref={containerRef} className="runtime-canvas" />
          <video ref={videoRef} aria-label="Camera preview" muted playsInline />
          <output className="stage-diagnostics" data-testid="input-status">
            <b>{runtimeStatus}</b>
            <span>
              mouth
              {' '}
              {manualVolume.toFixed(3)}
              {' '}
              · face
              {' '}
              {trackingStatus}
            </span>
          </output>
        </section>
        <aside className="control-panel">
          <ControlGroup label="Lip sync input">
            <label>
              Manual RMS
              <input aria-label="Manual RMS" max="0.25" min="0" step="0.005" type="range" value={manualVolume} onChange={event => updateManualVolume(Number(event.target.value))} />
            </label>
            <div className="button-row">
              <button type="button" onClick={startSynthetic}>Synthetic speech</button>
              <button type="button" onClick={stopSynthetic}>Stop synthetic</button>
              <button type="button" onClick={() => void startMicrophone()}>Start microphone</button>
              <button type="button" onClick={stopMicrophone}>Stop microphone</button>
            </div>
            <StatusPill state={micStatus === 'active' ? 'good' : micStatus === 'error' ? 'bad' : 'neutral'}>{micStatus}</StatusPill>
          </ControlGroup>
          <ControlGroup label="Face tracking">
            <label>
              Execution
              <select aria-label="Face tracking execution" value={execution} onChange={event => setExecution(event.target.value as Execution)}>
                <option value="main">Main thread</option>
                <option value="worker">Worker</option>
              </select>
            </label>
            <div className="button-row">
              <button disabled={!instanceRef.current} type="button" onClick={() => void runPortrait()}>Run portrait</button>
              <button disabled={!instanceRef.current} type="button" onClick={() => void startCamera()}>Start camera</button>
              <button disabled={!trackerRef.current} type="button" onClick={() => void simulateFaceLost()}>Simulate face lost</button>
              <button type="button" onClick={stopTracking}>Stop tracking</button>
              <button disabled={!trackerRef.current} type="button" onClick={() => trackerRef.current?.calibrate()}>Recalibrate</button>
            </div>
            <StatusPill state={trackingStatus === 'tracked' ? 'good' : trackingStatus === 'error' ? 'bad' : 'neutral'}>{trackingStatus}</StatusPill>
            {trackingError && <p className="input-error" role="alert">{trackingError}</p>}
            <p className="note">The mouth channel stays with lip sync; tracking drives pose, eyes, brows and cheeks.</p>
          </ControlGroup>
        </aside>
      </div>
    </main>
  )
}
