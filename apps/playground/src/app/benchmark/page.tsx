'use client'

import type { Live2DInstance } from 'live2d-web'
import type {
  BenchmarkModelManifest,
  BenchmarkPageSnapshot,
} from '../../benchmark/contracts'
import { BenchmarkDiagnostics } from '@live2d-web/benchmark/collector'
import { createProfiledCubismWebGLBackend } from '@live2d-web/benchmark/profiledBackend'
import { createLive2D } from 'live2d-web'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  disposeInstances,
  parseBenchmarkManifest,
} from '../../benchmark/contracts'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const CANVAS_SIZE = 600

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback
}

function BenchmarkContent() {
  const searchParams = useSearchParams()
  const modelId = searchParams.get('model') ?? 'hiyori'
  const stageCount = positiveInteger(searchParams.get('stageCount'), 1, 4)
  const resolution = positiveInteger(searchParams.get('resolution'), 1, 2)
  const hostsRef = useRef<Array<HTMLDivElement | null>>([])
  const [manifest, setManifest] = useState<BenchmarkModelManifest>()
  const [status, setStatus] = useState('loading manifest')
  const selectedModel = useMemo(
    () => manifest?.models.find(model => model.id === modelId),
    [manifest, modelId],
  )

  useEffect(() => {
    const abortController = new AbortController()
    fetch('/assets/live2d/benchmark-models.json', { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            'Run `LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets` before benchmarking.',
          )
        }
        return response.json()
      })
      .then(value => setManifest(parseBenchmarkManifest(value)))
      .catch((error: unknown) => {
        if (!abortController.signal.aborted)
          setStatus(error instanceof Error ? error.message : String(error))
      })
    return () => abortController.abort()
  }, [])

  useEffect(() => {
    if (!selectedModel)
      return

    let instances: Live2DInstance[] = []
    let diagnostics = new BenchmarkDiagnostics()
    let readyMs: number | null = null
    let disposed = false
    let generation = 0

    const snapshot = (): BenchmarkPageSnapshot => ({
      diagnostics: diagnostics.snapshot(),
      model: selectedModel,
      readyMs,
      resolution,
      stageCount,
    })

    const dispose = () => {
      generation++
      disposeInstances(instances)
      setStatus('disposed')
      return snapshot()
    }

    const mount = async () => {
      const currentGeneration = ++generation
      disposeInstances(instances)
      diagnostics = new BenchmarkDiagnostics()
      readyMs = null
      setStatus('loading')
      const startedAt = performance.now()
      const backend = createProfiledCubismWebGLBackend(diagnostics)
      const results = await Promise.allSettled(
        hostsRef.current.slice(0, stageCount).map((container) => {
          if (!container)
            return Promise.reject(new Error('Benchmark stage host is missing.'))
          return createLive2D({
            backend,
            container,
            coreUrl: CORE_URL,
            fit: 'full',
            maxFps: 60,
            resolution,
            retries: 0,
            src: selectedModel.model3,
          })
        }),
      )
      const fulfilled = results
        .filter((result): result is PromiseFulfilledResult<Live2DInstance> => (
          result.status === 'fulfilled'
        ))
        .map(result => result.value)
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
      await Promise.all(instances.map(instance => instance.motion(
        selectedModel.motion.group,
        selectedModel.motion.index,
      )))
      await diagnostics.waitForFirstDraw(stageCount)
      if (disposed || currentGeneration !== generation) {
        disposeInstances(instances)
        return snapshot()
      }
      readyMs = performance.now() - startedAt
      setStatus('ready')
      return snapshot()
    }

    window.__live2dModelBenchmark = {
      dispose,
      async exercise() {
        await Promise.all(instances.map(async (instance, index) => {
          instance.focus(
            CANVAS_SIZE * (0.25 + index * 0.1),
            CANVAS_SIZE * 0.4,
          )
          await instance.motion(
            selectedModel.motion.group,
            selectedModel.motion.index,
          )
          const expression = selectedModel.expected.expressions[0]
          if (expression)
            await instance.expression(expression)
        }))
      },
      mount,
      resetFrameSamples: () => diagnostics.resetFrameSamples(),
      snapshot,
    }

    void mount().catch((error: unknown) => {
      if (!disposed)
        setStatus(error instanceof Error ? error.message : String(error))
    })
    return () => {
      disposed = true
      disposeInstances(instances)
      delete window.__live2dModelBenchmark
    }
  }, [resolution, selectedModel, stageCount])

  if (manifest && !selectedModel) {
    return (
      <main>
        <output data-testid="benchmark-status">
          unknown model:
          {modelId}
        </output>
      </main>
    )
  }

  return (
    <main className="benchmark-page">
      <header>
        <div>
          <p className="eyebrow">Internal benchmark</p>
          <h1>{selectedModel?.name ?? modelId}</h1>
          <p>
            {stageCount}
            {' '}
            stage(s),
            {resolution}
            × backing buffer, fixed 600×600 CSS size
          </p>
        </div>
        <output data-testid="benchmark-status">{status}</output>
      </header>
      <section className="benchmark-grid">
        {Array.from({ length: stageCount }, (_, index) => (
          <div
            key={index}
            ref={(element) => { hostsRef.current[index] = element }}
            className="benchmark-stage"
            data-testid={`benchmark-stage-${index}`}
          />
        ))}
      </section>
    </main>
  )
}

export default function BenchmarkPage() {
  return (
    <Suspense fallback={<main>Loading benchmark…</main>}>
      <BenchmarkContent />
    </Suspense>
  )
}
