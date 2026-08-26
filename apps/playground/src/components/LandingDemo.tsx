'use client'

import type { Live2DModelController } from 'live2d-web/react'
import type { AssetManifest } from '../lib/assetManifest'
import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'
import { useCallback, useEffect, useState } from 'react'
import { preload } from 'react-dom'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../lib/assetManifest'
import { StageLoading } from './StageLoading'

export function LandingDemo() {
  preload(CUBISM_CORE_URL, { as: 'script' })
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [mouth, setMouth] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const request = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: request.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Local demo assets are unavailable.')
        return response.json() as Promise<AssetManifest>
      })
      .then((loaded) => {
        warmUpModelAssets(loaded)
        setManifest(loaded)
      })
      .catch((reason: unknown) => {
        if (!request.signal.aborted)
          setError(reason instanceof Error ? reason.message : String(reason))
      })
    return () => request.abort()
  }, [])

  const playTap = useCallback(() => {
    if (!controller)
      return
    const info = controller.getModelInfo()
    const group = Object.keys(info.motions).find(name => name.toLowerCase().includes('tap'))
    if (group)
      void controller.motion(group).catch(() => {})
  }, [controller])

  return (
    <div className="landing-demo">
      <div className="landing-stage">
        <output className="landing-stage-status" aria-live="polite">
          <span data-state={error ? 'error' : controller ? 'ready' : 'loading'}>
            {error ? 'error' : controller ? 'ready' : 'loading'}
          </span>
          <span>WebGL2</span>
          <span>Cubism 4/5</span>
        </output>
        {manifest
          ? (
              <Live2DCanvas
                coreUrl={CUBISM_CORE_URL}
                quality="auto"
                fallback={() => <StageLoading />}
              >
                <Live2DModel
                  fit="upper-body"
                  followPointer
                  idleMotion="Idle"
                  src={manifest.model3}
                  onLoad={setController}
                  onTap={playTap}
                >
                  <LipSync mouthOpen={mouth} speaking={mouth > 0} />
                </Live2DModel>
              </Live2DCanvas>
            )
          : error
            ? <p className="landing-demo-error">{error}</p>
            : <StageLoading />}
      </div>
      <div className="landing-demo-controls">
        <span>Try it</span>
        <button disabled={!controller} type="button" onClick={playTap}>Play motion</button>
        <label>
          Mouth
          <input
            aria-label="Demo mouth open"
            max="1"
            min="0"
            step="0.01"
            type="range"
            value={mouth}
            onChange={event => setMouth(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  )
}
