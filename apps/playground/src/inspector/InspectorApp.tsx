'use client'

import type {
  Live2DAssetResolver,
  Live2DError,
  Live2DErrorDetails,
  ModelFit,
} from 'live2d-web'
import type { ModelCapabilityReport, ModelInspectionReport } from 'live2d-web/inspect'
import type { Live2DModelController } from 'live2d-web/react'
import type { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { AssetManifest } from '../lib/assetManifest'
import type { LocalModelArchive } from './archiveSource'
import { inspectModelCapabilities, inspectModelSource } from 'live2d-web/inspect'
import { Live2DCanvas, Live2DModel, useLive2DCanvas } from 'live2d-web/react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { StageLoading } from '../components/StageLoading'
import { useSiteLocale, useSiteMessages } from '../i18n/SiteLocale'
import { CUBISM_CORE_URL } from '../lib/assetManifest'
import { readModelArchive } from './archive'
import { createArchiveResolver } from './archiveSource'
import { resolveInspectorModelUrl } from './modelMetadata'

type ResolutionMode = 'auto' | '1' | '2'
type InputMode = 'url' | 'zip'

interface ModelCandidate {
  label: string
  resolveAsset?: Live2DAssetResolver
  src: string
}

const subscribeToLocation = () => () => {}
const getLocationQuery = () => new URLSearchParams(window.location.search).get('src')
const getServerQuery = () => undefined

function ErrorDetails({ details }: { details?: Readonly<Live2DErrorDetails> }) {
  const messages = useSiteMessages().inspector
  if (!details)
    return null
  return (
    <dl className="error-details">
      {details.backend && (
        <>
          <dt>{messages.backend}</dt>
          <dd>{details.backend}</dd>
        </>
      )}
      {details.assetType && (
        <>
          <dt>{messages.asset}</dt>
          <dd>{details.assetType}</dd>
        </>
      )}
      {details.httpStatus !== undefined && (
        <>
          <dt>HTTP</dt>
          <dd>{details.httpStatus}</dd>
        </>
      )}
      {details.url && (
        <>
          <dt>URL</dt>
          <dd>{details.url}</dd>
        </>
      )}
    </dl>
  )
}

function Diagnostics() {
  const state = useLive2DCanvas()
  return (
    <output className="diagnostics" data-testid="inspector-status">
      <strong>{state.status}</strong>
      {state.loadingStage && <span>{state.loadingStage}</span>}
      {state.render && (
        <>
          <span>
            {state.render.resolution.toFixed(2)}
            ×
          </span>
          <span>
            {(state.render.bufferPixels / 1_000_000).toFixed(2)}
            {' '}
            MP
          </span>
        </>
      )}
    </output>
  )
}

function reportText(report: ModelInspectionReport, capabilities?: ModelCapabilityReport) {
  const lines = [
    `Status: ${report.status}`,
    `Source: ${report.source}`,
    `model3 version: ${report.model3Version ?? 'unknown'}`,
    `Assets: ${report.assets.filter(asset => asset.status === 'available').length}/${report.assets.length} available`,
    `Motions: ${Object.entries(report.motions).map(([group, count]) => `${group} (${count})`).join(', ') || 'none'}`,
    `Expressions: ${report.expressions.join(', ') || 'none'}`,
  ]
  if (capabilities) {
    lines.push(
      `moc version: ${capabilities.mocVersion ?? 'unknown'}`,
      `Tracking: ${capabilities.recommendedMapping}`,
      `Perfect Sync: ${capabilities.perfectSync.matched}/${capabilities.perfectSync.total}`,
    )
  }
  for (const finding of report.findings)
    lines.push(`${finding.severity.toUpperCase()} ${finding.code}: ${finding.message}`)
  return lines.join('\n')
}

function InspectionReport({ capabilities, onCopy, report }: {
  capabilities?: ModelCapabilityReport
  onCopy: (value: string) => void
  report: ModelInspectionReport
}) {
  const messages = useSiteMessages().inspector
  const available = report.assets.filter(asset => asset.status === 'available').length
  return (
    <section className="inspection-report" data-testid="inspection-report">
      <div className="inspection-summary">
        <strong data-status={report.status}>{report.status}</strong>
        <span>
          {available}
          /
          {report.assets.length}
          {' '}
          {messages.assets}
        </span>
        <span>
          model3
          {report.model3Version ?? '?'}
        </span>
        {capabilities?.mocVersion !== undefined && (
          <span>
            moc
            {capabilities.mocVersion}
          </span>
        )}
      </div>
      {report.findings.length > 0 && (
        <ul className="inspection-findings">
          {report.findings.map((finding, index) => (
            <li key={`${finding.code}:${finding.path ?? index}`} data-severity={finding.severity}>
              <strong>{finding.code}</strong>
              <span>{finding.message}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="inspection-grid">
        <div>
          <h2>{messages.modelContents}</h2>
          <p>
            {messages.motions}
            {': '}
            {Object.entries(report.motions).map(([group, count]) => `${group} (${count})`).join(', ') || messages.none}
          </p>
          <p>
            {messages.expressions}
            {': '}
            {report.expressions.join(', ') || messages.none}
          </p>
          <p>
            {messages.hitAreas}
            {': '}
            {report.hitAreas.join(', ') || messages.none}
          </p>
        </div>
        <div>
          <h2>{messages.faceTracking}</h2>
          {capabilities
            ? (
                <>
                  <p>
                    {messages.recommended}
                    {': '}
                    <strong>{capabilities.recommendedMapping}</strong>
                  </p>
                  <p>
                    Perfect Sync:
                    {capabilities.perfectSync.matched}
                    /
                    {capabilities.perfectSync.total}
                    {' '}
                    (minimum
                    {capabilities.perfectSync.minimum}
                    )
                  </p>
                  <p>
                    {messages.standard}
                    {': '}
                    {Object.entries(capabilities.standardChannels).map(([channel, support]) => `${channel} ${support}`).join(', ')}
                  </p>
                </>
              )
            : <p>{messages.chooseCompatible}</p>}
        </div>
      </div>
      <details>
        <summary>{messages.assetDetails}</summary>
        <ul className="asset-list">
          {report.assets.map(asset => (
            <li key={`${asset.assetType}:${asset.path}`}>
              <span>{asset.assetType}</span>
              <code>{asset.path}</code>
              <span>
                {asset.status}
                {asset.bytes === undefined ? '' : ` · ${asset.bytes} B`}
              </span>
            </li>
          ))}
        </ul>
      </details>
      <div className="report-actions">
        <button type="button" onClick={() => onCopy(JSON.stringify({ ...report, capabilities }, null, 2))}>{messages.copyJson}</button>
        <button type="button" onClick={() => onCopy(reportText(report, capabilities))}>{messages.copyText}</button>
      </div>
    </section>
  )
}

export function InspectorApp() {
  const locale = useSiteLocale()
  const messages = useSiteMessages()
  const inspectionAbortRef = useRef<AbortController>(undefined)
  const initialQuery = useSyncExternalStore(subscribeToLocation, getLocationQuery, getServerQuery)
  const [inputMode, setInputMode] = useState<InputMode>('url')
  const [draftSource, setDraftSource] = useState<string>()
  const [archive, setArchive] = useState<LocalModelArchive>()
  const [archiveCandidate, setArchiveCandidate] = useState('')
  const [candidate, setCandidate] = useState<ModelCandidate>()
  const [pendingWarning, setPendingWarning] = useState<ModelCandidate>()
  const [report, setReport] = useState<ModelInspectionReport>()
  const [capabilities, setCapabilities] = useState<ModelCapabilityReport>()
  const [inspecting, setInspecting] = useState(true)
  const [generation, setGeneration] = useState(0)
  const [runtimeError, setRuntimeError] = useState<Live2DError>()
  const [operationError, setOperationError] = useState('')
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('auto')
  const [motionValue, setMotionValue] = useState('')
  const [expression, setExpression] = useState('')
  const [pointerFocus, setPointerFocus] = useState(true)

  const resetModel = useCallback(() => {
    setCandidate(undefined)
    setPendingWarning(undefined)
    setController(null)
    setCapabilities(undefined)
    setRuntimeError(undefined)
    setOperationError('')
    setGeneration(value => value + 1)
  }, [])

  const inspectCandidate = useCallback(async (next: ModelCandidate) => {
    inspectionAbortRef.current?.abort()
    const abortController = new AbortController()
    inspectionAbortRef.current = abortController
    resetModel()
    setReport(undefined)
    setInspecting(true)
    try {
      const nextReport = next.resolveAsset
        ? await inspectModelSource({
            resolveAsset: next.resolveAsset,
            signal: abortController.signal,
            src: next.src,
          })
        : await inspectModelSource({ signal: abortController.signal, src: next.src })
      if (abortController.signal.aborted)
        return
      setReport(nextReport)
      if (nextReport.status === 'compatible')
        setCandidate(next)
      else if (nextReport.status === 'warning')
        setPendingWarning(next)
    }
    catch (error) {
      if (!abortController.signal.aborted)
        setOperationError(error instanceof Error ? error.message : String(error))
    }
    finally {
      if (inspectionAbortRef.current === abortController) {
        inspectionAbortRef.current = undefined
        setInspecting(false)
      }
    }
  }, [resetModel])

  useEffect(() => () => inspectionAbortRef.current?.abort(), [])

  useEffect(() => {
    if (initialQuery === undefined)
      return
    if (initialQuery) {
      void (async () => {
        try {
          const resolved = resolveInspectorModelUrl(initialQuery, window.location.href)
          await inspectCandidate({ label: resolved, src: resolved })
        }
        catch (error) {
          setOperationError(error instanceof Error ? error.message : String(error))
        }
      })()
      return
    }
    const abortController = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(messages.inspector.assetsMissing)
        return response.json() as Promise<AssetManifest>
      })
      .then((manifest) => {
        const resolved = resolveInspectorModelUrl(manifest.model3, window.location.href)
        setDraftSource(resolved)
        return inspectCandidate({ label: 'Hiyori', src: resolved })
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setOperationError(error instanceof Error ? error.message : String(error))
          setInspecting(false)
        }
      })
    return () => abortController.abort()
  }, [initialQuery, inspectCandidate, messages.inspector.assetsMissing])

  const submitSource = (event: FormEvent) => {
    event.preventDefault()
    try {
      const resolved = resolveInspectorModelUrl(draftSource ?? initialQuery ?? '', window.location.href)
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('src', resolved)
      window.history.replaceState(null, '', nextUrl)
      void inspectCandidate({ label: resolved, src: resolved })
    }
    catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error))
    }
  }

  const openArchive = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file)
      return
    inspectionAbortRef.current?.abort()
    const abortController = new AbortController()
    inspectionAbortRef.current = abortController
    resetModel()
    setReport(undefined)
    setArchive(undefined)
    setInspecting(true)
    try {
      const source = await readModelArchive(file, abortController.signal)
      if (abortController.signal.aborted)
        return
      setArchive(source)
      const first = source.candidates[0]
      setArchiveCandidate(first)
      if (inspectionAbortRef.current === abortController)
        inspectionAbortRef.current = undefined
      await inspectCandidate({
        label: `${source.label} · ${first}`,
        resolveAsset: createArchiveResolver(source),
        src: first,
      })
    }
    catch (error) {
      if (!abortController.signal.aborted)
        setOperationError(error instanceof Error ? error.message : String(error))
    }
    finally {
      if (inspectionAbortRef.current === abortController) {
        inspectionAbortRef.current = undefined
        setInspecting(false)
      }
    }
  }

  const selectArchiveCandidate = (path: string) => {
    setArchiveCandidate(path)
    if (archive) {
      void inspectCandidate({
        label: `${archive.label} · ${path}`,
        resolveAsset: createArchiveResolver(archive),
        src: path,
      })
    }
  }

  const runOperation = async (operation: () => Promise<void> | void) => {
    setOperationError('')
    try {
      await operation()
    }
    catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error))
    }
  }
  const copy = (value: string) => void runOperation(() => navigator.clipboard.writeText(value))
  const moveFocus = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerFocus || !controller)
      return
    const rect = event.currentTarget.getBoundingClientRect()
    controller.focus(event.clientX - rect.left, event.clientY - rect.top)
  }

  const canvasQuality = resolutionMode === 'auto'
    ? { quality: 'auto' as const }
    : { resolution: Number(resolutionMode) }
  const sourceKey = `${candidate?.label ?? 'empty'}:${generation}:${resolutionMode}`
  const motionOptions = useMemo(
    () => Object.entries(report?.motions ?? {}).flatMap(([group, count]) =>
      Array.from({ length: count }, (_, index) => ({ group, index }))),
    [report],
  )

  return (
    <main className="inspector-page" lang={locale}>
      <section className="page-hero">
        <div>
          <p className="eyebrow">{messages.inspector.eyebrow}</p>
          <h1>{messages.inspector.title}</h1>
          <p>{messages.inspector.description}</p>
        </div>
      </section>

      <div className="input-tabs" role="tablist" aria-label={messages.inspector.modelSource}>
        <button aria-selected={inputMode === 'url'} role="tab" type="button" onClick={() => setInputMode('url')}>{messages.inspector.modelUrl}</button>
        <button aria-selected={inputMode === 'zip'} role="tab" type="button" onClick={() => setInputMode('zip')}>{messages.inspector.localZip}</button>
      </div>
      {inputMode === 'url'
        ? (
            <form className="source-form" onSubmit={submitSource}>
              <label>
                {messages.inspector.urlLabel}
                <input aria-label={messages.inspector.urlLabel} inputMode="url" placeholder="https://example.com/model/model.model3.json" type="text" value={draftSource ?? initialQuery ?? ''} onChange={event => setDraftSource(event.target.value)} />
              </label>
              <button disabled={inspecting} type="submit">{inspecting ? messages.inspector.inspecting : messages.inspector.inspectUrl}</button>
            </form>
          )
        : (
            <section className="archive-picker">
              <label className="archive-drop">
                <span>{inspecting ? messages.inspector.readingArchive : messages.inspector.chooseZip}</span>
                <input accept=".zip,application/zip" disabled={inspecting} type="file" onChange={event => void openArchive(event)} />
              </label>
              {archive && archive.candidates.length > 1 && (
                <label>
                  {messages.inspector.zipModel}
                  <select value={archiveCandidate} onChange={event => selectArchiveCandidate(event.target.value)}>
                    {archive.candidates.map(path => <option key={path}>{path}</option>)}
                  </select>
                </label>
              )}
              <p className="note">{messages.inspector.archiveLimits}</p>
            </section>
          )}

      <section className="workspace inspector-workspace">
        <div className="stage-shell" data-testid="inspector-stage" onPointerMove={moveFocus}>
          {candidate
            ? (
                <Live2DCanvas
                  accessibility={{ label: `${candidate.label} ${messages.inspector.modelPreview}` }}
                  key={sourceKey}
                  coreUrl={CUBISM_CORE_URL}
                  {...canvasQuality}
                  fallback={() => <StageLoading delayMs={150} />}
                  onError={setRuntimeError}
                  errorFallback={(error, retry) => (
                    <div className="stage-overlay error-panel" role="alert">
                      <strong>{error.code}</strong>
                      <p>{error.message}</p>
                      <ErrorDetails details={error.details} />
                      <button
                        type="button"
                        onClick={() => {
                          setRuntimeError(undefined)
                          retry()
                        }}
                      >
                        {messages.inspector.retry}
                      </button>
                    </div>
                  )}
                >
                  <Live2DModel
                    fit={fit}
                    resolveAsset={candidate.resolveAsset}
                    src={candidate.src}
                    onError={setRuntimeError}
                    onLoad={(nextController) => {
                      setRuntimeError(undefined)
                      setController(nextController)
                      const info = nextController.getModelInfo()
                      setCapabilities(inspectModelCapabilities(info))
                      const firstMotion = Object.entries(info.motions).find(([, count]) => count > 0)
                      setMotionValue(firstMotion ? `${firstMotion[0]}:0` : '')
                      setExpression(info.expressions[0] ?? '')
                    }}
                  />
                  <Diagnostics />
                </Live2DCanvas>
              )
            : inspecting
              ? <StageLoading delayMs={150} />
              : <div className="empty-stage">{messages.inspector.chooseCompatible}</div>}
        </div>

        <aside className="inspector-controls">
          <label>
            {messages.inspector.framing}
            <select value={fit as string} onChange={event => setFit(event.target.value as ModelFit)}>
              <option value="upper-body">{messages.common.upperBody}</option>
              <option value="full">{messages.common.fullModel}</option>
            </select>
          </label>
          <label>
            {messages.inspector.motions}
            <select aria-label={messages.inspector.motions} disabled={!motionOptions.length} value={motionValue} onChange={event => setMotionValue(event.target.value)}>
              {!motionOptions.length && <option value="">{messages.inspector.noMotions}</option>}
              {motionOptions.map(motion => (
                <option key={`${motion.group}:${motion.index}`} value={`${motion.group}:${motion.index}`}>
                  {motion.group}
                  [
                  {motion.index}
                  ]
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!controller || !motionValue}
            type="button"
            onClick={() => void runOperation(async () => {
              const separator = motionValue.lastIndexOf(':')
              await controller?.motion(motionValue.slice(0, separator), Number(motionValue.slice(separator + 1)))
            })}
          >
            {messages.inspector.playMotion}
          </button>
          <label>
            {messages.inspector.expression}
            <select aria-label={messages.inspector.expression} disabled={!report?.expressions.length} value={expression} onChange={event => setExpression(event.target.value)}>
              {!report?.expressions.length && <option value="">{messages.inspector.noExpressions}</option>}
              {report?.expressions.map(id => <option key={id}>{id}</option>)}
            </select>
          </label>
          <button disabled={!controller || !expression} type="button" onClick={() => void runOperation(() => controller?.expression(expression))}>{messages.inspector.applyExpression}</button>
          <label className="toggle">
            <input checked={pointerFocus} type="checkbox" onChange={event => setPointerFocus(event.target.checked)} />
            {messages.inspector.followPointer}
          </label>
          <details className="playground-more">
            <summary>{messages.common.advanced}</summary>
            <div className="playground-more-body">
              <label>
                {messages.inspector.resolution}
                <select
                  aria-label={messages.inspector.resolution}
                  value={resolutionMode}
                  onChange={(event) => {
                    setController(null)
                    setResolutionMode(event.target.value as ResolutionMode)
                  }}
                >
                  <option value="auto">{messages.common.auto}</option>
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                </select>
              </label>
            </div>
          </details>
          {runtimeError && (
            <div className="inline-error" role="alert">
              <strong>{runtimeError.code}</strong>
              <p>{runtimeError.message}</p>
              <ErrorDetails details={runtimeError.details} />
            </div>
          )}
        </aside>
      </section>

      {(report || pendingWarning || operationError) && (
        <section className="inspection-feedback" aria-label={messages.inspector.inspectionResults}>
          {pendingWarning && (
            <button
              className="warning-load"
              type="button"
              onClick={() => {
                setCandidate(pendingWarning)
                setPendingWarning(undefined)
              }}
            >
              {messages.inspector.renderDespite}
            </button>
          )}
          {operationError && <p className="inline-error" role="alert">{operationError}</p>}
          {report && <InspectionReport capabilities={capabilities} report={report} onCopy={copy} />}
        </section>
      )}
    </main>
  )
}
