'use client'

import type { Live2DInstance, ModelFit } from 'live2d-web'

import type { AssetManifest } from '../../lib/assetManifest'
import { createLive2D } from 'live2d-web'
import { useEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { SiteHeader } from '../../components/SiteHeader'
import { StageLoading } from '../../components/StageLoading'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../../lib/assetManifest'

export default function VanillaPlayground() {
  preload(CUBISM_CORE_URL, { as: 'script' })
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Live2DInstance | null>(null)
  const [error, setError] = useState('')
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [mouthOpen, setMouthOpen] = useState(0)
  const [mounted, setMounted] = useState(true)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!mounted || !containerRef.current)
      return

    const controller = new AbortController()
    let unsubscribe = () => {}
    let disposed = false

    async function start() {
      try {
        setError('')
        setStatus('loading')
        const response = await fetch('/assets/live2d/hiyori/manifest.json', {
          signal: controller.signal,
        })
        if (!response.ok)
          throw new Error('Run `pnpm fetch-assets` before starting the playground.')
        const manifest = await response.json() as AssetManifest
        warmUpModelAssets(manifest)
        if (!containerRef.current || controller.signal.aborted)
          return

        const instance = await createLive2D({
          container: containerRef.current,
          coreUrl: CUBISM_CORE_URL,
          fit: 'upper-body',
          onError: runtimeError => setError(`${runtimeError.code}: ${runtimeError.message}`),
          quality: 'auto',
          signal: controller.signal,
          src: manifest.model3,
        })
        if (disposed) {
          instance.dispose()
          return
        }
        instanceRef.current = instance
        unsubscribe = instance.subscribe(() => {
          setStatus(instance.getState().status)
        })
        setStatus(instance.getState().status)
      }
      catch (caught) {
        if (!controller.signal.aborted) {
          setStatus('error')
          setError(caught instanceof Error ? caught.message : String(caught))
        }
      }
    }

    void start()
    return () => {
      disposed = true
      controller.abort()
      unsubscribe()
      instanceRef.current?.dispose()
      instanceRef.current = null
    }
  }, [mounted])

  useEffect(() => {
    instanceRef.current?.setFit(fit)
  }, [fit])

  useEffect(() => {
    instanceRef.current?.setParameter('ParamMouthOpenY', mouthOpen)
  }, [mouthOpen])

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div>
            <p className="eyebrow">Vanilla runtime playground</p>
            <h1>Live2D without React bindings</h1>
            <p>
              This page mounts one imperative
              {' '}
              <code>createLive2D()</code>
              {' '}
              runtime with the default Framework WebGL backend.
            </p>
            <code className="install">npm install live2d-web</code>
          </div>
        </section>

        <section className="workspace">
          <div className="stage-shell" data-testid="vanilla-stage">
            {mounted && <div ref={containerRef} className="runtime-host" />}
            <output className="diagnostics" data-testid="vanilla-status">
              <strong>{mounted ? status : 'disposed'}</strong>
            </output>
            {mounted && !error && status === 'loading' && <StageLoading />}
            {error && (
              <div className="stage-overlay error-panel" role="alert">
                <strong>Runtime error</strong>
                <p>{error}</p>
              </div>
            )}
            {!mounted && <div className="empty-stage">Runtime disposed</div>}
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

            <button type="button" onClick={() => void instanceRef.current?.motion('Tap@Body')}>
              Play Tap@Body
            </button>
            <button type="button" onClick={() => instanceRef.current?.pause()}>
              Pause
            </button>
            <button type="button" onClick={() => instanceRef.current?.resume()}>
              Resume
            </button>
            <button type="button" onClick={() => setMounted(value => !value)}>
              {mounted ? 'Dispose runtime' : 'Create runtime'}
            </button>

            <p className="note">
              The root import contains no React or Pixi runtime code. Cubism Core
              remains an application-provided script.
            </p>
          </aside>
        </section>
      </main>
    </>
  )
}
