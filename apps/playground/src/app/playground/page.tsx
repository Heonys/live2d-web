'use client'

import type {
  ExpressionOptions,
  IdleMotion,
  ModelFit,
  ModelInfo,
  MotionOptions,
  VolumeLipSyncDriver,
} from 'live2d-web'
import type { Live2DDevtools } from 'live2d-web/devtools'
import type { Live2DModelController } from 'live2d-web/react'
import type {
  MediaPipeAttachOptions,
  MediaPipeFaceChannel,
  MediaPipeFaceLostBehaviour,
  MediaPipeFaceTracker,
  MediaPipeMappingMode,
  MediaPipeWorkerFaceTracker,
} from 'live2d-web/tracking/mediapipe'
import type { AssetManifest } from '../../lib/assetManifest'
import { createVolumeLipSync, Live2DError } from 'live2d-web'
import { mountLive2DDevtools } from 'live2d-web/devtools'
import {
  LipSync,
  Live2DCanvas,
  Live2DModel,
  useLive2DCanvas,
} from 'live2d-web/react'
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { StageLoading } from '../../components/StageLoading'
import { localizedDocPath } from '../../i18n/site'
import { useSiteLocale, useSiteMessages } from '../../i18n/SiteLocale'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../../lib/assetManifest'
import { SYNTHETIC_LIPSYNC_PROFILE } from '../../lib/syntheticLipSyncProfile'
import PlaygroundCode from './PlaygroundCode.mdx'

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

interface FaceStartupTiming {
  calibrationMs?: number
  cameraMs: number
  firstInferenceMs?: number
  resources: string[]
  totalTrackedMs?: number
  trackerMs?: number
}

type MotionFadePreset = '500' | 'instant' | 'model'
type IdlePreset = 'first' | 'uniform'
type FaceTracker = MediaPipeFaceTracker | MediaPipeWorkerFaceTracker
type FaceTrackingExecution = 'main' | 'worker'
type PlaygroundTab = 'audio' | 'code' | 'model' | 'tracking'

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

function trackingResourceTimings(startedAt: number) {
  return performance.getEntriesByType('resource')
    .filter((entry): entry is PerformanceResourceTiming => (
      entry instanceof PerformanceResourceTiming
      && entry.startTime >= startedAt
      && /mediapipe|face[_-]landmarker|\.wasm(?:$|\?)|\.task(?:$|\?)/i.test(entry.name)
    ))
    .map((entry) => {
      const pathname = new URL(entry.name, window.location.href).pathname
      const filename = pathname.split('/').pop() || pathname
      return `${filename} ${entry.duration.toFixed(0)}ms`
    })
}

/**
 * MediaPipe rejects a failed asset fetch with a DOM `error` Event, which
 * stringifies to `[object Event]` and carries neither the URL nor the status.
 * A tracking failure is almost always an asset that did not arrive, so keep
 * whatever the library did manage to attach.
 */
function describeTrackingFailure(error: unknown) {
  if (error instanceof Live2DError) {
    const url = error.details && 'url' in error.details
      ? String((error.details as { url?: unknown }).url ?? '')
      : ''
    return { code: error.code, message: error.message, url: url || undefined }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

function formatFaceStartupTiming(timing: FaceStartupTiming) {
  return [
    `camera ${timing.cameraMs.toFixed(0)}ms`,
    `tracker ${timing.trackerMs?.toFixed(0) ?? '…'}ms`,
    `first inference ${timing.firstInferenceMs?.toFixed(0) ?? '…'}ms`,
    `calibration ${timing.calibrationMs?.toFixed(0) ?? '…'}ms`,
    `tracked ${timing.totalTrackedMs?.toFixed(0) ?? '…'}ms`,
  ].join(' · ')
}

function RuntimeDevtools({ target }: { target: Live2DModelController | null }) {
  const messages = useSiteMessages().playground
  const containerRef = useRef<HTMLDivElement>(null)
  const devtoolsRef = useRef<Live2DDevtools | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !target)
      return
    const devtools = mountLive2DDevtools({ container, target })
    devtoolsRef.current = devtools
    return () => {
      devtools.dispose()
      if (devtoolsRef.current === devtools)
        devtoolsRef.current = null
    }
  }, [target])

  return (
    <div className="runtime-devtools-host" ref={containerRef}>
      {!target && (
        <div className="runtime-devtools-pending" role="status">
          <div className="runtime-devtools-pending-heading">
            <span aria-hidden="true" className="runtime-devtools-pending-dot" />
            <strong>Live2D Devtools</strong>
          </div>
          <p>{messages.modelControlsPending}</p>
        </div>
      )}
    </div>
  )
}

function CodeDrawer({
  close,
  open,
  returnFocusRef,
}: {
  close: () => void
  open: boolean
  returnFocusRef: { readonly current: HTMLElement | null }
}) {
  const messages = useSiteMessages()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open)
      return
    const dialog = dialogRef.current
    const returnFocus = returnFocusRef.current
    dialog?.querySelector<HTMLElement>('button')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !dialog)
        return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0)
        return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.classList.add('drawer-open')
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('drawer-open')
      document.removeEventListener('keydown', handleKeyDown)
      if (returnFocus?.isConnected)
        returnFocus.focus()
    }
  }, [close, open, returnFocusRef])

  if (!open)
    return null
  return (
    <div className="code-drawer-backdrop" role="presentation" onClick={close}>
      <div
        ref={dialogRef}
        aria-label={messages.playground.codeDialog}
        aria-modal="true"
        className="code-drawer"
        role="dialog"
        onClick={event => event.stopPropagation()}
      >
        <div className="code-drawer-header">
          <div>
            <span>React</span>
            <strong>{messages.playground.buildScene}</strong>
          </div>
          <button type="button" onClick={close}>{messages.common.close}</button>
        </div>
        <div className="code-drawer-code">
          <PlaygroundCode />
        </div>
      </div>
    </div>
  )
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
  const messages = useSiteMessages().playground
  if (stage.status !== 'ready')
    return null
  return (
    <p className="stage-hint">
      <span className="stage-hint-desktop">{messages.followHintDesktop}</span>
      <span className="stage-hint-mobile">{messages.followHintMobile}</span>
    </p>
  )
}

function stageErrorHint(error: Live2DError, locale: ReturnType<typeof useSiteLocale>) {
  const hints = {
    en: {
      core: 'Cubism Core could not load. Check the Core URL, CSP and network request.',
      cors: 'The browser could not read a model file. Check CORS and the Network panel.',
      generic: 'A model asset could not load. Check the URL, HTTP status and asset type.',
      other: 'Open the troubleshooting guide for checks and retry guidance.',
      parse: 'A model file was fetched but could not be parsed. Check the export and Cubism version.',
      status404: 'A model file returned 404. Check the model URL, referenced paths and filename case.',
    },
    ja: {
      core: 'Cubism Core を読み込めません。Core URL、CSP、ネットワーク要求を確認してください。',
      cors: 'ブラウザがモデルファイルを読み込めません。CORS と Network パネルを確認してください。',
      generic: 'モデルアセットを読み込めません。URL、HTTP ステータス、アセット種別を確認してください。',
      other: '確認方法と再試行手順はトラブルシューティングを参照してください。',
      parse: 'モデルファイルは取得できましたが解析できません。モデルの書き出し設定と Cubism バージョンを確認してください。',
      status404: 'モデルファイルが 404 を返しました。モデル URL、参照パス、ファイル名の大文字・小文字を確認してください。',
    },
    ko: {
      core: 'Cubism Core를 로드하지 못했습니다. Core URL·CSP·네트워크 요청을 확인하세요.',
      cors: '브라우저가 모델 파일을 읽지 못했습니다. CORS와 Network 패널을 확인하세요.',
      generic: '모델 자산을 로드하지 못했습니다. URL·HTTP 상태·자산 유형을 확인하세요.',
      other: '확인 방법과 재시도 안내는 문제 해결 가이드를 참고하세요.',
      parse: '모델 파일은 받았지만 해석하지 못했습니다. 모델 내보내기 설정과 Cubism 버전을 확인하세요.',
      status404: '모델 파일이 404를 반환했습니다. 모델 URL·참조 경로·파일명 대소문자를 확인하세요.',
    },
  }[locale]
  if (error.code === 'core-missing')
    return hints.core
  if (error.code !== 'model-load-failed')
    return hints.other
  if (error.details?.httpStatus === 404 || /\b404\b/.test(error.message))
    return hints.status404
  if (/cors|failed to fetch|networkerror/i.test(error.message))
    return hints.cors
  if (/parse|json|moc|invalid|corrupt/i.test(error.message))
    return hints.parse
  return hints.generic
}

function StageError({ error, retry }: {
  error: Live2DError
  retry: () => void
}) {
  const locale = useSiteLocale()
  const messages = useSiteMessages()
  return (
    <div className="stage-overlay error-panel" role="alert">
      <strong>{error.code}</strong>
      <p>{error.message}</p>
      <p>{stageErrorHint(error, locale)}</p>
      <a href={`${localizedDocPath(locale, 'troubleshooting')}#${error.code}`}>
        {messages.playground.openTroubleshooting}
      </a>
      <button type="button" onClick={retry}>{messages.common.retryCanvas}</button>
    </div>
  )
}

export default function PlaygroundPage() {
  // The runtime injects the Core script only after hydration, so the preload
  // scanner never sees it. This starts the 223KB download during HTML parse.
  preload(CUBISM_CORE_URL, { as: 'script' })
  const locale = useSiteLocale()
  const messages = useSiteMessages()
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
  const [activeTab, setActiveTab] = useState<PlaygroundTab>('model')
  const [codeDrawerOpen, setCodeDrawerOpen] = useState(false)
  const codeDrawerTriggerRef = useRef<HTMLButtonElement>(null)
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
  const [faceTrackingError, setFaceTrackingError] = useState<{
    code?: string
    message: string
    url?: string
  } | null>(null)
  const [faceTrackingStatus, setFaceTrackingStatus] = useState('idle')
  const [faceInferenceMs, setFaceInferenceMs] = useState(0)
  const [faceRoundTripMs, setFaceRoundTripMs] = useState(0)
  const [faceEffectiveFps, setFaceEffectiveFps] = useState(0)
  const [faceSkippedRatio, setFaceSkippedRatio] = useState(0)
  const [faceStartupTiming, setFaceStartupTiming] = useState<FaceStartupTiming | null>(null)
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
    setFaceTrackingError(null)
    setFaceTrackingStatus('initializing')
    setFaceStartupTiming(null)
    resetFacePeak()
    const startupStartedAt = performance.now()
    const generation = ++faceGenerationRef.current
    let stream: MediaStream | undefined
    let tracker: FaceTracker | undefined
    try {
      if (!controller)
        throw new Error(messages.playground.waitModelReady)
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
        throw new Error(messages.playground.cameraUnavailable)
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
      const cameraReadyAt = performance.now()
      if (generation !== faceGenerationRef.current) {
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      setFaceStartupTiming({
        cameraMs: cameraReadyAt - startupStartedAt,
        resources: [],
      })
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
              new URL('../../workers/face-tracking.worker.ts', import.meta.url),
              { type: 'module' },
            ),
          })
        : await createMediaPipeFaceTracker(sharedOptions)
      const trackerReadyAt = performance.now()
      tracker = createdTracker
      if (generation !== faceGenerationRef.current) {
        createdTracker.dispose()
        for (const track of stream.getTracks())
          track.stop()
        return
      }
      setFaceStartupTiming({
        cameraMs: cameraReadyAt - startupStartedAt,
        resources: trackingResourceTimings(startupStartedAt),
        trackerMs: trackerReadyAt - cameraReadyAt,
      })
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
      let firstInferenceAt: number | undefined
      let trackedAt: number | undefined
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
            if (faceTrackingRef.current !== tracking)
              return
            const roundTripMs = Math.max(0, performance.now() - roundTripStartedAt)
            if (update.status !== 'skipped') {
              const updatedAt = performance.now()
              const recordingFirstInference = firstInferenceAt === undefined
              const recordingTracked = update.status === 'tracked' && trackedAt === undefined
              firstInferenceAt ??= updatedAt
              if (update.status === 'tracked')
                trackedAt ??= updatedAt
              if (recordingFirstInference || recordingTracked) {
                setFaceStartupTiming({
                  calibrationMs: trackedAt === undefined
                    ? undefined
                    : trackedAt - firstInferenceAt,
                  cameraMs: cameraReadyAt - startupStartedAt,
                  firstInferenceMs: firstInferenceAt - trackerReadyAt,
                  resources: trackingResourceTimings(startupStartedAt),
                  totalTrackedMs: trackedAt === undefined
                    ? undefined
                    : trackedAt - startupStartedAt,
                  trackerMs: trackerReadyAt - cameraReadyAt,
                })
              }
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
            setFaceTrackingError(describeTrackingFailure(error))
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
        setFaceTrackingError(describeTrackingFailure(error))
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
    messages.playground.cameraUnavailable,
    messages.playground.waitModelReady,
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
        setFaceTrackingError(describeTrackingFailure(error))
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
          accessibility={{
            describedBy: 'playground-stage-description',
            label: messages.playground.modelPreview,
          }}
          coreUrl={CUBISM_CORE_URL}
          {...(fixedQuality ? { resolution: 1 } : { quality: 'auto' as const })}
          fallback={() => <StageLoading />}
          errorFallback={(error, retry) => (
            <StageError error={error} retry={retry} />
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
            <strong>{messages.playground.assetsUnavailable}</strong>
            <p>{assetError}</p>
          </div>
        )
      : mounted
        ? <StageLoading />
        : <div className="empty-stage">{messages.playground.canvasUnmounted}</div>

  return (
    <>
      <main className="playground-page" lang={locale}>
        <div className="playground-intro">
          <div>
            <p className="eyebrow">{messages.playground.eyebrow}</p>
            <h1>{messages.playground.title}</h1>
          </div>
          <p id="playground-stage-description">
            {messages.playground.description}
          </p>
        </div>

        <section className="playground-workspace">
          <div className="stage-shell">
            {stage}
          </div>

          <aside className="playground-panel">
            <div aria-label={messages.playground.tabs} className="playground-tabs" role="tablist">
              {(['model', 'audio', 'tracking', 'code'] as const).map(tab => (
                <button
                  key={tab}
                  aria-controls={`playground-panel-${tab}`}
                  aria-selected={activeTab === tab}
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab(tab)}
                >
                  {messages.playground[tab]}
                </button>
              ))}
            </div>

            <div className="playground-panel-scroll">
              <section
                hidden={activeTab !== 'model'}
                id="playground-panel-model"
                role="tabpanel"
              >
                <div className="playground-fieldset">
                  <strong>{messages.playground.demoPresets}</strong>
                  <label>
                    {messages.playground.motion}
                    <select
                      aria-label={messages.playground.motion}
                      disabled={!motionOptions.length}
                      value={motionValue}
                      onChange={event => setMotionValue(event.target.value)}
                    >
                      {!motionOptions.length && <option value="">{messages.playground.noMotions}</option>}
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
                  <label>
                    {messages.playground.motionFade}
                    <select
                      aria-label={messages.playground.motionFade}
                      value={motionFadePreset}
                      onChange={event => setMotionFadePreset(event.target.value as MotionFadePreset)}
                    >
                      <option value="model">{messages.common.modelDefault}</option>
                      <option value="instant">{messages.playground.instant}</option>
                      <option value="500">500 ms</option>
                    </select>
                  </label>
                  <div className="playground-actions">
                    <button
                      type="button"
                      disabled={!controller || !motionValue || playingMotion !== null}
                      onClick={playMotion}
                    >
                      {playingMotion ? messages.playground.playing : messages.playground.playMotion}
                    </button>
                    <button
                      type="button"
                      disabled={!controller || motionOptions.length === 0 || playingMotion !== null}
                      onClick={playSequence}
                    >
                      {messages.playground.playSequence}
                    </button>
                  </div>
                  {playingMotion && (
                    <output className="note" data-testid="playing-motion">
                      {messages.playground.playing}
                      {' '}
                      {playingMotion}
                    </output>
                  )}
                  {motionResult && (
                    <output className="note" data-testid="motion-result">
                      {messages.playground.result}
                      :
                      {' '}
                      {motionResult}
                    </output>
                  )}
                  <label>
                    {messages.playground.framing}
                    <select
                      value={typeof fit === 'string' ? fit : 'upper-body'}
                      onChange={event => setFit(event.target.value as 'upper-body' | 'full')}
                    >
                      <option value="upper-body">{messages.common.upperBody}</option>
                      <option value="full">{messages.common.fullModel}</option>
                    </select>
                  </label>
                  <label>
                    {messages.playground.idleSelection}
                    <select
                      aria-label={messages.playground.idleSelection}
                      value={idlePreset}
                      onChange={event => setIdlePreset(event.target.value as IdlePreset)}
                    >
                      <option value="uniform">{messages.playground.uniform}</option>
                      <option value="first">{messages.playground.firstOnly}</option>
                    </select>
                  </label>
                  {modelInfo?.expressions.length
                    ? (
                        <>
                          <label>
                            {messages.playground.expression}
                            <select
                              aria-label={messages.playground.expression}
                              value={expression}
                              onChange={event => setExpression(event.target.value)}
                            >
                              {modelInfo.expressions.map(id => (
                                <option key={id} value={id}>{id}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {messages.playground.expressionFade}
                            <select
                              aria-label={messages.playground.expressionFade}
                              value={expressionFadePreset}
                              onChange={event => setExpressionFadePreset(
                                event.target.value as MotionFadePreset,
                              )}
                            >
                              <option value="model">{messages.common.modelDefault}</option>
                              <option value="instant">{messages.playground.instant}</option>
                              <option value="500">500 ms</option>
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
                            {messages.playground.applyExpression}
                          </button>
                        </>
                      )
                    : modelInfo && (
                      <p className="note">
                        {messages.playground.modelNoExpressions}
                      </p>
                    )}
                  <label className="toggle">
                    <input
                      checked={fixedQuality}
                      type="checkbox"
                      onChange={event => setFixedQuality(event.target.checked)}
                    />
                    {messages.playground.fixedResolution}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (mounted) {
                        stopFaceTracking()
                        stopMic()
                      }
                      setMounted(value => !value)
                    }}
                  >
                    {mounted
                      ? messages.playground.unmountCanvas
                      : messages.playground.canvasMounted}
                  </button>
                </div>
                <RuntimeDevtools target={controller} />
              </section>

              <section
                hidden={activeTab !== 'audio'}
                id="playground-panel-audio"
                role="tabpanel"
              >
                <div className="panel-heading">
                  <span>{messages.playground.audio}</span>
                  <h2>{messages.playground.lipSyncInputs}</h2>
                  <p>{messages.playground.audioDescription}</p>
                </div>
                <label>
                  {messages.playground.lipSyncMode}
                  <select
                    aria-label={messages.playground.lipSyncMode}
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
                    <option value="demo">{messages.playground.demoMode}</option>
                    <option value="source">{messages.playground.sourceMode}</option>
                  </select>
                </label>
                {lipSyncMode === 'demo' && (
                  <>
                    <label>
                      {messages.playground.mouthOpen}
                      <output>{mouthOpen.toFixed(2)}</output>
                      <input
                        aria-label={messages.playground.mouthOpen}
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
                      {micActive
                        ? messages.playground.stopMicrophone
                        : messages.playground.useMicrophone}
                    </button>
                    {micError && <p className="note">{micError}</p>}
                  </>
                )}
                {lipSyncMode === 'source' && (
                  <>
                    <button
                      type="button"
                      onClick={() => sourceActive
                        ? stopSourceSignal()
                        : void startSourceSignal()}
                    >
                      {sourceActive
                        ? messages.playground.stopSignal
                        : messages.playground.startSignal}
                    </button>
                    <output data-testid="lipsync-status">
                      {lipSyncError || (sourceActive
                        ? messages.playground.sourceActive
                        : messages.playground.sourceIdle)}
                    </output>
                  </>
                )}
              </section>

              <section
                className="tracking-tools"
                hidden={activeTab !== 'tracking'}
                id="playground-panel-tracking"
                role="tabpanel"
              >
                <div className="panel-heading">
                  <span>{messages.playground.tracking}</span>
                  <h2>{messages.playground.faceTracking}</h2>
                  <p>{messages.playground.cameraPanel}</p>
                </div>
                <video
                  ref={faceVideoRef}
                  className={faceTrackingActive ? undefined : 'tracking-preview-pending'}
                  muted
                  playsInline
                  data-testid="face-preview"
                  style={{ transform: facePreviewMirrored ? 'scaleX(-1)' : undefined }}
                />
                <output data-testid="face-tracking-status">
                  {faceTrackingStatus}
                  {faceTrackingActive && ` · inference ${faceInferenceMs.toFixed(1)} ms · round trip ${faceRoundTripMs.toFixed(1)} ms · ${faceEffectiveFps.toFixed(0)} fps · ${(faceSkippedRatio * 100).toFixed(0)}% skipped`}
                </output>
                {faceTrackingError && (
                  <p className="tracking-error" data-testid="tracking-failure" role="alert">
                    {faceTrackingError.code && <strong>{faceTrackingError.code}</strong>}
                    {faceTrackingError.message}
                    {faceTrackingError.url && <span className="note">{faceTrackingError.url}</span>}
                  </p>
                )}
                {faceStartupTiming && (
                  <output className="note" data-testid="face-startup-timing">
                    {formatFaceStartupTiming(faceStartupTiming)}
                    {faceStartupTiming.resources.length > 0 && (
                      ` · ${faceStartupTiming.resources.join(', ')}`
                    )}
                  </output>
                )}
                {faceTrackingActive && (
                  <table className="pose-readout" data-testid="face-pose-readout">
                    <thead>
                      <tr>
                        <th>{messages.playground.headAngle}</th>
                        <th>{messages.playground.now}</th>
                        <th>{messages.playground.peak}</th>
                        <th>{messages.playground.body}</th>
                        <th>{messages.playground.range}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        [messages.playground.xTurn, facePose.x, facePeak.x, faceBody.x],
                        [messages.playground.yNod, facePose.y, facePeak.y, faceBody.y],
                        [messages.playground.zTilt, facePose.z, facePeak.z, faceBody.z],
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
                  {faceTrackingActive
                    ? messages.playground.stopFace
                    : messages.playground.startFace}
                </button>
                <button
                  type="button"
                  disabled={!faceTrackingActive}
                  onClick={() => {
                    faceTrackingRef.current?.tracker.calibrate()
                    resetFacePeak()
                  }}
                >
                  {messages.playground.recalibrate}
                </button>
                <label>
                  {messages.playground.execution}
                  <select
                    aria-label={messages.playground.faceExecution}
                    disabled={faceTrackingActive}
                    value={faceExecution}
                    onChange={event => setFaceExecution(
                      event.target.value as FaceTrackingExecution,
                    )}
                  >
                    <option value="worker">{messages.playground.worker}</option>
                    <option value="main">{messages.playground.mainThread}</option>
                  </select>
                </label>
                <label>
                  {messages.playground.poseSensitivity}
                  <output>{facePoseSensitivity.toFixed(2)}</output>
                  <input
                    aria-label={messages.playground.poseSensitivity}
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
                  {messages.playground.faceLost}
                  <select
                    aria-label={messages.playground.faceLostBehaviour}
                    value={faceLostMode}
                    onChange={event => setFaceLostMode(
                      event.target.value as MediaPipeFaceLostBehaviour,
                    )}
                  >
                    <option value="hold">{messages.playground.holdLastPose}</option>
                    <option value="neutral">{messages.playground.returnNeutral}</option>
                  </select>
                </label>
                <label>
                  {messages.playground.mapping}
                  <select
                    aria-label={messages.playground.faceMapping}
                    value={faceMapping}
                    onChange={event => setFaceMapping(
                      event.target.value as MediaPipeMappingMode,
                    )}
                  >
                    <option value="auto">{messages.common.auto}</option>
                    <option value="standard">{messages.inspector.standard}</option>
                    <option value="perfect-sync">{messages.playground.perfectSync}</option>
                  </select>
                </label>
                <label className="toggle">
                  <input
                    checked={facePreviewMirrored}
                    type="checkbox"
                    onChange={event => setFacePreviewMirrored(event.target.checked)}
                  />
                  {messages.playground.mirroredPreview}
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
                    {messages.playground[channel]}
                  </label>
                ))}
              </section>

              <section
                hidden={activeTab !== 'code'}
                id="playground-panel-code"
                role="tabpanel"
              >
                <div className="panel-heading">
                  <span>{messages.playground.code}</span>
                  <h2>{messages.playground.buildScene}</h2>
                  <p>{messages.playground.codeDescription}</p>
                </div>
                <button
                  ref={codeDrawerTriggerRef}
                  type="button"
                  onClick={() => setCodeDrawerOpen(true)}
                >
                  {messages.playground.viewCode}
                </button>
              </section>
            </div>
          </aside>
        </section>
      </main>
      <CodeDrawer
        close={() => setCodeDrawerOpen(false)}
        open={codeDrawerOpen}
        returnFocusRef={codeDrawerTriggerRef}
      />
    </>
  )
}
