'use client'

import type { ModelFit } from 'live2d-jsx'
import { Live2DModel, Live2DStage, useParameterDriver, useStage } from 'live2d-jsx'
import { pixiV6 } from 'live2d-jsx/adapters/pixi-v6'
import { useEffect, useRef, useState } from 'react'

interface AssetManifest {
  model3: string
}

function MouthParameter({ value }: { value: number }) {
  const valueRef = useRef(value)
  valueRef.current = value
  useParameterDriver('ParamMouthOpenY', () => valueRef.current)
  return null
}

function Diagnostics() {
  const stage = useStage()
  return (
    <output className="diagnostics" data-testid="stage-status">
      <strong>{stage.status}</strong>
      {stage.loadingStage && <span>{stage.loadingStage}</span>}
      {stage.render && (
        <>
          <span>
            {stage.render.width.toFixed(0)}
            ×
            {stage.render.height.toFixed(0)}
          </span>
          <span>
            DPR
            {' '}
            {stage.render.resolution.toFixed(2)}
          </span>
          <span>
            {(stage.render.bufferPixels / 1_000_000).toFixed(2)}
            MP
          </span>
        </>
      )}
    </output>
  )
}

function StageError({
  code,
  message,
  retry,
}: {
  code: string
  message: string
  retry: () => void
}) {
  return (
    <div className="stage-overlay error-panel" role="alert">
      <strong>{code}</strong>
      <p>{message}</p>
      <button type="button" onClick={retry}>Retry stage</button>
    </div>
  )
}

export default function Home() {
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [assetError, setAssetError] = useState('')
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [mouthOpen, setMouthOpen] = useState(0)
  const [mounted, setMounted] = useState(true)
  const [fixedQuality, setFixedQuality] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Run `pnpm fetch-assets` before starting the playground.')
        return response.json() as Promise<AssetManifest>
      })
      .then(setManifest)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setAssetError(error instanceof Error ? error.message : String(error))
      })
    return () => controller.abort()
  }, [])

  const stage = manifest && mounted
    ? (
        <Live2DStage
          backend={pixiV6}
          coreUrl="/assets/js/cubism/live2dcubismcore.min.js"
          {...(fixedQuality ? { resolution: 1 } : { quality: 'auto' as const })}
          fallback={loadingStage => (
            <div className="stage-overlay">
              Loading
              {' '}
              {loadingStage}
              …
            </div>
          )}
          errorFallback={(error, retry) => (
            <StageError code={error.code} message={error.message} retry={retry} />
          )}
        >
          <Live2DModel fit={fit} src={manifest.model3}>
            <MouthParameter value={mouthOpen} />
          </Live2DModel>
          <Diagnostics />
        </Live2DStage>
      )
    : (
        <div className="empty-stage">
          {assetError || (mounted ? 'Loading local assets…' : 'Stage unmounted')}
        </div>
      )

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">v0.1 alpha playground</p>
          <h1>Declarative Live2D for React</h1>
          <p>
            PIXI stays behind the adapter. React owns loading, retries, fitting,
            quality and cleanup.
          </p>
        </div>
        <a href="https://github.com/guansss/pixi-live2d-display">
          pixi-v6 backend
        </a>
      </header>

      <section className="workspace">
        <div className="stage-shell">
          {stage}
        </div>

        <aside>
          <label>
            Framing
            <select
              value={typeof fit === 'string' ? fit : 'upper-body'}
              onChange={event => setFit(event.target.value as 'upper-body' | 'full')}
            >
              <option value="upper-body">Upper body</option>
              <option value="full">Full model</option>
            </select>
          </label>

          <label>
            ParamMouthOpenY
            <output>{mouthOpen.toFixed(2)}</output>
            <input
              max="1"
              min="0"
              step="0.01"
              type="range"
              value={mouthOpen}
              onChange={event => setMouthOpen(Number(event.target.value))}
            />
          </label>

          <label className="toggle">
            <input
              checked={fixedQuality}
              type="checkbox"
              onChange={event => setFixedQuality(event.target.checked)}
            />
            Fixed 1× resolution
          </label>

          <button type="button" onClick={() => setMounted(value => !value)}>
            {mounted ? 'Unmount stage' : 'Mount stage'}
          </button>

          <p className="note">
            Repeated mount/unmount is the StrictMode and resource-cleanup smoke test.
          </p>
        </aside>
      </section>
    </main>
  )
}
