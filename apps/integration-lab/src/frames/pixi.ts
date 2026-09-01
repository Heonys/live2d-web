import { Application } from '@pixi/app'
import { BatchRenderer } from '@pixi/core'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { loadManifest, PIXI_CORE_URL } from '../constants'
import { postMetrics, summarizeFrames } from './metrics'
import '../style.css'

const root = document.querySelector<HTMLElement>('#frame-root')!
root.innerHTML = '<div class="comparison-canvas"></div><output class="frame-label">pixi-live2d-display · Core 5.2</output>'
const container = root.querySelector<HTMLElement>('.comparison-canvas')!
const frames: number[] = []
const startedAt = performance.now()
let firstDrawMs: number | null = null
let app: Application | undefined
let model: import('pixi-live2d-display/cubism4').Live2DModel | undefined
let updateModel: (() => void) | undefined
let frameError: string | undefined
let frameStatus: 'error' | 'loading' | 'ready' = 'loading'

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.append(script)
  })
}

function report() {
  postMetrics(summarizeFrames('pixi-v6', frames, firstDrawMs, frameStatus, frameError))
}

const interval = window.setInterval(report, 1_000)
report()

void Promise.all([loadScript(PIXI_CORE_URL), loadManifest()]).then(async ([, manifest]) => {
  extensions.add(TickerPlugin, BatchRenderer)
  app = new Application({
    backgroundAlpha: 0,
    height: Math.max(1, container.clientHeight),
    resolution: 1,
    width: Math.max(1, container.clientWidth),
  })
  container.appendChild(app.view as HTMLCanvasElement)
  const module = await import('pixi-live2d-display/cubism4')
  module.Live2DModel.registerTicker(Ticker)
  model = new module.Live2DModel()
  await module.Live2DFactory.setupLive2DModel(model, new URL(manifest.model3, window.location.href).href, {
    autoInteract: false,
    autoUpdate: false,
  })
  model.anchor.set(0.5, 0.5)
  const modelWidth = model.width
  const modelHeight = model.height
  const place = () => {
    if (!app || !model)
      return
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    app.renderer.resize(width, height)
    const scale = Math.min(width / modelWidth * 1.45, height / modelHeight * 1.45)
    model.scale.set(scale)
    model.position.set(width / 2, height)
  }
  place()
  app.stage.addChild(model)
  updateModel = () => {
    if (!app || !model)
      return
    frames.push(app.ticker.deltaMS)
    if (frames.length > 3_600)
      frames.shift()
    model.update(app.ticker.deltaMS)
  }
  app.ticker.add(updateModel)
  const observer = new ResizeObserver(place)
  observer.observe(container)
  await new Promise(resolve => requestAnimationFrame(resolve))
  firstDrawMs = performance.now() - startedAt
  frameStatus = 'ready'
  report()
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true })
}).catch((error: unknown) => {
  frameError = error instanceof Error ? error.message : String(error)
  frameStatus = 'error'
  report()
})

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== 'live2d-lab-command')
    return
  if (event.data.command === 'motion')
    void model?.motion('Tap@Body', 0, 3)
})

window.addEventListener('pagehide', () => {
  clearInterval(interval)
  if (app && updateModel)
    app.ticker.remove(updateModel)
  app?.destroy(true, { children: true })
})
