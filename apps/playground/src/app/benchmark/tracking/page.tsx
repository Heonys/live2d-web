'use client'

import type { Live2DInstance } from 'live2d-web'
import type {
  MediaPipeFaceTracker,
  MediaPipeWorkerFaceTracker,
} from 'live2d-web/tracking/mediapipe'
import { createLive2D } from 'live2d-web'
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'
import { useEffect, useRef, useState } from 'react'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const MODEL_URL = '/assets/live2d/hiyori/hiyori_free/runtime/hiyori_free_t08.model3.json'
const WASM_PATH = '/assets/mediapipe/wasm'
const TRACKING_MODEL_PATH = '/assets/mediapipe/face_landmarker.task'
const PORTRAIT_PATH = '/assets/mediapipe/portrait.jpg'

type FaceTracker = MediaPipeFaceTracker | MediaPipeWorkerFaceTracker

function percentile(values: readonly number[], ratio: number) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0
}

export default function TrackingBenchmarkPage() {
  const inputRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [status, setStatus] = useState('initializing')

  useEffect(() => {
    let active = true
    let frame = 0
    let character: Live2DInstance | undefined
    let tracker: FaceTracker | undefined
    let detach: (() => void) | undefined
    const run = async () => {
      const input = inputRef.current
      const host = modelRef.current
      if (!input || !host)
        return
      const image = new Image()
      image.src = PORTRAIT_PATH
      await image.decode()
      input.width = image.naturalWidth
      input.height = image.naturalHeight
      input.getContext('2d')?.drawImage(image, 0, 0)
      character = await createLive2D({
        container: host,
        coreUrl: CORE_URL,
        fit: 'upper-body',
        idleMotion: 'Idle',
        pauseWhenOffscreen: false,
        src: MODEL_URL,
      })
      const execution = new URLSearchParams(window.location.search).get('execution')
      const trackerCreateStartedAt = performance.now()
      tracker = execution === 'worker'
        ? await createMediaPipeFaceTracker({
            execution: 'worker',
            modelAssetPath: TRACKING_MODEL_PATH,
            wasmPath: WASM_PATH,
            workerFactory: () => new Worker(
              new URL('../../../workers/face-tracking.worker.ts', import.meta.url),
              { type: 'module' },
            ),
          })
        : await createMediaPipeFaceTracker({
            modelAssetPath: TRACKING_MODEL_PATH,
            wasmPath: WASM_PATH,
          })
      const trackerCreateMs = performance.now() - trackerCreateStartedAt
      detach = tracker.attach(character)
      const frameDeltas: number[] = []
      const inference: number[] = []
      const roundTrips: number[] = []
      let previousFrame: number | undefined
      let skipped = 0
      let attempted = 0
      let effectiveFps = 0
      let finished = false
      const sample = (timestamp: number) => {
        if (!active || !tracker)
          return
        if (previousFrame !== undefined)
          frameDeltas.push(timestamp - previousFrame)
        previousFrame = timestamp
        frame = requestAnimationFrame(sample)
        attempted++
        const startedAt = performance.now()
        void Promise.resolve(tracker.update(input, timestamp)).then((update) => {
          if (finished || !active)
            return
          const roundTrip = Math.max(0, performance.now() - startedAt)
          if (update.status === 'skipped') {
            skipped++
          }
          else {
            effectiveFps = update.effectiveFps
            if (update.status === 'tracked') {
              inference.push(update.inferenceMs)
              roundTrips.push(roundTrip)
            }
          }
          if (inference.length >= 60) {
            finished = true
            cancelAnimationFrame(frame)
            const values = [
              character?.getParameter('ParamAngleX') ?? Number.NaN,
              character?.getParameter('ParamEyeLOpen') ?? Number.NaN,
              character?.getParameter('ParamMouthOpenY') ?? Number.NaN,
            ]
            const measured = {
              canvasCount: host.querySelectorAll('canvas').length,
              effectiveFps,
              finiteParameters: values.every(Number.isFinite),
              frameOver33Ratio: frameDeltas.filter(value => value > 33).length
                / Math.max(1, frameDeltas.length),
              frameP95: percentile(frameDeltas, 0.95),
              inferenceP50: percentile(inference, 0.5),
              inferenceP95: percentile(inference, 0.95),
              roundTripP95: percentile(roundTrips, 0.95),
              skippedRatio: skipped / Math.max(1, attempted),
              trackerCreateMs,
            }
            setResult(JSON.stringify(measured))
            setStatus('ready')
          }
        }).catch((cause) => {
          if (!finished && active) {
            finished = true
            cancelAnimationFrame(frame)
            setError(cause instanceof Error ? cause.message : String(cause))
            setStatus('error')
          }
        })
      }
      frame = requestAnimationFrame(sample)
    }
    void run().catch((cause) => {
      if (!active)
        return
      setError(cause instanceof Error ? cause.message : String(cause))
      setStatus('error')
    })
    return () => {
      active = false
      cancelAnimationFrame(frame)
      detach?.()
      tracker?.dispose()
      character?.dispose()
    }
  }, [])

  return (
    <main>
      <h1>MediaPipe + Hiyori tracking benchmark</h1>
      <div ref={modelRef} style={{ height: 640, width: 480 }} />
      <canvas ref={inputRef} hidden />
      <output data-testid="tracking-benchmark-status">{status}</output>
      <output data-testid="tracking-benchmark-result">{result}</output>
      {error && <output data-testid="tracking-benchmark-error">{error}</output>}
    </main>
  )
}
