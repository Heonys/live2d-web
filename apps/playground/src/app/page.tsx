'use client'

import type {
  ExpressionOptions,
  IdleMotion,
  ModelFit,
  ModelInfo,
  MotionOptions,
  VolumeLipSyncDriver,
} from 'live2d-web'
import type { Live2DModelController } from 'live2d-web/react'
import type {
  MediaPipeAttachOptions,
  MediaPipeFaceChannel,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeMappingMode,
  MediaPipeWorkerFaceTracker,
} from 'live2d-web/tracking/mediapipe'
import type { AssetManifest } from '../lib/assetManifest'
import { createVolumeLipSync } from 'live2d-web'
import {
  LipSync,
  Live2DCanvas,
  Live2DModel,
  useLive2DCanvas,
} from 'live2d-web/react'
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { StageLoading } from '../components/StageLoading'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../lib/assetManifest'
import { SYNTHETIC_LIPSYNC_PROFILE } from '../lib/syntheticLipSyncProfile'

const POSE_PARAMETER_IDS = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamBodyAngleX',
  'ParamBodyAngleY',
  'ParamBodyAngleZ',
] as const

interface MotionOption {
  group: string
  index: number
}

type MotionFadePreset = '500' | 'instant' | 'model'
type IdlePreset = 'first' | 'uniform'
type FaceTracker = MediaPipeFaceTracker | MediaPipeWorkerFaceTracker
type FaceTrackingExecution = 'main' | 'worker'

function optionsForFadePreset(preset: MotionFadePreset): MotionOptions | undefined {
  if (preset === 'model')
    return undefined
  const milliseconds = preset === 'instant' ? 0 : 500
  return { fadeInMs: milliseconds, fadeOutMs: milliseconds }
}

function expressionOptionsForFadePreset(
  preset: MotionFadePreset,
): ExpressionOptions | undefined {
  if (preset === 'model')
    return undefined
  const milliseconds = preset === 'instant' ? 0 : 500
  return { fadeInMs: milliseconds, fadeOutMs: milliseconds }
}

const DEMO_CODE = `import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'

<Live2DCanvas coreUrl="/live2dcubismcore.min.js" quality="auto">
  <Live2DModel
    src="/models/hiyori/hiyori.model3.json"
    fit="upper-body"
    followPointer
    onTap={(hitAreas) => hitAreas.includes('Body') && controller.motion('Tap')}
    onLoad={setController}
  >
    <LipSync mouthOpen={mouth} speaking={mouth > 0} />
  </Live2DModel>
</Live2DCanvas>`

// Dependency-free demo highlighter: strings, keywords, JSX tags, attributes.
const CODE_TOKENS = /('[^']*'|"[^"]*")|(\b(?:import|from|return)\b)|(<\/?[A-Z][A-Za-z0-9]*|\/>)|([a-zA-Z]\w*(?==))/g

function HighlightedCode({ code }: { code: string }) {
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const match of code.matchAll(CODE_TOKENS)) {
    if (match.index > cursor)
      parts.push(code.slice(cursor, match.index))
    const [text, string, keyword, tag, attribute] = match
    const className = string
      ? 'tok-s'
      : keyword
        ? 'tok-k'
        : tag
          ? 'tok-t'
          : attribute
            ? 'tok-a'
            : undefined
    parts.push(<span key={match.index} className={className}>{text}</span>)
    cursor = match.index + text.length
  }
  parts.push(code.slice(cursor))
  return <code>{parts}</code>
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

// The error panel is translucent, so an ungated hint used to show through
// underneath a render error.
function StageHint() {
  const stage = useLive2DCanvas()
  if (stage.status !== 'ready')
    return null
  return <p className="stage-hint">Click the character. She follows your pointer.</p>
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
  // The runtime injects the Core script only after hydration, so the preload
  // scanner never sees it. This starts the 223KB download during HTML parse.
  preload(CUBISM_CORE_URL, { as: 'script' })
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [assetError, setAssetError] = useState('')
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [motionValue, setMotionValue] = useState('')
  const [motionFadePreset, setMotionFadePreset] = useState<MotionFadePreset>('model')
  const [playingMotion, setPlayingMotion] = useState<string | null>(null)
  const [motionResult, setMotionResult] = useState('')
  const playGenerationRef = useRef(0)
  const codeSampleRef = useRef<HTMLDetailsElement>(null)
  const [expression, setExpression] = useState('')
  const [expressionFadePreset, setExpressionFadePreset]
    = useState<MotionFadePreset>('model')
  const [idlePreset, setIdlePreset] = useState<IdlePreset>('uniform')
  const [hitReadout, setHitReadout] = useState('')
  const [mouthOpen, setMouthOpen] = useState(0)
  const [micActive, setMicActive] = useState(false)
  const [micError, setMicError] = useState('')
  const [mounted, setMounted] = useState(true)
  const [fixedQuality, setFixedQuality] = useState(false)
  const [lipSyncError, setLipSyncError] = useState('')
  const [lipSyncMode, setLipSyncMode] = useState<'demo' | 'source'>('demo')
  const [faceTrackingActive, setFaceTrackingActive] = useState(false)
  const [faceTrackingError, setFaceTrackingError] = useState('')
  const [faceTrackingStatus, setFaceTrackingStatus] = useState('idle')
  const [faceInferenceMs, setFaceInferenceMs] = useState(0)
  const [faceRoundTripMs, setFaceRoundTripMs] = useState(0)
  const [faceEffectiveFps, setFaceEffectiveFps] = useState(0)
  const [faceSkippedRatio, setFaceSkippedRatio] = useState(0)
  const [faceExecution, setFaceExecution] = useState<FaceTrackingExecution>('worker')
  const [faceMapping, setFaceMapping] = useState<MediaPipeMappingMode>('auto')
  const [facePoseSensitivity, setFacePoseSensitivity] = useState(3)
  const [faceLostMode, setFaceLostMode] = useState<MediaPipeFaceLostBehaviour>('hold')
  const [facePose, setFacePose] = useState({ x: 0, y: 0, z: 0 })
  const [facePeak, setFacePeak] = useState({ x: 0, y: 0, z: 0 })
  const [faceBody, setFaceBody] = useState({ x: 0, y: 0, z: 0 })
  const [faceRanges, setFaceRanges] = useState('')
  const facePeakRef = useRef({ x: 0, y: 0, z: 0 })
  const facePoseSampledAtRef = useRef(0)

  const [facePreviewMirrored, setFacePreviewMirrored] = useState(true)
  const [faceChannels, setFaceChannels] = useState<Record<MediaPipeFaceChannel, boolean>>({
    brows: true,
    cheeks: true,
    eyes: true,
    mouth: true,
    pose: true,
  })
  const [sourceActive, setSourceActive] = useState(false)
  const [sourceNode, setSourceNode] = useState<AudioNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micGenerationRef = useRef(0)
  const faceGenerationRef = useRef(0)
  const faceVideoRef = useRef<HTMLVideoElement>(null)
  const faceTrackingRef = useRef<{
    detach: () => void
    frame: number
    stream: MediaStream
    tracker: FaceTracker
  } | null>(null)
  const micRef = useRef<{
    analyser: AnalyserNode
    data: Uint8Array<ArrayBuffer>
    frame: number
    source: MediaStreamAudioSourceNode
    stream: MediaStream
    volume: VolumeLipSyncDriver
  } | null>(null)
  const signalRef = useRef<{
    gain: GainNode
    oscillator: OscillatorNode
  } | null>(null)

  // The sampler below owns WebAudio and rAF. The library driver only turns
  // caller-provided RMS samples into stable mouth values.
  const micDriver = useMemo(() => ({
    getMouthOpen: () => micRef.current?.volume.getMouthOpen() ?? 0,
    isSpeaking: () => micRef.current?.volume.isSpeaking() ?? false,
  }), [])

  const stopMic = useCallback(() => {
    micGenerationRef.current++
    const mic = micRef.current
    micRef.current = null
    setMicActive(false)
    if (!mic)
      return
    cancelAnimationFrame(mic.frame)
    try {
      mic.source.disconnect()
    }
    catch {
      // The context may already be closed during teardown.
    }
    for (const track of mic.stream.getTracks())
      track.stop()
  }, [])

  const stopFaceTracking = useCallback(() => {
    faceGenerationRef.current++
    const tracking = faceTrackingRef.current
    faceTrackingRef.current = null
    setFaceTrackingActive(false)
    setFaceTrackingStatus('idle')
    if (tracking) {
      cancelAnimationFrame(tracking.frame)
      tracking.detach()
      tracking.tracker.dispose()
      for (const track of tracking.stream.getTracks())
        track.stop()
    }
    const video = faceVideoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
  }, [])

  const resetFacePeak = useCallback(() => {
    facePeakRef.current = { x: 0, y: 0, z: 0 }
    setFacePeak({ x: 0, y: 0, z: 0 })
  }, [])

  const startFaceTracking = useCallback(async () => {
    stopFaceTracking()
    setFaceTrackingError('')
    setFaceTrackingStatus('initializing')
    resetFacePeak()
    const generation = ++faceGenerationRef.current
    let stream: MediaStream | undefined
    let tracker: FaceTracker | undefined
    try {
      if (!controller)
        throw new Error('Wait for the Live2D model to become ready.')
      const activeController = controller
      const modelParameters = new Map(
        (activeController.getModelInfo().parameters ?? []).map(entry => [entry.id, entry]),
      )
      setFaceRanges(POSE_PARAMETER_IDS.map((id) => {
        const entry = modelParameters.get(id)
        return entry
          ? `${id.replace('Param', '')} ${entry.minimum}..${entry.maximum}@${entry.defaultValue}`
          : `${id} absent`
      }).join('  '))
      const video = faceVideoRef.current
      if (!video)
        throw new Error('The camera preview is not mounted.')
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      })
      if (generation !== faceGenerationRef.current) {
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      video.srcObject = stream
      await video.play()
      if (generation !== faceGenerationRef.current) {
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      const sharedOptions = {
        modelAssetPath: '/assets/mediapipe/face_landmarker.task',
        onFaceLost: faceLostMode,
        wasmPath: '/assets/mediapipe/wasm',
      } as const
      const createdTracker: FaceTracker = faceExecution === 'worker'
        ? await createMediaPipeFaceTracker({
            ...sharedOptions,
            execution: 'worker',
            workerFactory: () => new Worker(
              new URL('../workers/face-tracking.worker.ts', import.meta.url),
              { type: 'module' },
            ),
          })
        : await createMediaPipeFaceTracker(sharedOptions)
      tracker = createdTracker
      if (generation !== faceGenerationRef.current) {
        createdTracker.dispose()
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      const attachOptions: MediaPipeAttachOptions = {
        channels: faceChannels,
        mapping: faceMapping,
        sensitivity: { pose: facePoseSensitivity },
      }
      const tracking = {
        detach: createdTracker.attach(controller, attachOptions),
        frame: 0,
        stream,
        tracker: createdTracker,
      }
      faceTrackingRef.current = tracking
      let attemptedFrames = 0
      let skippedFrames = 0
      const startedAt = performance.now()
      const sample = async (timestamp: number) => {
        if (faceTrackingRef.current !== tracking)
          return
        tracking.frame = requestAnimationFrame(nextTimestamp => void sample(nextTimestamp))
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            attemptedFrames++
            const roundTripStartedAt = performance.now()
            const update = await createdTracker.update(video, timestamp)
            const roundTripMs = Math.max(0, performance.now() - roundTripStartedAt)
            if (update.status !== 'skipped') {
              setFaceTrackingStatus(update.status)
              setFaceInferenceMs(update.inferenceMs)
              setFaceRoundTripMs(roundTripMs)
              setFaceEffectiveFps(update.effectiveFps)
            }
            else {
              skippedFrames++
            }
            if (performance.now() - startedAt >= 500)
              setFaceSkippedRatio(skippedFrames / Math.max(1, attemptedFrames))
            // Read back the model rather than the tracker: this is the value that
            // survived motions, physics and every other driver, which is what the
            // rendered head angle actually uses.
            const pose = {
              x: activeController.getParameter('ParamAngleX'),
              y: activeController.getParameter('ParamAngleY'),
              z: activeController.getParameter('ParamAngleZ'),
            }
            const peak = facePeakRef.current
            peak.x = Math.max(peak.x, Math.abs(pose.x))
            peak.y = Math.max(peak.y, Math.abs(pose.y))
            peak.z = Math.max(peak.z, Math.abs(pose.z))
            if (timestamp - facePoseSampledAtRef.current >= 100) {
              facePoseSampledAtRef.current = timestamp
              setFacePose(pose)
              setFacePeak({ ...peak })
              setFaceBody({
                x: activeController.getParameter('ParamBodyAngleX'),
                y: activeController.getParameter('ParamBodyAngleY'),
                z: activeController.getParameter('ParamBodyAngleZ'),
              })
            }
          }
          catch (error) {
            setFaceTrackingError(error instanceof Error ? error.message : String(error))
            stopFaceTracking()
          }
        }
      }
      tracking.frame = requestAnimationFrame(timestamp => void sample(timestamp))
      setFaceTrackingActive(true)
    }
    catch (error) {
      tracker?.dispose()
      for (const track of stream?.getTracks() ?? [])
        track.stop()
      const video = faceVideoRef.current
      if (video && video.srcObject === stream) {
        video.pause()
        video.srcObject = null
      }
      if (generation === faceGenerationRef.current) {
        setFaceTrackingError(error instanceof Error ? error.message : String(error))
        setFaceTrackingStatus('error')
      }
    }
  }, [
    controller,
    faceChannels,
    faceLostMode,
    faceMapping,
    facePoseSensitivity,
    faceExecution,
    resetFacePeak,
    stopFaceTracking,
  ])

  const startMic = useCallback(async () => {
    stopMic()
    setMicError('')
    const generation = ++micGenerationRef.current
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (generation !== micGenerationRef.current) {
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      await context.resume()
      if (generation !== micGenerationRef.current) {
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      const volume = createVolumeLipSync()
      const startedAt = performance.now()
      const mic = {
        analyser,
        data: new Uint8Array(analyser.fftSize),
        frame: 0,
        source,
        stream,
        volume,
      }
      micRef.current = mic
      const sample = (timestamp: number) => {
        if (micRef.current !== mic)
          return
        analyser.getByteTimeDomainData(mic.data)
        let sum = 0
        for (let index = 0; index < mic.data.length; index++) {
          const value = (mic.data[index] - 128) / 128
          sum += value * value
        }
        volume.sample(Math.sqrt(sum / mic.data.length), timestamp - startedAt)
        mic.frame = requestAnimationFrame(sample)
      }
      mic.frame = requestAnimationFrame(sample)
      setMicActive(true)
    }
    catch (error) {
      for (const track of stream?.getTracks() ?? [])
        track.stop()
      if (generation === micGenerationRef.current)
        setMicError(error instanceof Error ? error.message : String(error))
    }
  }, [stopMic])

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
      .then((loaded) => {
        warmUpModelAssets(loaded)
        setManifest(loaded)
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setAssetError(error instanceof Error ? error.message : String(error))
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const micGeneration = micGenerationRef
    const faceGeneration = faceGenerationRef
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
      micGeneration.current++
      micRef.current = null
      if (mic) {
        cancelAnimationFrame(mic.frame)
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
      const face = faceTrackingRef.current
      faceGeneration.current++
      faceTrackingRef.current = null
      if (face) {
        cancelAnimationFrame(face.frame)
        face.detach()
        face.tracker.dispose()
        for (const track of face.stream.getTracks())
          track.stop()
      }
    }
  }, [])

  useEffect(() => {
    const tracking = faceTrackingRef.current
    if (!tracking)
      return
    tracking.detach()
    if (!controller) {
      queueMicrotask(stopFaceTracking)
      return
    }
    try {
      tracking.detach = tracking.tracker.attach(controller, {
        channels: faceChannels,
        mapping: faceMapping,
        sensitivity: { pose: facePoseSensitivity },
      })
    }
    catch (error) {
      queueMicrotask(() => {
        setFaceTrackingError(error instanceof Error ? error.message : String(error))
        stopFaceTracking()
      })
    }
  }, [controller, faceChannels, faceMapping, facePoseSensitivity, stopFaceTracking])

  // onFaceLost is fixed when the Face Landmarker is built, so re-attaching
  // cannot pick it up: the whole tracker has to come back.
  const faceLostModeRef = useRef(faceLostMode)
  useEffect(() => {
    if (faceLostModeRef.current === faceLostMode)
      return
    faceLostModeRef.current = faceLostMode
    if (faceTrackingRef.current)
      void startFaceTracking()
  }, [faceLostMode, startFaceTracking])

  const motionOptions = useMemo<MotionOption[]>(() => {
    if (!modelInfo)
      return []
    return Object.entries(modelInfo.motions).flatMap(([group, count]) =>
      Array.from({ length: count }, (_, index) => ({ group, index })))
  }, [modelInfo])

  const idleMotion = useMemo<IdleMotion>(() => {
    if (idlePreset === 'uniform')
      return 'Idle'
    const count = modelInfo?.motions.Idle ?? 0
    if (count === 0)
      return 'Idle'
    return {
      group: 'Idle',
      weights: Array.from({ length: count }, (_, index) => index === 0 ? 1 : 0),
    }
  }, [idlePreset, modelInfo?.motions.Idle])

  const handleLoad = useCallback((nextController: Live2DModelController) => {
    setController(nextController)
    const info = nextController.getModelInfo()
    setModelInfo(info)
    // Default to a tap-style motion: playing an Idle entry is visually
    // indistinguishable from the automatic idle loop.
    const groups = Object.keys(info.motions).filter(group => info.motions[group] > 0)
    const preferred = groups.find(group => group.toLowerCase().includes('tap')) ?? groups[0]
    setMotionValue(preferred ? `${preferred}:0` : '')
    setExpression(info.expressions[0] ?? '')
  }, [])

  // playMotion() also explains why playback ended, so the demo can distinguish
  // a natural finish from replacement or model cleanup.
  const runMotion = useCallback((group: string, index?: number) => {
    if (!controller)
      return
    const generation = ++playGenerationRef.current
    setPlayingMotion(index === undefined ? group : `${group} ${index + 1}`)
    setMotionResult('')
    void controller
      .playMotion(group, index, optionsForFadePreset(motionFadePreset))
      .then((result) => {
        if (playGenerationRef.current === generation)
          setMotionResult(result.status)
      })
      .catch((error: unknown) => {
        if (playGenerationRef.current === generation)
          setMotionResult(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (playGenerationRef.current === generation)
          setPlayingMotion(null)
      })
  }, [controller, motionFadePreset])

  const handleTap = useCallback((hitAreas: string[]) => {
    setHitReadout(hitAreas.length ? `Hit: ${hitAreas.join(', ')}` : 'Hit: none')
    if (!modelInfo)
      return
    const tapGroup = Object.keys(modelInfo.motions).find(group =>
      group.toLowerCase().includes('tap'))
    if (tapGroup)
      runMotion(tapGroup)
  }, [modelInfo, runMotion])

  const playMotion = useCallback(() => {
    if (!motionValue)
      return
    const separator = motionValue.lastIndexOf(':')
    runMotion(motionValue.slice(0, separator), Number(motionValue.slice(separator + 1)))
  }, [motionValue, runMotion])

  const playSequence = useCallback(() => {
    if (!controller || motionOptions.length === 0)
      return
    const preferred = motionOptions.filter(option => option.group !== 'Idle')
    const candidates = preferred.length > 0 ? preferred : motionOptions
    const selected = candidates.slice(0, 2)
    if (selected.length === 1)
      selected.push(selected[0])
    const generation = ++playGenerationRef.current
    setPlayingMotion('sequence')
    setMotionResult('')
    void controller.sequence(selected.map(step => ({
      ...step,
      options: optionsForFadePreset(motionFadePreset),
    }))).then((result) => {
      if (playGenerationRef.current === generation) {
        setMotionResult(
          `${result.status} (${result.completedSteps}/${selected.length})`,
        )
      }
    }).catch((error: unknown) => {
      if (playGenerationRef.current === generation)
        setMotionResult(error instanceof Error ? error.message : String(error))
    }).finally(() => {
      if (playGenerationRef.current === generation)
        setPlayingMotion(null)
    })
  }, [controller, motionFadePreset, motionOptions])

  const stage = manifest && mounted
    ? (
        <Live2DCanvas
          coreUrl={CUBISM_CORE_URL}
          {...(fixedQuality ? { resolution: 1 } : { quality: 'auto' as const })}
          fallback={() => <StageLoading />}
          errorFallback={(error, retry) => (
            <StageError code={error.code} message={error.message} retry={retry} />
          )}
        >
          <Live2DModel
            fit={fit}
            // Pointer follow and face tracking both drive ParamAngle*, and the
            // pointer wins nothing but confusion while a face is attached.
            followPointer={!faceTrackingActive}
            idleMotion={idleMotion}
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
          <StageHint />
        </Live2DCanvas>
      )
    : assetError
      ? (
          <div className="stage-overlay error-panel" role="alert">
            <strong>Demo assets unavailable</strong>
            <p>{assetError}</p>
          </div>
        )
      : mounted
        ? <StageLoading />
        : <div className="empty-stage">Canvas unmounted</div>

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
          <Link href="/vanilla">Vanilla</Link>
          <Link href="/inspect">Inspector</Link>
          <Link href="/compare">Backends</Link>
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
            disabled={!controller || !motionValue || playingMotion !== null}
            onClick={playMotion}
          >
            {playingMotion ? 'Playing…' : 'Play motion'}
          </button>
          {playingMotion && (
            <output className="note" data-testid="playing-motion">
              Playing
              {' '}
              {playingMotion}
            </output>
          )}
          {motionResult && (
            <output className="note" data-testid="motion-result">
              Result:
              {' '}
              {motionResult}
            </output>
          )}

          {modelInfo?.expressions.length
            ? (
                <>
                  <label>
                    Expression
                    <select
                      aria-label="Expression"
                      value={expression}
                      onChange={event => setExpression(event.target.value)}
                    >
                      {modelInfo.expressions.map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!controller || !expression}
                    onClick={() => void controller?.expression(
                      expression,
                      expressionOptionsForFadePreset(expressionFadePreset),
                    ).catch(() => {})}
                  >
                    Apply expression
                  </button>
                </>
              )
            : modelInfo && (
              <p className="note">
                This model ships no expression files, so the expression
                control is hidden. Try your own model in the Inspector.
              </p>
            )}

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
                  aria-label="Mouth open"
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

          <button
            type="button"
            onClick={() => {
              const details = codeSampleRef.current
              if (details) {
                details.open = true
                details.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
          >
            View code
          </button>

          <details className="dev-tools">
            <summary>Developer tools</summary>
            <div className="dev-tools-body">
              <label>
                Motion fade
                <select
                  aria-label="Motion fade"
                  value={motionFadePreset}
                  onChange={event => setMotionFadePreset(event.target.value as MotionFadePreset)}
                >
                  <option value="model">Model default</option>
                  <option value="instant">Instant</option>
                  <option value="500">500 ms</option>
                </select>
              </label>

              <button
                type="button"
                disabled={!controller || motionOptions.length === 0 || playingMotion !== null}
                onClick={playSequence}
              >
                Play sequence
              </button>

              <label>
                Idle selection
                <select
                  aria-label="Idle selection"
                  value={idlePreset}
                  onChange={event => setIdlePreset(event.target.value as IdlePreset)}
                >
                  <option value="uniform">Uniform</option>
                  <option value="first">First only</option>
                </select>
              </label>

              <label>
                Expression fade
                <select
                  aria-label="Expression fade"
                  value={expressionFadePreset}
                  onChange={event => setExpressionFadePreset(
                    event.target.value as MotionFadePreset,
                  )}
                >
                  <option value="model">Model default</option>
                  <option value="instant">Instant</option>
                  <option value="500">500 ms</option>
                </select>
              </label>

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

              <section className="tracking-tools">
                <strong>MediaPipe face tracking</strong>
                <video
                  ref={faceVideoRef}
                  muted
                  playsInline
                  data-testid="face-preview"
                  style={{ transform: facePreviewMirrored ? 'scaleX(-1)' : undefined }}
                />
                <output data-testid="face-tracking-status">
                  {faceTrackingStatus}
                  {faceTrackingActive && ` · inference ${faceInferenceMs.toFixed(1)} ms · round trip ${faceRoundTripMs.toFixed(1)} ms · ${faceEffectiveFps.toFixed(0)} fps · ${(faceSkippedRatio * 100).toFixed(0)}% skipped`}
                </output>
                {faceTrackingActive && (
                  <table className="pose-readout" data-testid="face-pose-readout">
                    <thead>
                      <tr>
                        <th>Head angle</th>
                        <th>now</th>
                        <th>peak</th>
                        <th>body</th>
                        <th>range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ['X turn', facePose.x, facePeak.x, faceBody.x],
                        ['Y nod', facePose.y, facePeak.y, faceBody.y],
                        ['Z tilt', facePose.z, facePeak.z, faceBody.z],
                      ] as const).map(([label, now, peak, body]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{now.toFixed(1)}</td>
                          <td>{peak.toFixed(1)}</td>
                          <td>{body.toFixed(2)}</td>
                          <td>
                            <span
                              className="pose-bar"
                              style={{ width: `${Math.min(100, peak / 30 * 100)}%` }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {faceTrackingActive && faceRanges && (
                  <p className="pose-ranges">{faceRanges}</p>
                )}
                <button
                  type="button"
                  disabled={!controller}
                  onClick={() => faceTrackingActive
                    ? stopFaceTracking()
                    : void startFaceTracking()}
                >
                  {faceTrackingActive ? 'Stop face tracking' : 'Start face tracking'}
                </button>
                <button
                  type="button"
                  disabled={!faceTrackingActive}
                  onClick={() => {
                    faceTrackingRef.current?.tracker.calibrate()
                    resetFacePeak()
                  }}
                >
                  Recalibrate face
                </button>
                <label>
                  Execution
                  <select
                    aria-label="Face tracking execution"
                    disabled={faceTrackingActive}
                    value={faceExecution}
                    onChange={event => setFaceExecution(
                      event.target.value as FaceTrackingExecution,
                    )}
                  >
                    <option value="worker">Worker</option>
                    <option value="main">Main thread</option>
                  </select>
                </label>
                <label>
                  Pose sensitivity
                  <output>{facePoseSensitivity.toFixed(2)}</output>
                  <input
                    aria-label="Pose sensitivity"
                    max={5}
                    min={0.1}
                    step={0.05}
                    type="range"
                    value={facePoseSensitivity}
                    onChange={event =>
                      setFacePoseSensitivity(Number(event.target.value))}
                  />
                </label>
                <label>
                  When the face is lost
                  <select
                    aria-label="Face lost behaviour"
                    value={faceLostMode}
                    onChange={event => setFaceLostMode(
                      event.target.value as MediaPipeFaceLostBehaviour,
                    )}
                  >
                    <option value="hold">Hold the last pose</option>
                    <option value="neutral">Return to neutral</option>
                  </select>
                </label>
                <label>
                  Mapping
                  <select
                    aria-label="Face mapping"
                    value={faceMapping}
                    onChange={event => setFaceMapping(
                      event.target.value as MediaPipeMappingMode,
                    )}
                  >
                    <option value="auto">Auto</option>
                    <option value="standard">Standard</option>
                    <option value="perfect-sync">Perfect Sync</option>
                  </select>
                </label>
                <label className="toggle">
                  <input
                    checked={facePreviewMirrored}
                    type="checkbox"
                    onChange={event => setFacePreviewMirrored(event.target.checked)}
                  />
                  Mirrored camera preview
                </label>
                {(['pose', 'eyes', 'brows', 'mouth', 'cheeks'] as const).map(channel => (
                  <label key={channel} className="toggle">
                    <input
                      checked={faceChannels[channel]}
                      type="checkbox"
                      onChange={event => setFaceChannels(current => ({
                        ...current,
                        [channel]: event.target.checked,
                      }))}
                    />
                    {channel}
                  </label>
                ))}
                {faceTrackingError && <p className="note">{faceTrackingError}</p>}
              </section>

              <button
                type="button"
                onClick={() => {
                  if (mounted)
                    stopFaceTracking()
                  if (mounted)
                    stopMic()
                  setMounted(value => !value)
                }}
              >
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

      <details ref={codeSampleRef} className="code-sample">
        <summary>Show the code behind this demo</summary>
        <pre>
          <HighlightedCode code={DEMO_CODE} />
        </pre>
      </details>

      <footer className="site-footer">
        <p>
          An unofficial library for Live2D, not affiliated with Live2D Inc.
          Live2D and Cubism are trademarks of Live2D Inc. Shipping an app built
          with it may need its own
          {' '}
          <a href="https://www.live2d.com/en/sdk/license/">Cubism SDK license</a>
          .
        </p>
      </footer>
    </main>
  )
}
