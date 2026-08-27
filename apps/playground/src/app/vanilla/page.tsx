'use client'

import type { Live2DInstance, ModelFit } from 'live2d-web'

import type { AssetManifest } from '../../lib/assetManifest'
import { createLive2D } from 'live2d-web'
import { useEffect, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { StageLoading } from '../../components/StageLoading'
import { useSiteLocale, useSiteMessages } from '../../i18n/SiteLocale'
import { CUBISM_CORE_URL, warmUpModelAssets } from '../../lib/assetManifest'

export default function VanillaPlayground() {
  preload(CUBISM_CORE_URL, { as: 'script' })
  const locale = useSiteLocale()
  const messages = useSiteMessages()
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
          throw new Error(messages.vanilla.assetsMissing)
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
  }, [messages.vanilla.assetsMissing, mounted])

  useEffect(() => {
    instanceRef.current?.setFit(fit)
  }, [fit])

  useEffect(() => {
    instanceRef.current?.setParameter('ParamMouthOpenY', mouthOpen)
  }, [mouthOpen])

  return (
    <main lang={locale}>
      <section className="page-hero">
        <div>
          <p className="eyebrow">{messages.vanilla.eyebrow}</p>
          <h1>{messages.vanilla.title}</h1>
          <p>
            {messages.vanilla.descriptionBefore}
            {' '}
            <code>createLive2D()</code>
            {' '}
            {messages.vanilla.descriptionAfter}
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
              <strong>{messages.vanilla.runtimeError}</strong>
              <p>{error}</p>
            </div>
          )}
          {!mounted && <div className="empty-stage">{messages.vanilla.disposed}</div>}
        </div>

        <aside>
          <label>
            {messages.vanilla.framing}
            <select
              value={typeof fit === 'string' ? fit : 'upper-body'}
              onChange={event => setFit(event.target.value as 'upper-body' | 'full')}
            >
              <option value="upper-body">{messages.common.upperBody}</option>
              <option value="full">{messages.common.fullModel}</option>
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
            {messages.vanilla.play}
          </button>
          <button type="button" onClick={() => instanceRef.current?.pause()}>
            {messages.vanilla.pause}
          </button>
          <button type="button" onClick={() => instanceRef.current?.resume()}>
            {messages.vanilla.resume}
          </button>
          <button type="button" onClick={() => setMounted(value => !value)}>
            {mounted ? messages.vanilla.dispose : messages.vanilla.create}
          </button>

          <p className="note">
            {messages.vanilla.note}
          </p>
        </aside>
      </section>
    </main>
  )
}
