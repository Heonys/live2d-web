import type { FrameMetrics } from '../lab-types'

export function summarizeFrames(
  backend: FrameMetrics['backend'],
  frames: readonly number[],
  firstDrawMs: number | null,
  status: FrameMetrics['status'],
  error?: string,
): FrameMetrics {
  const sorted = frames.filter(value => value > 0).toSorted((left, right) => left - right)
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null
  return {
    backend,
    canvasCount: document.querySelectorAll('canvas').length,
    error,
    firstDrawMs,
    frameCount: frames.length,
    longFrameRatio: frames.length
      ? frames.filter(value => value > 33).length / frames.length
      : null,
    medianFps: median ? 1_000 / median : null,
    status,
  }
}

export function postMetrics(metrics: FrameMetrics) {
  document.documentElement.dataset.frameBackend = metrics.backend
  document.documentElement.dataset.frameStatus = metrics.status
  window.parent.postMessage({ metrics, type: 'live2d-lab-frame' }, window.location.origin)
}
