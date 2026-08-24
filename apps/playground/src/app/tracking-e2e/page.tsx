'use client'

import type {
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
} from 'live2d-web/tracking/mediapipe'
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'
import { useCallback, useEffect, useRef, useState } from 'react'

const WASM_PATH = '/assets/mediapipe/wasm'
const MODEL_PATH = '/assets/mediapipe/face_landmarker.task'
const PORTRAIT_PATH = '/assets/mediapipe/portrait.jpg'

interface TrackingMetrics {
  baselineFrameP95: number
  inferenceP50: number
  inferenceP95: number
  trackingFrameOver33Ratio: number
  trackingFrameP95: number
}

function percentile(values: readonly number[], ratio: number) {
  if (!values.length)
    return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function collectFrameDeltas(count: number) {
  return new Promise<number[]>((resolve) => {
    const values: number[] = []
    let previous: number | undefined
    const sample = (timestamp: number) => {
      if (previous !== undefined)
        values.push(timestamp - previous)
      previous = timestamp
      if (values.length >= count)
        resolve(values)
      else
        requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

export default function TrackingE2EPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const generationRef = useRef(0)
  const trackerRef = useRef<MediaPipeFaceTracker | null>(null)
  const [error, setError] = useState('')
  const [inferenceMs, setInferenceMs] = useState(0)
  const [metrics, setMetrics] = useState<TrackingMetrics | null>(null)
  const [status, setStatus] = useState('idle')

  const stop = useCallback(() => {
    generationRef.current++
    cancelAnimationFrame(frameRef.current)
    frameRef.current = 0
    trackerRef.current?.dispose()
    trackerRef.current = null
    setStatus('disposed')
  }, [])

  const start = useCallback(async () => {
    stop()
    setError('')
    setMetrics(null)
    setStatus('initializing')
    const generation = ++generationRef.current
    const canvas = canvasRef.current
    if (!canvas)
      return
    try {
      const image = new Image()
      image.src = PORTRAIT_PATH
      await image.decode()
      if (generation !== generationRef.current)
        return
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d')?.drawImage(image, 0, 0)
      const baselineFrames = await collectFrameDeltas(60)
      if (generation !== generationRef.current)
        return
      const tracker = await createMediaPipeFaceTracker({
        modelAssetPath: MODEL_PATH,
        wasmPath: WASM_PATH,
      })
      if (generation !== generationRef.current) {
        tracker.dispose()
        return
      }
      trackerRef.current = tracker
      const inferenceSamples: number[] = []
      const trackingFrames: number[] = []
      let previousFrame: number | undefined
      let metricsRecorded = false
      const keepRunning = new URLSearchParams(window.location.search).has('soak')
      const sample = (timestamp: number) => {
        if (generation !== generationRef.current || trackerRef.current !== tracker)
          return
        const update = tracker.update(canvas, timestamp)
        if (previousFrame !== undefined)
          trackingFrames.push(timestamp - previousFrame)
        previousFrame = timestamp
        if (update.status !== 'skipped') {
          setStatus(update.status)
          setInferenceMs(update.inferenceMs)
          if (update.status === 'tracked')
            inferenceSamples.push(update.inferenceMs)
        }
        if (inferenceSamples.length >= 60 && !metricsRecorded) {
          metricsRecorded = true
          const measured = {
            baselineFrameP95: percentile(baselineFrames, 0.95),
            inferenceP50: percentile(inferenceSamples, 0.5),
            inferenceP95: percentile(inferenceSamples, 0.95),
            trackingFrameOver33Ratio: trackingFrames.filter(value => value > 33).length
              / Math.max(1, trackingFrames.length),
            trackingFrameP95: percentile(trackingFrames, 0.95),
          }
          queueMicrotask(() => {
            if (generation === generationRef.current)
              setMetrics(measured)
          })
        }
        if (!metricsRecorded || keepRunning)
          frameRef.current = requestAnimationFrame(sample)
      }
      frameRef.current = requestAnimationFrame(sample)
    }
    catch (cause) {
      if (generation === generationRef.current) {
        setError(cause instanceof Error ? cause.message : String(cause))
        setStatus('error')
      }
    }
  }, [stop])

  const detectBlank = useCallback(() => {
    const tracker = trackerRef.current
    const canvas = canvasRef.current
    if (!tracker || !canvas)
      return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    const sample = (timestamp: number) => {
      const update: MediaPipeFaceTrackingUpdate = tracker.update(canvas, timestamp)
      if (update.status === 'skipped') {
        frameRef.current = requestAnimationFrame(sample)
        return
      }
      setStatus(update.status)
      setInferenceMs(update.inferenceMs)
    }
    frameRef.current = requestAnimationFrame(sample)
  }, [])

  useEffect(() => {
    void start()
    return stop
  }, [start, stop])

  return (
    <main>
      <h1>MediaPipe tracking verification</h1>
      <canvas ref={canvasRef} data-testid="tracking-input" />
      <output data-testid="tracking-status">{status}</output>
      <output data-testid="tracking-inference">{inferenceMs.toFixed(2)}</output>
      <output data-testid="tracking-metrics">{metrics ? JSON.stringify(metrics) : ''}</output>
      {error && <output data-testid="tracking-error">{error}</output>}
      <button type="button" onClick={() => void start()}>Restart</button>
      <button type="button" onClick={detectBlank}>Detect blank frame</button>
      <button type="button" onClick={stop}>Dispose</button>
    </main>
  )
}
