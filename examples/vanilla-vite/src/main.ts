import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import './style.css'

const container = document.querySelector<HTMLElement>('#avatar')!
const status = document.querySelector<HTMLOutputElement>('#status')!
let character: Live2DInstance | undefined

async function start() {
  character = await createLive2D({
    container,
    coreUrl: '/live2dcubismcore.min.js',
    fit: 'upper-body',
    src: '/models/model.model3.json',
  })
  status.value = 'ready'
}

document.querySelector('#motion')?.addEventListener('click', () => {
  void character?.motion('TapBody', 0)
})
window.addEventListener('pagehide', () => character?.dispose(), { once: true })

void start().catch((error: unknown) => {
  status.value = error instanceof Error ? error.message : String(error)
})
