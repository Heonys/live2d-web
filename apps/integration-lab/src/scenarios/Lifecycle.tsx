import type { Live2DInstance, Live2DModelHandle } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AssetError, ControlGroup, ScenarioHeader, StatusPill } from '../components/Shared'
import { CORE_URL } from '../constants'
import {
  recordError,
  setLabModels,
  setLabStatus,
  setLifecycleRunner,
} from '../diagnostics'
import { useManifest } from '../useManifest'

export function Lifecycle() {
  const { error, manifest, retry: retryManifest } = useManifest()
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Live2DInstance | null>(null)
  const guestRef = useRef<Live2DModelHandle | null>(null)
  const generationRef = useRef(0)
  const [cycles, setCycles] = useState(0)
  const [models, setModels] = useState(0)
  const [runtimeState, setRuntimeState] = useState('idle')
  const [result, setResult] = useState('Waiting for assets')

  const dispose = useCallback(() => {
    generationRef.current += 1
    guestRef.current?.dispose()
    guestRef.current = null
    instanceRef.current?.dispose()
    instanceRef.current = null
    setModels(0)
    setLabModels(0)
    setRuntimeState('disposed')
    setLabStatus('disposed', '/lifecycle')
  }, [])

  const create = useCallback(async () => {
    if (!containerRef.current || !manifest)
      return
    dispose()
    const generation = generationRef.current
    // Creation may start from the lifecycle effect or an explicit user action.

    setRuntimeState('loading')
    setLabStatus('loading', '/lifecycle')
    const instance = await createLive2D({
      accessibility: { label: 'Vanilla Live2D lifecycle stage' },
      container: containerRef.current,
      coreUrl: CORE_URL,
      fit: { offsetY: 0.05, scale: 0.78, units: 'stage' },
      onError: recordError,
      quality: 'auto',
    })
    if (generation !== generationRef.current) {
      instance.dispose()
      return
    }
    instanceRef.current = instance
    const unsubscribe = instance.subscribe(() => {
      if (instanceRef.current !== instance)
        return unsubscribe()
      const state = instance.getState()
      // The subscription is the external runtime's state bridge into React.
      // eslint-disable-next-line react/set-state-in-effect
      setRuntimeState(state.status)
      setLabStatus(state.status === 'ready' ? 'ready' : state.status === 'error' ? 'error' : state.status === 'disposed' ? 'disposed' : 'loading', '/lifecycle')
    })
    try {
      await instance.addModel({
        fit: { offsetY: 0.05, scale: 0.78, units: 'stage' },
        idleMotion: 'Idle',
        src: manifest.model3,
      })
      if (instanceRef.current !== instance)
        return
      setModels(1)
      setLabModels(1)
      setRuntimeState('ready')
      setLabStatus('ready', '/lifecycle')
      setResult('Empty stage created, primary model added')
    }
    catch (caught) {
      recordError(caught)
      setResult(caught instanceof Error ? caught.message : String(caught))
    }
  }, [dispose, manifest])

  const runCycles = useCallback(async (count: number) => {
    for (let index = 0; index < count; index += 1) {
      await create()
      await new Promise(resolve => window.setTimeout(resolve, 80))
      setCycles(value => value + 1)
    }
  }, [create])

  useEffect(() => {
    if (manifest)
      void create()
    return dispose
  }, [create, dispose, manifest])

  useEffect(() => {
    setLifecycleRunner(runCycles)
    return () => setLifecycleRunner(undefined)
  }, [runCycles])

  const addGuest = async () => {
    const instance = instanceRef.current
    if (!instance || !manifest || guestRef.current)
      return
    try {
      guestRef.current = await instance.addModel({
        fit: { offsetX: 0.2, offsetY: 0.05, scale: 0.55, units: 'stage' },
        idleMotion: false,
        src: manifest.model3,
      })
      instance.setFit({ offsetX: -0.2, offsetY: 0.05, scale: 0.55, units: 'stage' })
      setModels(2)
      setLabModels(2)
      setResult('Guest added to the existing canvas')
    }
    catch (caught) {
      recordError(caught)
    }
  }

  const removeGuest = () => {
    guestRef.current?.dispose()
    guestRef.current = null
    instanceRef.current?.setFit({ offsetY: 0.05, scale: 0.78, units: 'stage' })
    setModels(instanceRef.current ? 1 : 0)
    setLabModels(instanceRef.current ? 1 : 0)
    setResult('Guest disposed; primary model remains')
  }

  const loseContext = () => {
    const canvas = containerRef.current?.querySelector('canvas')
    canvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    setResult(canvas ? 'webglcontextlost dispatched' : 'No canvas')
  }

  const retryRuntime = async () => {
    try {
      await instanceRef.current?.retry()
      setResult('Runtime recreated after context loss')
    }
    catch (caught) {
      recordError(caught)
      setResult(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <main>
      <ScenarioHeader eyebrow="Vanilla API" title="Runtime Lifecycle">
        Start with an empty canvas, add models, dispose them independently and recreate the renderer after failure.
      </ScenarioHeader>
      {error && !manifest && <AssetError message={error} retry={retryManifest} />}
      <div className="lifecycle-layout">
        <section className="runtime-stage" data-testid="lifecycle-stage">
          <div ref={containerRef} className="runtime-canvas" />
          <output className="stage-diagnostics" data-testid="lifecycle-status">
            <b>{runtimeState}</b>
            <span>
              {models}
              {' '}
              models ·
              {' '}
              {containerRef.current?.querySelectorAll('canvas').length ?? 0}
              {' '}
              canvas
            </span>
          </output>
        </section>
        <aside className="control-panel">
          <ControlGroup label="Lifecycle">
            <div className="button-row">
              <button disabled={!manifest} type="button" onClick={() => void create()}>Recreate</button>
              <button disabled={!instanceRef.current || Boolean(guestRef.current)} type="button" onClick={() => void addGuest()}>Add guest</button>
              <button disabled={!guestRef.current} type="button" onClick={removeGuest}>Dispose guest</button>
              <button type="button" onClick={dispose}>Dispose all</button>
            </div>
          </ControlGroup>
          <ControlGroup label="Failure recovery">
            <div className="button-row">
              <button disabled={!instanceRef.current} type="button" onClick={loseContext}>Lose context</button>
              <button disabled={!instanceRef.current} type="button" onClick={() => void retryRuntime()}>Retry runtime</button>
              <button disabled={!manifest} data-testid="run-cycles" type="button" onClick={() => void runCycles(5)}>Run 5 cycles</button>
            </div>
          </ControlGroup>
          <div className="metric-row">
            <span>Completed cycles</span>
            <strong>{cycles}</strong>
          </div>
          <StatusPill state={runtimeState === 'ready' ? 'good' : runtimeState === 'error' ? 'bad' : 'neutral'}>{runtimeState}</StatusPill>
          <output data-testid="lifecycle-result">{result}</output>
        </aside>
      </div>
    </main>
  )
}
