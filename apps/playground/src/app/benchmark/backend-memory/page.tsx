'use client'

import type { Live2DBackend, Live2DInstance } from 'live2d-web'
import type { BackendMemoryPageSnapshot } from '../../../benchmark/backendMemoryContracts'
import { createLive2D } from 'live2d-web'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { disposeInstances } from '../../../benchmark/contracts'

interface AssetManifest {
  model3: string
}

type BackendName = 'cubism-webgl' | 'pixi-v6'

function stageCountFrom(value: string | null) {
  const parsed = Number(value)
  return parsed === 4 ? 4 : 1
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

function BackendMemoryContent() {
  const searchParams = useSearchParams()
  const backendName: BackendName = searchParams.get('backend') === 'pixi-v6'
    ? 'pixi-v6'
    : 'cubism-webgl'
  const stageCount = stageCountFrom(searchParams.get('stageCount'))
  const [manifest, setManifest] = useState<AssetManifest>()
  const [status, setStatus] = useState('loading manifest')
  const hostsRef = useRef<Array<HTMLDivElement | null>>([])

  useEffect(() => {
    const abortController = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: abortController.signal })
      .then((response) => {
        if (!response.ok)
          throw new Error('Run `LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets` before benchmarking.')
        return response.json() as Promise<AssetManifest>
      })
      .then(setManifest)
      .catch((error: unknown) => {
        if (!abortController.signal.aborted)
          setStatus(error instanceof Error ? error.message : String(error))
      })
    return () => abortController.abort()
  }, [])

  useEffect(() => {
    if (!manifest)
      return
    let instances: Live2DInstance[] = []
    let readyMs: number | null = null
    let disposed = false
    let generation = 0
    const snapshot = (): BackendMemoryPageSnapshot => ({
      canvasCount: document.querySelectorAll('canvas').length,
      readyMs,
    })
    const dispose = () => {
      generation++
      disposeInstances(instances)
      readyMs = null
      setStatus('ready-to-mount')
      return snapshot()
    }
    const loadBackend = async (): Promise<Live2DBackend | undefined> => {
      if (backendName === 'cubism-webgl')
        return undefined
      return (await import('live2d-web/adapters/pixi-v6')).pixiV6
    }
    const mount = async () => {
      const currentGeneration = ++generation
      disposeInstances(instances)
      readyMs = null
      setStatus('loading')
      const startedAt = performance.now()
      const backend = await loadBackend()
      const results = await Promise.allSettled(
        hostsRef.current.slice(0, stageCount).map((container) => {
          if (!container)
            return Promise.reject(new Error('Backend memory host is missing.'))
          return createLive2D({
            backend,
            container,
            coreUrl: backendName === 'cubism-webgl'
              ? '/assets/js/cubism/5.3/live2dcubismcore.min.js'
              : '/assets/js/cubism/5.2/live2dcubismcore.min.js',
            fit: 'full',
            maxFps: 60,
            pauseWhenOffscreen: false,
            resolution: 1,
            retries: 0,
            src: manifest.model3,
          })
        }),
      )
      const fulfilled = results.flatMap(result => (
        result.status === 'fulfilled' ? [result.value] : []
      ))
      const rejection = results.find(
        (result): result is PromiseRejectedResult => result.status === 'rejected',
      )
      if (disposed || currentGeneration !== generation || rejection) {
        disposeInstances(fulfilled)
        if (rejection)
          throw rejection.reason
        return snapshot()
      }
      instances = fulfilled
      await nextFrame()
      await nextFrame()
      readyMs = performance.now() - startedAt
      setStatus('ready')
      return snapshot()
    }

    window.__live2dBackendMemory = { dispose, mount, snapshot }
    queueMicrotask(() => {
      if (!disposed)
        setStatus('ready-to-mount')
    })
    return () => {
      disposed = true
      disposeInstances(instances)
      delete window.__live2dBackendMemory
    }
  }, [backendName, manifest, stageCount])

  return (
    <main className="benchmark-page">
      <header>
        <div>
          <p className="eyebrow">Backend memory benchmark</p>
          <h1>{backendName}</h1>
          <p>
            {stageCount}
            {' '}
            stage(s), fixed 600×600 CSS size and 1× resolution
          </p>
        </div>
        <output data-testid="backend-memory-status">{status}</output>
      </header>
      <section className="benchmark-grid">
        {Array.from({ length: stageCount }, (_, index) => (
          <div
            key={index}
            ref={(element) => { hostsRef.current[index] = element }}
            className="benchmark-stage"
            data-testid={`backend-memory-stage-${index}`}
          />
        ))}
      </section>
    </main>
  )
}

export default function BackendMemoryPage() {
  return (
    <Suspense fallback={<main>Loading backend memory benchmark…</main>}>
      <BackendMemoryContent />
    </Suspense>
  )
}
