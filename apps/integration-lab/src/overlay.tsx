import type { Live2DModelController } from 'live2d-web/react'
import { Live2DCanvas, Live2DModel } from 'live2d-web/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CORE_URL } from './constants'
import { useManifest } from './useManifest'
import './style.css'

function finite(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function Overlay() {
  const { error, manifest, retry } = useManifest()
  const query = new URLSearchParams(window.location.search)
  const fit = {
    offsetX: finite(query.get('x'), 0),
    offsetY: finite(query.get('y'), 0.05),
    scale: Math.max(0.05, finite(query.get('scale'), 0.82)),
    units: 'stage' as const,
  }
  const motion = query.get('motion')
  const onLoad = (controller: Live2DModelController) => {
    if (motion)
      void controller.motion(motion, Math.max(0, Math.floor(finite(query.get('index'), 0))))
  }

  if (error && !manifest) {
    return (
      <div className="overlay-error" role="alert">
        <span>{error}</span>
        <button type="button" onClick={retry}>Retry</button>
      </div>
    )
  }
  return (
    <main className="obs-overlay" data-testid="obs-overlay">
      {manifest && (
        <Live2DCanvas
          accessibility={{ mode: 'decorative' }}
          coreUrl={CORE_URL}
          maxFps={finite(query.get('fps'), 60)}
          resolution={Math.max(1, finite(query.get('resolution'), 1))}
        >
          <Live2DModel fit={fit} src={manifest.model3} onLoad={onLoad} />
        </Live2DCanvas>
      )}
    </main>
  )
}

createRoot(document.querySelector('#root')!).render(
  <StrictMode><Overlay /></StrictMode>,
)
