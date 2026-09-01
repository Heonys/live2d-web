import { useEffect, useState } from 'react'
import { ScenarioHeader, StatusPill } from '../components/Shared'
import {
  CORE_URL,
  HIYORI_MANIFEST_URL,
  MEDIAPIPE_MODEL_URL,
} from '../constants'

interface Check {
  label: string
  state: 'checking' | 'missing' | 'ready'
}

const scenarios = [
  ['#/studio', 'Stream Studio', 'Transparent broadcast scene, multi-model and placement controls.'],
  ['#/lifecycle', 'Runtime Lifecycle', 'Vanilla empty stage, disposal, context loss and repeat cycles.'],
  ['#/inputs', 'Audio & Tracking', 'Volume drivers, microphone ownership and MediaPipe execution.'],
  ['#/assets', 'Assets & Tools', 'URL and zip sources, inspector, devtools and error recovery.'],
  ['#/compare', 'Pixi Comparison', 'Isolated Core 5.3 and Core 5.2 consumers with matching workloads.'],
  ['/overlay.html', 'OBS Overlay', 'Transparent query-configured browser source.'],
] as const

export function Dashboard() {
  const [checks, setChecks] = useState<Check[]>([
    { label: 'Cubism Core 5.3', state: 'checking' },
    { label: 'Hiyori manifest', state: 'checking' },
    { label: 'MediaPipe task', state: 'checking' },
  ])
  const [webgl2] = useState(() => Boolean(document.createElement('canvas').getContext('webgl2')))

  useEffect(() => {
    let active = true
    void Promise.all([
      [CORE_URL, 'Cubism Core 5.3'],
      [HIYORI_MANIFEST_URL, 'Hiyori manifest'],
      [MEDIAPIPE_MODEL_URL, 'MediaPipe task'],
    ].map(async ([url, label]) => {
      try {
        const response = await fetch(url, { method: 'HEAD' })
        return { label, state: response.ok ? 'ready' : 'missing' } as Check
      }
      catch {
        return { label, state: 'missing' } as Check
      }
    })).then((results) => {
      if (active)
        setChecks(results)
    })
    return () => {
      active = false
    }
  }, [])

  const snapshot = window.__live2dLab?.snapshot()
  return (
    <main>
      <ScenarioHeader eyebrow="Release integration" title="v0.9 consumer lab">
        Exercise the published package and the workspace source through the same real-world scenarios.
      </ScenarioHeader>

      <section aria-label="Environment" className="diagnostic-grid">
        <article className="metric-card">
          <span>Package source</span>
          <strong data-testid="package-source">{__LIVE2D_LAB_META__.source === 'release' ? 'npm 0.9.0' : 'local source'}</strong>
          <code title={__LIVE2D_LAB_META__.entry}>{__LIVE2D_LAB_META__.packageVersion}</code>
        </article>
        <article className="metric-card">
          <span>WebGL2</span>
          <strong>{webgl2 ? 'available' : 'unavailable'}</strong>
          <StatusPill state={webgl2 ? 'good' : 'bad'}>{webgl2 ? 'ready' : 'blocked'}</StatusPill>
        </article>
        <article className="metric-card">
          <span>Current DOM</span>
          <strong>
            {snapshot?.canvases ?? 0}
            {' '}
            canvases
          </strong>
          <code>
            {snapshot?.errors.length ?? 0}
            {' '}
            page ·
            {' '}
            {snapshot?.consoleErrors.length ?? 0}
            {' '}
            console errors
          </code>
        </article>
      </section>

      <section aria-labelledby="asset-title" className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Local prerequisites</p>
            <h2 id="asset-title">Asset readiness</h2>
          </div>
          <code>LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets</code>
        </div>
        <div className="asset-checks">
          {checks.map(check => (
            <div key={check.label}>
              <span>{check.label}</span>
              <StatusPill state={check.state === 'ready' ? 'good' : check.state === 'missing' ? 'warn' : 'neutral'}>
                {check.state}
              </StatusPill>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="scenario-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Scenarios</p>
            <h2 id="scenario-title">Combined usage, not isolated demos</h2>
          </div>
        </div>
        <div className="scenario-grid">
          {scenarios.map(([href, title, description]) => {
            const route = href.startsWith('#') ? href.slice(1) : href
            const state = snapshot?.scenarios[route]
            return (
              <a className="scenario-card" href={href} key={href}>
                <span>{title}</span>
                <StatusPill state={state === 'ready' ? 'good' : state === 'error' ? 'bad' : 'neutral'}>
                  {state ?? 'not run'}
                </StatusPill>
                <p>{description}</p>
                <b aria-hidden="true">→</b>
              </a>
            )
          })}
        </div>
      </section>
    </main>
  )
}
