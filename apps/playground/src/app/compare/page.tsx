'use client'

import type { Live2DBackend } from 'live2d-web'
import { cubismWebGL } from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
import {
  Live2DModel,
  Live2DStage,
  useLive2DModel,
  useStage,
} from 'live2d-web/react'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'

interface AssetManifest {
  model3: string
}

declare global {
  interface Window {
    __live2dWebBenchmarkFrames?: number[]
  }
}

function withBenchmarkMetrics(backend: Live2DBackend): Live2DBackend {
  return {
    ...backend,
    createStage(element, options) {
      const stage = backend.createStage(element, options)
      const stopMeasuring = stage.onFrame((deltaMs) => {
        const frames = window.__live2dWebBenchmarkFrames ??= []
        frames.push(deltaMs)
      })
      const disposeStage = stage.dispose
      stage.dispose = () => {
        stopMeasuring()
        disposeStage()
      }
      return stage
    },
  }
}

function Diagnostics({ backendName }: { backendName: string }) {
  const stage = useStage()
  return (
    <output className="diagnostics" data-testid="comparison-status">
      <strong>{stage.status}</strong>
      <span>{backendName}</span>
      {stage.render && (
        <span>
          {(stage.render.bufferPixels / 1_000_000).toFixed(2)}
          {' '}
          MP
        </span>
      )}
      {stage.error && (
        <span data-testid="comparison-error">
          {stage.error.code}
          {': '}
          {stage.error.message}
        </span>
      )}
    </output>
  )
}

function ModelControls() {
  const model = useLive2DModel()
  return (
    <button type="button" onClick={() => void model?.motion('Tap@Body')}>
      Play Tap@Body
    </button>
  )
}

function BackendComparisonContent() {
  const searchParams = useSearchParams()
  const backendName = searchParams.get('backend') === 'pixi-v6'
    ? 'pixi-v6'
    : 'cubism-webgl'
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [error, setError] = useState('')
  const backend = useMemo<Live2DBackend>(
    () => withBenchmarkMetrics(
      backendName === 'cubism-webgl' ? cubismWebGL : pixiV6,
    ),
    [backendName],
  )

  useEffect(() => {
    const controller = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Run `pnpm fetch-assets` before starting the playground.')
        return response.json() as Promise<AssetManifest>
      })
      .then(setManifest)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => controller.abort()
  }, [])

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Renderer comparison</p>
          <h1>Cubism WebGL vs Pixi v6</h1>
          <p>
            Both backends use the same Core, Hiyori model, CSS size and fixed
            1× backing-buffer resolution.
          </p>
        </div>
        <nav>
          <a href="/">React playground</a>
          <a href="/vanilla">Vanilla playground</a>
        </nav>
      </header>

      <section className="workspace">
        <div className="stage-shell" data-testid="comparison-stage">
          {manifest
            ? (
                <Live2DStage
                  key={backendName}
                  backend={backend}
                  coreUrl={backendName === 'cubism-webgl'
                    ? '/assets/js/cubism/5.3/live2dcubismcore.min.js'
                    : '/assets/js/cubism/5.2/live2dcubismcore.min.js'}
                  resolution={1}
                  maxFps={60}
                  errorFallback={stageError => (
                    <div className="stage-overlay error-panel" role="alert">
                      {stageError.code}
                      {': '}
                      {stageError.message}
                    </div>
                  )}
                >
                  <Live2DModel fit="full" src={manifest.model3}>
                    <ModelControls />
                  </Live2DModel>
                  <Diagnostics backendName={backendName} />
                </Live2DStage>
              )
            : <div className="empty-stage">{error || 'Loading local assets…'}</div>}
        </div>

        <aside>
          <label>
            Backend
            <select
              aria-label="Backend"
              value={backendName}
              onChange={(event) => {
                const next = event.target.value as 'cubism-webgl' | 'pixi-v6'
                const url = new URL(window.location.href)
                url.searchParams.set('backend', next)
                window.location.assign(url)
              }}
            >
              <option value="cubism-webgl">cubism-webgl</option>
              <option value="pixi-v6">pixi-v6</option>
            </select>
          </label>
          <p className="note">
            Backend changes reload the page because Cubism Core is a
            process-global script. WebGL uses Core 5.3; the legacy Pixi
            Framework uses the final pre-5.3 Core. The model, CSS size and
            backing-buffer resolution and 60 FPS cap stay identical.
          </p>
        </aside>
      </section>
    </main>
  )
}

export default function BackendComparison() {
  return (
    <Suspense fallback={<main>Loading comparison…</main>}>
      <BackendComparisonContent />
    </Suspense>
  )
}
