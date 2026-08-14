import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
import './style.css'

interface AssetManifest {
  model3: string
}

const container = document.querySelector<HTMLElement>('#character')!
const status = document.querySelector<HTMLOutputElement>('#status')!
let character: Live2DInstance | null = null

async function start() {
  try {
    const response = await fetch('/assets/live2d/hiyori/manifest.json')
    if (!response.ok)
      throw new Error('Run `pnpm fetch-assets` before this fixture.')
    const manifest = await response.json() as AssetManifest
    character = await createLive2D({
      backend: pixiV6,
      container,
      coreUrl: '/assets/js/cubism/5.3/live2dcubismcore.min.js',
      quality: 'auto',
      src: manifest.model3,
    })
    status.value = 'ready'
  }
  catch (error) {
    status.value = `error: ${error instanceof Error ? error.message : String(error)}`
  }
}

document.querySelector('#motion')?.addEventListener('click', () => {
  void character?.motion('Tap@Body')
})
document.querySelector('#dispose')?.addEventListener('click', () => {
  character?.dispose()
  character = null
  status.value = 'disposed'
})
window.addEventListener('beforeunload', () => character?.dispose(), { once: true })

void start()
