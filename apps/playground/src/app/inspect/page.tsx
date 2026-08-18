'use client'

import type {
  Live2DErrorDetails,
  ModelFit,
} from 'live2d-web'
import type { Live2DModelController } from 'live2d-web/react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { InspectorModelMetadata } from '../../inspector/modelMetadata'
import { Live2DError } from 'live2d-web'
import {
  Live2DCanvas,
  Live2DModel,
  useLive2DCanvas,
} from 'live2d-web/react'
import { useSearchParams } from 'next/navigation'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { resolveInspectorModelUrl } from '../../inspector/modelMetadata'

interface AssetManifest {
  model3: string
}

type ResolutionMode = 'auto' | '1' | '2'

function initialInspectorInput(value: string | null) {
  if (!value)
    return { draft: '', source: undefined }
  try {
    resolveInspectorModelUrl(value, 'https://live2d-web.invalid/inspect')
    return { draft: value, source: value }
  }
  catch (error) {
    return {
      draft: value,
      error: new Live2DError(
        'invalid-props',
        error instanceof Error ? error.message : String(error),
      ),
      source: undefined,
    }
  }
}

function ErrorDetails({ details }: { details?: Readonly<Live2DErrorDetails> }) {
  if (!details)
    return null
  return (
    <dl className="error-details">
      {details.backend && (
        <>
          <dt>Backend</dt>
          <dd>{details.backend}</dd>
        </>
      )}
      {details.assetType && (
        <>
          <dt>Asset</dt>
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

function InspectorContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('src')
  const [initialInput] = useState(() => initialInspectorInput(initialQuery))
  const [draftSource, setDraftSource] = useState(initialInput.draft)
  const [source, setSource] = useState<string | undefined>(initialInput.source)
  const [generation, setGeneration] = useState(0)
  const [metadata, setMetadata] = useState<InspectorModelMetadata>()
  const [metadataError, setMetadataError] = useState<Live2DError | undefined>(
    initialInput.error,
  )
  const [runtimeError, setRuntimeError] = useState<Live2DError>()
  const [operationError, setOperationError] = useState('')
  const [controller, setController] = useState<Live2DModelController | null>(null)
  const [fit, setFit] = useState<ModelFit>('upper-body')
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>('auto')
  const [motionValue, setMotionValue] = useState('')
  const [expression, setExpression] = useState('')
  const [parameterId, setParameterId] = useState('ParamMouthOpenY')
  const [parameterValue, setParameterValue] = useState(0.5)
  const [parameterReadback, setParameterReadback] = useState<number>()
  const [pointerFocus, setPointerFocus] = useState(true)

  const prepareSource = useCallback((resolved: string) => {
    setController(null)
    setMetadata(undefined)
    setMetadataError(undefined)
    setRuntimeError(undefined)
    setOperationError('')
    setParameterReadback(undefined)
    setDraftSource(resolved)
    setSource(resolved)
    setGeneration(value => value + 1)
  }, [])

  useEffect(() => {
    if (initialQuery)
      return

    const abortController = new AbortController()
    fetch('/assets/live2d/hiyori/manifest.json', { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Live2DError(
            'model-load-failed',
            'Run `LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets` before using the inspector.',
            {
              details: {
                assetType: 'model3',
                httpStatus: response.status,
                url: response.url,
              },
            },
          )
        }
        return response.json() as Promise<AssetManifest>
      })
      .then((manifest) => {
        const resolved = resolveInspectorModelUrl(manifest.model3, window.location.href)
        prepareSource(resolved)
      })
      .catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          setMetadataError(error instanceof Live2DError
            ? error
            : new Live2DError('model-load-failed', String(error), { cause: error }))
        }
      })
    return () => abortController.abort()
  }, [initialQuery, prepareSource])

  const canvasQuality = resolutionMode === 'auto'
    ? { quality: 'auto' as const }
    : { resolution: Number(resolutionMode) }

  const submitSource = (event: FormEvent) => {
    event.preventDefault()
    try {
      const resolved = resolveInspectorModelUrl(draftSource, window.location.href)
      prepareSource(resolved)
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('src', resolved)
      window.history.replaceState(null, '', nextUrl)
    }
    catch (error) {
      setMetadataError(new Live2DError(
        'invalid-props',
        error instanceof Error ? error.message : String(error),
      ))
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

  const moveFocus = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointerFocus || !controller)
      return
    const rect = event.currentTarget.getBoundingClientRect()
    controller.focus(event.clientX - rect.left, event.clientY - rect.top)
  }

  const visibleError = runtimeError ?? metadataError
  const sourceKey = `${source ?? 'empty'}:${generation}:${resolutionMode}`
  const motionOptions = useMemo(() => metadata?.motions ?? [], [metadata])

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Model inspector</p>
          <h1>Test your model3.json</h1>
          <p>
            Load a same-origin or CORS-enabled Cubism 4/5 model URL and inspect
            its motions, expressions, parameters and rendering quality.
          </p>
        </div>
        <nav>
          <a href="/">React playground</a>
          <a href="/vanilla">Vanilla playground</a>
          <a href="/compare">Backend comparison</a>
        </nav>
      </header>

      <form className="source-form" onSubmit={submitSource}>
        <label>
          model3.json URL
          <input
            aria-label="model3.json URL"
            placeholder="https://example.com/model/model.model3.json"
            inputMode="url"
            type="text"
            value={draftSource}
            onChange={event => setDraftSource(event.target.value)}
          />
        </label>
        <button type="submit">Load model</button>
      </form>

      <section className="workspace">
        <div
          className="stage-shell"
          data-testid="inspector-stage"
          onPointerMove={moveFocus}
        >
          {source
            ? (
                <Live2DCanvas
                  key={sourceKey}
                  coreUrl="/assets/js/cubism/5.3/live2dcubismcore.min.js"
                  {...canvasQuality}
                  fallback={stage => (
                    <div className="stage-overlay">
                      Loading
                      {stage}
                      …
                    </div>
                  )}
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
                        Retry canvas
                      </button>
                    </div>
                  )}
                >
                  <Live2DModel
                    fit={fit}
                    src={source}
                    onLoad={(nextController) => {
                      setRuntimeError(undefined)
                      setController(nextController)
                      // The library owns model metadata now; no second fetch
                      // and no hand parsing of model3.json.
                      const info = nextController.getModelInfo()
                      const motions = Object.entries(info.motions).flatMap(
                        ([group, count]) => Array.from(
                          { length: count },
                          (_, index) => ({ group, index }),
                        ),
                      )
                      setMetadata({ expressions: info.expressions, motions })
                      const firstMotion = motions[0]
                      setMotionValue(
                        firstMotion ? `${firstMotion.group}:${firstMotion.index}` : '',
                      )
                      setExpression(info.expressions[0] ?? '')
                    }}
                    onError={setRuntimeError}
                  />
                  <Diagnostics />
                </Live2DCanvas>
              )
            : <div className="empty-stage">Enter a model3.json URL.</div>}
        </div>

        <aside className="inspector-controls">
          <label>
            Framing
            <select value={fit as string} onChange={event => setFit(event.target.value as ModelFit)}>
              <option value="upper-body">Upper body</option>
              <option value="full">Full model</option>
            </select>
          </label>

          <label>
            Resolution
            <select
              aria-label="Resolution"
              value={resolutionMode}
              onChange={(event) => {
                setController(null)
                setResolutionMode(event.target.value as ResolutionMode)
              }}
            >
              <option value="auto">Auto</option>
              <option value="1">1×</option>
              <option value="2">2×</option>
            </select>
          </label>

          <label>
            Motion
            <select
              aria-label="Motion"
              disabled={!motionOptions.length}
              value={motionValue}
              onChange={event => setMotionValue(event.target.value)}
            >
              {!motionOptions.length && <option value="">No motions</option>}
              {motionOptions.map(motion => (
                <option
                  key={`${motion.group}:${motion.index}`}
                  value={`${motion.group}:${motion.index}`}
                >
                  {motion.group}
                  [
                  {motion.index}
                  ]
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!controller || !motionValue}
            onClick={() => void runOperation(async () => {
              const separator = motionValue.lastIndexOf(':')
              await controller?.motion(
                motionValue.slice(0, separator),
                Number(motionValue.slice(separator + 1)),
              )
            })}
          >
            Play motion
          </button>

          <label>
            Expression
            <select
              aria-label="Expression"
              disabled={!metadata?.expressions.length}
              value={expression}
              onChange={event => setExpression(event.target.value)}
            >
              {!metadata?.expressions.length && <option value="">No expressions</option>}
              {metadata?.expressions.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <button
            type="button"
            disabled={!controller || !expression}
            onClick={() => void runOperation(() => controller?.expression(expression))}
          >
            Apply expression
          </button>

          <label>
            Parameter ID
            <input value={parameterId} onChange={event => setParameterId(event.target.value)} />
          </label>
          <label>
            Parameter value
            <input
              aria-label="Parameter value"
              step="0.01"
              type="number"
              value={parameterValue}
              onChange={event => setParameterValue(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={!controller || !parameterId.trim() || !Number.isFinite(parameterValue)}
            onClick={() => void runOperation(() => {
              controller?.setParameter(parameterId.trim(), parameterValue)
              setParameterReadback(controller?.getParameter(parameterId.trim()))
            })}
          >
            Set parameter
          </button>
          {parameterReadback !== undefined && (
            <output data-testid="parameter-readback">
              {parameterId.trim()}
              {' = '}
              {parameterReadback.toFixed(3)}
            </output>
          )}

          <label className="toggle">
            <input
              checked={pointerFocus}
              type="checkbox"
              onChange={event => setPointerFocus(event.target.checked)}
            />
            Follow pointer
          </label>

          {visibleError && (
            <div className="inline-error" role="alert">
              <strong>{visibleError.code}</strong>
              <p>{visibleError.message}</p>
              <ErrorDetails details={visibleError.details} />
            </div>
          )}
          {operationError && <p className="inline-error" role="alert">{operationError}</p>}
          <p className="note">
            Remote model and referenced assets must allow CORS. Cubism Core and
            sample models remain application-provided assets.
          </p>
        </aside>
      </section>
    </main>
  )
}

export default function InspectorPage() {
  return (
    <Suspense fallback={<main>Loading inspector…</main>}>
      <InspectorContent />
    </Suspense>
  )
}
