import type { Live2DAssetResolver, Live2DInstance } from 'live2d-web'
import type { Live2DDevtools } from 'live2d-web/devtools'
import type { ModelInspectionReport } from 'live2d-web/inspect'
import JSZip from 'jszip'
import { createLive2D } from 'live2d-web'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AssetError, ControlGroup, ScenarioHeader, StatusPill } from '../components/Shared'
import { CORE_URL } from '../constants'
import { recordError, setLabModels, setLabStatus } from '../diagnostics'
import { useManifest } from '../useManifest'

interface ModelSource {
  label: string
  resolveAsset?: Live2DAssetResolver
  src: string
}

function reportLine(report: ModelInspectionReport) {
  const available = report.assets.filter(asset => asset.status === 'available').length
  return `${report.status} · ${available}/${report.assets.length} assets · ${report.findings.length} findings`
}

export function AssetsTools() {
  const { error: manifestError, manifest, retry } = useManifest()
  const containerRef = useRef<HTMLDivElement>(null)
  const devtoolsHostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<Live2DInstance | null>(null)
  const devtoolsRef = useRef<Live2DDevtools | null>(null)
  const [debug, setDebug] = useState(false)
  const [draftUrl, setDraftUrl] = useState('')
  const [report, setReport] = useState<ModelInspectionReport | null>(null)
  const [result, setResult] = useState('Waiting for a model source')
  const [source, setSource] = useState<ModelSource | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)

  const dispose = useCallback(() => {
    devtoolsRef.current?.dispose()
    devtoolsRef.current = null
    runtimeRef.current?.dispose()
    runtimeRef.current = null
    setLabModels(0)
    setLabStatus('disposed', '/assets')
  }, [])

  const loadSource = useCallback(async (next: ModelSource) => {
    const container = containerRef.current
    if (!container)
      return
    dispose()
    setSource(next)
    setResult(`Loading ${next.label}…`)
    setLabStatus('loading', '/assets')
    try {
      const runtime = await createLive2D({
        accessibility: { label: `${next.label} asset preview` },
        container,
        coreUrl: CORE_URL,
        debug,
        fit: 'full',
        onError: recordError,
        resolveAsset: next.resolveAsset,
        src: next.src,
      })
      runtimeRef.current = runtime
      setLabModels(1)
      setLabStatus('ready', '/assets')
      setResult(`${next.label} ready`)
      const { inspectModelSource } = await import('live2d-web/inspect')
      setReport(await inspectModelSource({
        resolveAsset: next.resolveAsset,
        src: next.src,
      } as Parameters<typeof inspectModelSource>[0]))
    }
    catch (caught) {
      recordError(caught)
      setLabStatus('error', '/assets')
      const message = caught instanceof Error ? caught.message : String(caught)
      setResult(message)
    }
  }, [debug, dispose])

  useEffect(() => {
    if (manifest && !source) {
      const initial = { label: 'Hiyori URL', src: manifest.model3 }
      void loadSource(initial)
    }
  }, [loadSource, manifest, source])

  useEffect(() => {
    runtimeRef.current?.setDebug(debug)
  }, [debug])

  useEffect(() => {
    const runtime = runtimeRef.current
    const host = devtoolsHostRef.current
    if (!toolsOpen || !runtime || !host) {
      devtoolsRef.current?.dispose()
      devtoolsRef.current = null
      return
    }
    let disposed = false
    void import('live2d-web/devtools').then(({ mountLive2DDevtools }) => {
      if (disposed)
        return
      devtoolsRef.current = mountLive2DDevtools({ container: host, target: runtime })
    }).catch(recordError)
    return () => {
      disposed = true
      devtoolsRef.current?.dispose()
      devtoolsRef.current = null
    }
  }, [result, toolsOpen])

  useEffect(() => dispose, [dispose])

  const loadZip = async (file: File) => {
    try {
      const zip = await JSZip.loadAsync(file)
      const modelPath = Object.keys(zip.files).find(path => path.endsWith('.model3.json'))
      if (!modelPath)
        throw new Error('The archive does not contain a model3.json file.')
      const resolver: Live2DAssetResolver = async (path) => {
        const entry = zip.file(path)
        return entry ? entry.async('arraybuffer') : undefined
      }
      await loadSource({ label: file.name, resolveAsset: resolver, src: modelPath })
    }
    catch (caught) {
      recordError(caught)
      setResult(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const inspectSynthetic = async (kind: 'corrupt' | 'external' | 'reserved') => {
    const calls: string[] = []
    const src = '테스트 #1/모델?.model3.json'
    const model = kind === 'corrupt'
      ? '{broken json'
      : JSON.stringify({
          FileReferences: {
            Moc: '모델%#?.moc3',
            Textures: kind === 'external'
              ? ['https://assets.invalid/texture.png']
              : ['텍스처 한글.png'],
          },
          Version: 3,
        })
    const files = new Map<string, Blob>([
      [src, new Blob([model], { type: 'application/json' })],
      ['테스트 #1/모델%#?.moc3', new Blob([new Uint8Array([1, 2, 3])])],
      ['테스트 #1/텍스처 한글.png', new Blob([new Uint8Array([1, 2, 3])])],
    ])
    const resolveAsset: Live2DAssetResolver = (path) => {
      calls.push(path)
      return files.get(path)
    }
    try {
      const { inspectModelSource } = await import('live2d-web/inspect')
      const inspected = await inspectModelSource({ resolveAsset, src })
      setReport(inspected)
      setResult(`${kind}: ${reportLine(inspected)} · resolved ${calls.join(', ')}`)
    }
    catch (caught) {
      recordError(caught)
      setResult(caught instanceof Error ? caught.message : String(caught))
    }
  }

  return (
    <main>
      <ScenarioHeader eyebrow="Resolvers and optional tools" title="Assets & Tools">
        Load network and archive models, inspect path handling, then mount debug tooling on the same runtime.
      </ScenarioHeader>
      {manifestError && !manifest && <AssetError message={manifestError} retry={retry} />}
      <div className="tools-layout">
        <section className="tools-stage" data-testid="tools-stage">
          <div ref={containerRef} className="runtime-canvas" />
          <output className="stage-diagnostics" data-testid="tools-status">
            <b>{runtimeRef.current ? 'ready' : 'idle'}</b>
            <span>{source?.label ?? 'No model'}</span>
          </output>
        </section>
        <aside className="control-panel">
          <ControlGroup label="Model source">
            <label>
              Model URL
              <input aria-label="Model URL" type="url" value={draftUrl || manifest?.model3 || ''} onChange={event => setDraftUrl(event.target.value)} />
            </label>
            <div className="button-row">
              <button type="button" onClick={() => void loadSource({ label: 'Custom URL', src: draftUrl || manifest?.model3 || '' })}>Load URL</button>
              <button type="button" onClick={() => void loadSource({ label: 'Missing model', src: '/missing.model3.json' })}>Load 404</button>
            </div>
            <label className="file-button">
              Load local zip
              <input
                accept=".zip,application/zip"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file)
                    void loadZip(file)
                }}
              />
            </label>
          </ControlGroup>
          <ControlGroup label="Inspector fixtures">
            <div className="button-row">
              <button type="button" onClick={() => void inspectSynthetic('reserved')}>CJK + reserved paths</button>
              <button type="button" onClick={() => void inspectSynthetic('external')}>External reference</button>
              <button type="button" onClick={() => void inspectSynthetic('corrupt')}>Corrupt model3</button>
            </div>
            {report && <StatusPill state={report.status === 'compatible' ? 'good' : report.status === 'incompatible' ? 'bad' : 'warn'}>{reportLine(report)}</StatusPill>}
          </ControlGroup>
          <ControlGroup label="Runtime tools">
            <label className="toggle">
              <input checked={debug} type="checkbox" onChange={event => setDebug(event.target.checked)} />
              {' '}
              Placement overlay
            </label>
            <label className="toggle">
              <input checked={toolsOpen} type="checkbox" onChange={event => setToolsOpen(event.target.checked)} />
              {' '}
              Mount devtools
            </label>
          </ControlGroup>
          <output data-testid="asset-result">{result}</output>
        </aside>
      </div>
      <section ref={devtoolsHostRef} className="devtools-host" data-testid="lab-devtools" hidden={!toolsOpen} />
    </main>
  )
}
