import type { Live2DCanvasAccessibility, ModelFit } from 'live2d-web'
import type { Live2DModelController } from 'live2d-web/react'
import {
  Live2DCanvas,
  Live2DModel,
  useLive2DCanvas,
} from 'live2d-web/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AssetError, ControlGroup, ScenarioHeader, StatusPill } from '../components/Shared'
import { CORE_URL } from '../constants'
import { recordError, setLabModels, setLabStatus } from '../diagnostics'
import { useManifest } from '../useManifest'

type ModelId = 'guest' | 'host'
type Scene = 'game' | 'starting' | 'talk'

function StageDiagnostics() {
  const stage = useLive2DCanvas()
  useEffect(() => {
    setLabStatus(stage.status === 'ready' ? 'ready' : stage.status === 'error' ? 'error' : 'loading', '/studio')
    return () => setLabStatus('disposed', '/studio')
  }, [stage.status])
  return (
    <output className="stage-diagnostics" data-testid="studio-status">
      <b>{stage.status}</b>
      {stage.render && (
        <span>
          {stage.render.width}
          ×
          {stage.render.height}
          {' '}
          ·
          {' '}
          {stage.render.resolution.toFixed(2)}
          x
        </span>
      )}
      {stage.error && <span>{stage.error.code}</span>}
    </output>
  )
}

function RegisteredModel({
  active,
  debug,
  fit,
  id,
  onController,
  onFit,
  src,
}: {
  active: boolean
  debug: boolean
  fit: ModelFit
  id: ModelId
  onController: (id: ModelId, controller: Live2DModelController | null) => void
  onFit: (fit: ModelFit) => void
  src: string
}) {
  const controllerRef = useRef<Live2DModelController | null>(null)
  useEffect(() => () => {
    controllerRef.current = null
    onController(id, null)
  }, [id, onController])
  return (
    <Live2DModel
      debug={active && debug}
      fit={fit}
      followPointer={active}
      idleMotion="Idle"
      src={src}
      onError={recordError}
      onFitChange={onFit}
      onLoad={(controller) => {
        controllerRef.current = controller
        onController(id, controller)
      }}
      onTap={() => {
        const controller = controllerRef.current
        if (!active || !controller)
          return
        const motion = firstMotion(controller)
        if (motion)
          void controller.motion(motion[0], 0)
      }}
    />
  )
}

function firstMotion(controller: Live2DModelController) {
  const entries = Object.entries(controller.getModelInfo().motions)
  return entries.find(([group, count]) => group !== 'Idle' && count > 0)
    ?? entries.find(([, count]) => count > 0)
}

export function Studio() {
  const { error, manifest, retry } = useManifest()
  const [active, setActive] = useState<ModelId>('host')
  const [accessibilityMode, setAccessibilityMode] = useState<'decorative' | 'image'>('image')
  const [aspect, setAspect] = useState<'free' | 'landscape' | 'portrait'>('landscape')
  const [controllers, setControllers] = useState<Partial<Record<ModelId, Live2DModelController>>>({})
  const [debug, setDebug] = useState(false)
  const [fit, setFit] = useState<ModelFit>({ offsetX: 0, offsetY: 0.05, scale: 0.82, units: 'stage' })
  const [guest, setGuest] = useState(false)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState('idle')
  const [scene, setScene] = useState<Scene>('talk')
  const setController = useCallback((id: ModelId, controller: Live2DModelController | null) => {
    setControllers((current) => {
      if (controller)
        return { ...current, [id]: controller }
      const next = { ...current }
      delete next[id]
      return next
    })
  }, [])

  useEffect(() => {
    setLabModels(Object.keys(controllers).length)
    return () => setLabModels(0)
  }, [controllers])

  const activeController = controllers[active]
  const runMotion = async () => {
    if (!activeController)
      return
    const motion = firstMotion(activeController)
    if (!motion)
      return setResult('no motions')
    setResult(`motion playing · ${motion[0]} 0`)
    try {
      const playback = await activeController.playMotion(motion[0], 0, { fadeInMs: 250, fadeOutMs: 350 })
      setResult(`motion ${playback.status} · ${motion[0]} 0`)
    }
    catch (caught) {
      recordError(caught)
      setResult('motion error')
    }
  }
  const runExpression = async () => {
    if (!activeController)
      return
    const expression = activeController.getModelInfo().expressions[0]
    if (!expression)
      return setResult('no expressions')
    await activeController.expression(expression, { fadeInMs: 250, fadeOutMs: 350 })
    setResult(`expression ${expression}`)
  }
  const runSequence = async () => {
    if (!activeController)
      return
    const motion = firstMotion(activeController)
    if (!motion)
      return setResult('no motions')
    setResult(`sequence playing · ${motion[0]}`)
    try {
      const sequence = await activeController.sequence([
        { group: motion[0], index: 0, options: { fadeInMs: 150, fadeOutMs: 250 } },
        { group: motion[0], index: Math.min(1, motion[1] - 1), options: { fadeInMs: 150, fadeOutMs: 250 } },
      ])
      setResult(`sequence ${sequence.status} · ${sequence.completedSteps}`)
    }
    catch (caught) {
      recordError(caught)
      setResult('sequence error')
    }
  }

  const hostFit = guest
    ? { offsetX: -0.2, offsetY: 0.05, scale: 0.62, units: 'stage' } satisfies ModelFit
    : fit
  const guestFit = useMemo<ModelFit>(() => ({
    offsetX: 0.21,
    offsetY: 0.05,
    scale: 0.62,
    units: 'stage',
  }), [])
  const accessibility = useMemo<Live2DCanvasAccessibility>(() => accessibilityMode === 'decorative'
    ? { mode: 'decorative' }
    : {
        describedBy: 'studio-description',
        fallbackText: 'Live2D broadcast preview',
        label: 'Interactive Live2D stream scene',
      }, [accessibilityMode])

  return (
    <main>
      <ScenarioHeader eyebrow="Combined React usage" title="Stream Studio">
        A transparent, resizable broadcast scene exercises multiple models, placement and playback together.
      </ScenarioHeader>
      {error && !manifest
        ? <AssetError message={error} retry={retry} />
        : (
            <div className="studio-layout">
              <section className="broadcast-shell" data-aspect={aspect} data-scene={scene} data-testid="studio-stage">
                <div className="broadcast-backdrop">
                  <span className="live-badge">● LIVE</span>
                  <span aria-live="polite" className="scene-badge">
                    {scene === 'starting' ? 'STARTING SOON' : scene === 'game' ? 'GAME FEED' : 'JUST CHATTING'}
                  </span>
                  <div className="chat-stack" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                {manifest
                  ? (
                      <Live2DCanvas
                        accessibility={accessibility}
                        className="studio-canvas"
                        coreUrl={CORE_URL}
                        paused={paused}
                        quality="auto"
                        errorFallback={(stageError, retryStage) => (
                          <div className="stage-error" role="alert">
                            <b>{stageError.code}</b>
                            <span>{stageError.message}</span>
                            <button type="button" onClick={retryStage}>Retry runtime</button>
                          </div>
                        )}
                        fallback={stage => (
                          <div className="stage-loading">
                            Loading
                            {stage}
                            …
                          </div>
                        )}
                        onError={recordError}
                      >
                        <RegisteredModel
                          active={active === 'host'}
                          debug={debug}
                          fit={hostFit}
                          id="host"
                          src={manifest.model3}
                          onController={setController}
                          onFit={setFit}
                        />
                        {guest && (
                          <RegisteredModel
                            active={active === 'guest'}
                            debug={debug}
                            fit={guestFit}
                            id="guest"
                            src={manifest.model3}
                            onController={setController}
                            onFit={() => {}}
                          />
                        )}
                        <StageDiagnostics />
                      </Live2DCanvas>
                    )
                  : <div className="stage-loading">Loading asset manifest…</div>}
              </section>

              <aside className="control-panel">
                <ControlGroup label="Scene">
                  <label>
                    Viewport
                    <select aria-label="Viewport" value={aspect} onChange={event => setAspect(event.target.value as typeof aspect)}>
                      <option value="landscape">16:9</option>
                      <option value="portrait">9:16</option>
                      <option value="free">Free</option>
                    </select>
                  </label>
                  <label>
                    Broadcast scene
                    <select aria-label="Broadcast scene" value={scene} onChange={event => setScene(event.target.value as Scene)}>
                      <option value="talk">Just chatting</option>
                      <option value="game">Game feed</option>
                      <option value="starting">Starting soon</option>
                    </select>
                  </label>
                  <label>
                    Canvas semantics
                    <select
                      aria-label="Canvas semantics"
                      value={accessibilityMode}
                      onChange={event => setAccessibilityMode(event.target.value as typeof accessibilityMode)}
                    >
                      <option value="image">Described image</option>
                      <option value="decorative">Decorative</option>
                    </select>
                  </label>
                  <label className="toggle">
                    <input checked={paused} type="checkbox" onChange={event => setPaused(event.target.checked)} />
                    {' '}
                    Pause canvas
                  </label>
                  <label className="toggle">
                    <input checked={debug} type="checkbox" onChange={event => setDebug(event.target.checked)} />
                    {' '}
                    Placement overlay
                  </label>
                </ControlGroup>
                <ControlGroup label="Models">
                  <button
                    data-testid="toggle-guest"
                    type="button"
                    onClick={() => {
                      setGuest(value => !value)
                      if (guest)
                        setActive('host')
                    }}
                  >
                    {guest ? 'Remove guest' : 'Add guest'}
                  </button>
                  {guest && (
                    <label>
                      Active model
                      <select aria-label="Active model" value={active} onChange={event => setActive(event.target.value as ModelId)}>
                        <option value="host">Host</option>
                        <option value="guest">Guest</option>
                      </select>
                    </label>
                  )}
                  <StatusPill state={Object.keys(controllers).length === (guest ? 2 : 1) ? 'good' : 'neutral'}>
                    {Object.keys(controllers).length}
                    {' '}
                    loaded
                  </StatusPill>
                </ControlGroup>
                <ControlGroup label="Playback">
                  <div className="button-row">
                    <button disabled={!activeController} type="button" onClick={() => void runMotion()}>Play motion</button>
                    <button disabled={!activeController} type="button" onClick={() => void runExpression()}>Expression</button>
                    <button disabled={!activeController} type="button" onClick={() => void runSequence()}>Sequence</button>
                    <button disabled={!activeController} type="button" onClick={() => activeController?.clearExpression()}>Clear</button>
                  </div>
                  <output data-testid="studio-result">{result}</output>
                </ControlGroup>
              </aside>
            </div>
          )}
      <p className="visually-hidden" id="studio-description">A mock streaming scene used to test transparent Live2D rendering.</p>
    </main>
  )
}
