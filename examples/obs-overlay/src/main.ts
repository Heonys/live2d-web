import type { ModelFit } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import './style.css'

const query = new URLSearchParams(window.location.search)
const fit: ModelFit = query.get('fit') === 'full' ? 'full' : 'upper-body'
const src = query.get('model') ?? '/models/model.model3.json'

async function start() {
  const character = await createLive2D({
    container: document.querySelector<HTMLElement>('#overlay')!,
    coreUrl: '/live2dcubismcore.min.js',
    fit,
    src,
  })
  window.addEventListener('pagehide', () => character.dispose(), { once: true })
}

void start()
