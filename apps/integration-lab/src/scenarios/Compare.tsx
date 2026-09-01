import type { FrameMetrics } from '../lab-types'
import { useEffect, useRef, useState } from 'react'
import { ScenarioHeader, StatusPill } from '../components/Shared'
import { setLabStatus } from '../diagnostics'

function MetricCard({ metrics }: { metrics?: FrameMetrics }) {
  if (!metrics)
    return <article className="metric-card"><strong>Waiting…</strong></article>
  return (
    <article className="metric-card" data-backend={metrics.backend}>
      <span>{metrics.backend}</span>
      <strong>{metrics.medianFps === null ? '—' : `${metrics.medianFps.toFixed(1)} fps`}</strong>
      <code>{metrics.firstDrawMs === null ? 'first draw —' : `first draw ${metrics.firstDrawMs.toFixed(0)}ms`}</code>
      <code>{metrics.longFrameRatio === null ? 'long frames —' : `${(metrics.longFrameRatio * 100).toFixed(2)}% long frames`}</code>
      <StatusPill state={metrics.status === 'ready' ? 'good' : metrics.status === 'error' ? 'bad' : 'neutral'}>{metrics.status}</StatusPill>
      {metrics.error && <p>{metrics.error}</p>}
    </article>
  )
}

export function Compare() {
  const [metrics, setMetrics] = useState<Partial<Record<FrameMetrics['backend'], FrameMetrics>>>({})
  const [generation, setGeneration] = useState(0)
  const live2dRef = useRef<HTMLIFrameElement>(null)
  const pixiRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'live2d-lab-frame')
        return
      const next = event.data.metrics as FrameMetrics
      const expectedSource = next.backend === 'live2d-web'
        ? live2dRef.current?.contentWindow
        : pixiRef.current?.contentWindow
      if (event.source !== expectedSource)
        return
      setMetrics(current => ({ ...current, [next.backend]: next }))
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  const current = metrics['live2d-web']
  const pixi = metrics['pixi-v6']
  useEffect(() => {
    const states = [current?.status, pixi?.status]
    setLabStatus(states.includes('error') ? 'error' : states.every(state => state === 'ready') ? 'ready' : 'loading', '/compare')
    return () => setLabStatus('disposed', '/compare')
  }, [current?.status, pixi?.status])
  const enoughFrames = (current?.frameCount ?? 0) >= 120 && (pixi?.frameCount ?? 0) >= 120
  const withinBudget = Boolean(
    enoughFrames
    && current?.medianFps
    && pixi?.medianFps
    && current.medianFps >= pixi.medianFps * 0.95
    && current.longFrameRatio !== null
    && pixi.longFrameRatio !== null
    && Math.abs(current.longFrameRatio - pixi.longFrameRatio) <= 0.005,
  )
  const command = (value: string) => {
    const message = { command: value, type: 'live2d-lab-command' }
    live2dRef.current?.contentWindow?.postMessage(message, window.location.origin)
    pixiRef.current?.contentWindow?.postMessage(message, window.location.origin)
  }

  return (
    <main>
      <ScenarioHeader eyebrow="Isolated backends" title="Pixi Comparison">
        Core 5.3 and Core 5.2 run in separate windows with the same model, viewport and motion workload.
      </ScenarioHeader>
      <div className="comparison-controls">
        <button type="button" onClick={() => command('motion')}>Play both motions</button>
        <button
          type="button"
          onClick={() => {
            setMetrics({})
            setGeneration(value => value + 1)
          }}
        >
          Reload both
        </button>
        <StatusPill state={!enoughFrames ? 'neutral' : withinBudget ? 'good' : 'bad'}>
          {!enoughFrames ? 'collecting 120 frames' : withinBudget ? 'within comparison budget' : 'outside comparison budget'}
        </StatusPill>
      </div>
      <section className="comparison-grid" data-testid="comparison-grid">
        <div>
          <iframe ref={live2dRef} key={`live2d-${generation}`} title="live2d-web renderer" src={`/frames/live2d.html?generation=${generation}`} />
          <MetricCard metrics={current} />
        </div>
        <div>
          <iframe ref={pixiRef} key={`pixi-${generation}`} title="Pixi renderer" src={`/frames/pixi.html?generation=${generation}`} />
          <MetricCard metrics={pixi} />
        </div>
      </section>
      <output data-testid="comparison-budget" hidden={!enoughFrames}>{withinBudget ? 'pass' : 'fail'}</output>
      <p className="note">The integration view is a functional comparison. Repeatable performance reports remain in the existing benchmark suite.</p>
    </main>
  )
}
