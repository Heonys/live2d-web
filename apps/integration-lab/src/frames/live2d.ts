import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import { CORE_URL, loadManifest } from '../constants'
import { postMetrics, summarizeFrames } from './metrics'
import '../style.css'

const root = document.querySelector<HTMLElement>('#frame-root')!
root.innerHTML = '<div class="comparison-canvas"></div><output class="frame-label">live2d-web · Core 5.3</output>'
const container = root.querySelector<HTMLElement>('.comparison-canvas')!
const frames: number[] = []
const startedAt = performance.now()
let previousFrame: number | undefined
let frame = 0
let instance: Live2DInstance | undefined
let firstDrawMs: number | null = null
let frameError: string | undefined
let frameStatus: 'error' | 'loading' | 'ready' = 'loading'

function sample(timestamp: number) {
  if (previousFrame !== undefined && frames.length < 3_600)
    frames.push(timestamp - previousFrame)
  previousFrame = timestamp
  frame = requestAnimationFrame(sample)
}
frame = requestAnimationFrame(sample)

function report() {
  postMetrics(summarizeFrames('live2d-web', frames, firstDrawMs, frameStatus, frameError))
}

const interval = window.setInterval(report, 1_000)
report()

void loadManifest().then(async (manifest) => {
  instance = await createLive2D({
    accessibility: { label: 'live2d-web backend comparison' },
    container,
    coreUrl: CORE_URL,
    fit: { offsetY: 0.02, scale: 0.72, units: 'stage' },
    idleMotion: false,
    maxFps: 60,
    resolution: 1,
    src: manifest.model3,
  })
  await new Promise(resolve => requestAnimationFrame(resolve))
  firstDrawMs = performance.now() - startedAt
  frameStatus = 'ready'
  report()
}).catch((error: unknown) => {
  frameError = error instanceof Error ? error.message : String(error)
  frameStatus = 'error'
  report()
})

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== 'live2d-lab-command')
    return
  if (event.data.command === 'motion')
    void instance?.motion('Tap@Body', 0)
})

window.addEventListener('pagehide', () => {
  clearInterval(interval)
  cancelAnimationFrame(frame)
  instance?.dispose()
})
