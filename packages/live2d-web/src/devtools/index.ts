import type {
  ExpressionOptions,
  ModelInfo,
  MotionOptions,
  MotionPlaybackResult,
  MotionSequenceResult,
  MotionSequenceStep,
} from '../core/contract'
import type {
  Live2DRuntimeState,
  ParameterDriver,
} from '../core/runtime'
import { Live2DError } from '../core/errors'
import { DEVTOOLS_STYLES } from './styles'

export type Live2DDevtoolsTab = 'overview' | 'parameters' | 'motion' | 'expression'

export interface Live2DDevtoolsTarget {
  getModelInfo: () => ModelInfo
  getParameter: (id: string) => number
  addParameterDriver: (id: string, driver: ParameterDriver) => () => void
  isMotionPlaying: () => boolean
  playMotion: (
    group: string,
    index?: number,
    options?: MotionOptions,
  ) => Promise<MotionPlaybackResult>
  sequence: (
    steps: readonly MotionSequenceStep[],
  ) => Promise<MotionSequenceResult>
  expression: (id?: string, options?: ExpressionOptions) => Promise<void>
  clearExpression: () => void
  getState?: () => Live2DRuntimeState
  subscribe?: (listener: () => void) => () => void
}

export interface Live2DDevtools {
  setTarget: (target: Live2DDevtoolsTarget) => void
  setTab: (tab: Live2DDevtoolsTab) => void
  dispose: () => void
}

export interface MountLive2DDevtoolsOptions {
  target: Live2DDevtoolsTarget
  container: HTMLElement
  initialTab?: Live2DDevtoolsTab
}

const TABS: readonly Live2DDevtoolsTab[] = [
  'overview',
  'parameters',
  'motion',
  'expression',
]

function invalid(message: string): never {
  throw new Live2DError('invalid-props', message)
}

function assertTarget(target: unknown): asserts target is Live2DDevtoolsTarget {
  if (!target || typeof target !== 'object')
    invalid('Devtools target must be a Live2D instance or model controller.')
  const required = [
    'getModelInfo',
    'getParameter',
    'addParameterDriver',
    'isMotionPlaying',
    'playMotion',
    'sequence',
    'expression',
    'clearExpression',
  ] as const
  for (const method of required) {
    if (typeof (target as Record<string, unknown>)[method] !== 'function')
      invalid(`Devtools target must provide ${method}().`)
  }
}

function assertTab(tab: unknown): asserts tab is Live2DDevtoolsTab {
  if (!TABS.includes(tab as Live2DDevtoolsTab))
    invalid(`Unknown Devtools tab: ${String(tab)}.`)
}

function escape(value: unknown) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}

function finiteInput(value: string): number | undefined {
  if (value.trim() === '')
    return undefined
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0)
    invalid('Fade values must be finite, non-negative milliseconds.')
  return number
}

function option(value: string, label = value) {
  return `<option value="${escape(value)}">${escape(label)}</option>`
}

function findByData<T extends HTMLElement>(
  root: ShadowRoot,
  attribute: string,
  value: string,
) {
  return Array.from(root.querySelectorAll<T>(`[data-${attribute}]`))
    .find(element => element.dataset[attribute.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] === value)
}

/** Mounts a framework-free debugging panel for one loaded Live2D target. */
export function mountLive2DDevtools(
  options: MountLive2DDevtoolsOptions,
): Live2DDevtools {
  if (typeof document === 'undefined')
    throw new Live2DError('browser-only', 'Live2D Devtools can only be mounted in a browser.')
  if (!options || typeof options !== 'object')
    invalid('mountLive2DDevtools options must be an object.')
  assertTarget(options.target)
  if (!(options.container instanceof HTMLElement))
    invalid('mountLive2DDevtools container must be an HTMLElement.')
  const initialTab = options.initialTab ?? 'overview'
  assertTab(initialTab)

  const host = document.createElement('div')
  host.dataset.live2dDevtools = ''
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = DEVTOOLS_STYLES
  const shell = document.createElement('div')
  shell.className = 'shell'
  shadow.append(style, shell)
  options.container.append(host)

  let target = options.target
  let tab = initialTab
  let disposed = false
  let unsubscribe: (() => void) | undefined
  let parameterFrame: number | undefined
  let lastParameterSample = 0
  let status = 'Ready'
  let statusError = false
  let sequence: MotionSequenceStep[] = []
  const overrides = new Map<string, { cleanup: () => void, value: number }>()

  const stopSampling = () => {
    if (parameterFrame !== undefined)
      cancelAnimationFrame(parameterFrame)
    parameterFrame = undefined
  }
  const clearOverrides = () => {
    for (const entry of overrides.values())
      entry.cleanup()
    overrides.clear()
  }
  const readInfo = () => target.getModelInfo()
  const renderStatus = () => {
    const output = shadow.querySelector<HTMLOutputElement>('[data-status]')
    if (!output)
      return
    output.textContent = status
    output.dataset.error = String(statusError)
  }
  const showError = (error: unknown) => {
    status = error instanceof Error ? error.message : String(error)
    statusError = true
    renderStatus()
  }
  const showStatus = (message: string) => {
    status = message
    statusError = false
    renderStatus()
  }

  const diagnostic = () => {
    const info = readInfo()
    const parameters = Object.fromEntries((info.parameters ?? []).map(parameter => [
      parameter.id,
      target.getParameter(parameter.id),
    ]))
    return {
      runtime: target.getState?.(),
      model: {
        model3Version: info.model3Version,
        mocVersion: info.mocVersion,
        motions: info.motions,
        expressions: info.expressions,
        hitAreas: info.hitAreas,
        parameters,
      },
    }
  }

  const overviewPanel = (info: ModelInfo) => {
    const state = target.getState?.()
    return `<div class="stack">
      <section class="card">
        <h3>Runtime</h3>
        <div class="row"><span class="muted">Status</span><span class="value">${escape(state?.status ?? 'model controller')}</span></div>
        <div class="row"><span class="muted">Motion</span><span class="value">${target.isMotionPlaying() ? 'playing' : 'idle'}</span></div>
        ${state?.render ? `<div class="row"><span class="muted">Buffer</span><span class="value">${state.render.width}×${state.render.height} @ ${state.render.resolution.toFixed(2)}</span></div>` : ''}
      </section>
      <section class="card">
        <h3>Model</h3>
        <div class="row"><span class="muted">model3 / moc</span><span class="value">${escape(info.model3Version ?? 'unknown')} / ${escape(info.mocVersion ?? 'unknown')}</span></div>
        <div class="row"><span class="muted">Parameters</span><span class="value">${info.parameters?.length ?? 0}</span></div>
        <div class="row"><span class="muted">Motion groups</span><span class="value">${Object.keys(info.motions).length}</span></div>
        <div class="row"><span class="muted">Expressions</span><span class="value">${info.expressions.length}</span></div>
        <div class="row"><span class="muted">Hit areas</span><span class="value">${info.hitAreas.length}</span></div>
      </section>
      <button data-action="copy-diagnostic" type="button">Copy diagnostic JSON</button>
    </div>`
  }

  const parametersPanel = (info: ModelInfo) => {
    const parameters = info.parameters ?? []
    if (!parameters.length)
      return '<p class="empty">This backend does not expose parameter metadata.</p>'
    return `<div class="stack">
      <label class="field"><span>Search parameters</span><input data-parameter-search type="text" placeholder="ParamAngleX"></label>
      <div data-parameter-list>${parameters.map((parameter) => {
        const current = overrides.get(parameter.id)?.value ?? target.getParameter(parameter.id)
        return `<div class="parameter" data-parameter="${escape(parameter.id)}">
          <div class="row"><span class="parameter-name">${escape(parameter.id)}</span><output class="value" data-param-value="${escape(parameter.id)}">${current.toFixed(3)}</output></div>
          <div class="parameter-controls">
            <input aria-label="${escape(parameter.id)}" data-param-slider="${escape(parameter.id)}" type="range" min="${parameter.minimum}" max="${parameter.maximum}" step="${Math.max((parameter.maximum - parameter.minimum) / 1000, 0.001)}" value="${current}">
            <button data-reset-param="${escape(parameter.id)}" type="button">Reset</button>
          </div>
        </div>`
      }).join('')}</div>
    </div>`
  }

  const motionPanel = (info: ModelInfo) => {
    const groups = Object.keys(info.motions)
    if (!groups.length)
      return '<p class="empty">This model declares no motions.</p>'
    const group = groups[0]!
    return `<div class="stack">
      <label class="field"><span>Group</span><select data-motion-group>${groups.map(value => option(value)).join('')}</select></label>
      <label class="field"><span>Index</span><input data-motion-index type="number" min="0" max="${Math.max(0, info.motions[group]! - 1)}" value="0"></label>
      <label class="field"><span>Priority</span><select data-motion-priority>${option('normal', 'Normal')}${option('idle', 'Idle')}${option('force', 'Force')}</select></label>
      <label class="field"><span>Fade in (ms, blank = model)</span><input data-motion-fade-in type="number" min="0" placeholder="model default"></label>
      <label class="field"><span>Fade out (ms, blank = model)</span><input data-motion-fade-out type="number" min="0" placeholder="model default"></label>
      <div class="actions"><button data-action="play-motion" type="button">Play</button><button data-action="queue-motion" type="button">Queue step</button></div>
      <section class="card"><h3>Sequence queue</h3>${sequence.length ? `<ol class="queue">${sequence.map(step => `<li>${escape(step.group)}[${step.index ?? 0}]</li>`).join('')}</ol>` : '<p class="muted">No queued steps.</p>'}<div class="actions"><button data-action="play-sequence" ${sequence.length ? '' : 'disabled'} type="button">Play queue</button><button data-action="clear-sequence" ${sequence.length ? '' : 'disabled'} type="button">Clear</button></div></section>
    </div>`
  }

  const expressionPanel = (info: ModelInfo) => {
    if (!info.expressions.length)
      return '<p class="empty">This model declares no expressions.</p>'
    return `<div class="stack">
      <label class="field"><span>Expression</span><select data-expression>${info.expressions.map(value => option(value)).join('')}</select></label>
      <label class="field"><span>Fade in (ms, blank = model)</span><input data-expression-fade-in type="number" min="0" placeholder="model default"></label>
      <label class="field"><span>Fade out (ms, blank = model)</span><input data-expression-fade-out type="number" min="0" placeholder="model default"></label>
      <div class="actions"><button data-action="apply-expression" type="button">Apply</button><button data-action="clear-expression" type="button">Clear</button></div>
    </div>`
  }

  const sampleParameters = (now: number) => {
    parameterFrame = undefined
    if (disposed || tab !== 'parameters')
      return
    if (!document.hidden && now - lastParameterSample >= 1000 / 15) {
      lastParameterSample = now
      for (const output of Array.from(
        shadow.querySelectorAll<HTMLOutputElement>('[data-param-value]'),
      )) {
        const id = output.dataset.paramValue!
        const value = overrides.get(id)?.value ?? target.getParameter(id)
        output.textContent = value.toFixed(3)
        const slider = findByData<HTMLInputElement>(shadow, 'param-slider', id)
        if (slider && !overrides.has(id))
          slider.value = String(value)
      }
    }
    parameterFrame = requestAnimationFrame(sampleParameters)
  }
  const startSampling = () => {
    stopSampling()
    if (tab === 'parameters')
      parameterFrame = requestAnimationFrame(sampleParameters)
  }

  const render = () => {
    if (disposed)
      return
    stopSampling()
    try {
      const info = readInfo()
      const panel = tab === 'overview'
        ? overviewPanel(info)
        : tab === 'parameters'
          ? parametersPanel(info)
          : tab === 'motion'
            ? motionPanel(info)
            : expressionPanel(info)
      shell.innerHTML = `<div class="top"><strong>Live2D Devtools</strong><span>Runtime controls and diagnostics</span></div>
        <div class="tabs" role="tablist">${TABS.map(value => `<button aria-selected="${tab === value}" data-tab="${value}" role="tab" type="button">${value[0]!.toUpperCase()}${value.slice(1)}</button>`).join('')}</div>
        <div class="panel" role="tabpanel">${panel}</div>
        <output class="status" data-error="${statusError}" data-status>${escape(status)}</output>`
      startSampling()
    }
    catch (error) {
      shell.innerHTML = `<div class="top"><strong>Live2D Devtools</strong><span>Target unavailable</span></div><p class="empty">${escape(error instanceof Error ? error.message : error)}</p><output class="status" data-error="true" data-status>${escape(error instanceof Error ? error.message : error)}</output>`
    }
  }

  const motionRequest = (): MotionSequenceStep => {
    const group = shadow.querySelector<HTMLSelectElement>('[data-motion-group]')?.value ?? ''
    const index = Number(shadow.querySelector<HTMLInputElement>('[data-motion-index]')?.value ?? 0)
    const priority = shadow.querySelector<HTMLSelectElement>('[data-motion-priority]')?.value as MotionOptions['priority']
    const fadeInMs = finiteInput(shadow.querySelector<HTMLInputElement>('[data-motion-fade-in]')?.value ?? '')
    const fadeOutMs = finiteInput(shadow.querySelector<HTMLInputElement>('[data-motion-fade-out]')?.value ?? '')
    return { group, index, options: { priority, fadeInMs, fadeOutMs } }
  }

  shadow.addEventListener('click', (event) => {
    const element = (event.target as Element).closest<HTMLElement>('[data-tab], [data-action], [data-reset-param]')
    if (!element || disposed)
      return
    const nextTab = element.dataset.tab
    if (nextTab) {
      tab = nextTab as Live2DDevtoolsTab
      render()
      return
    }
    const reset = element.dataset.resetParam
    if (reset) {
      overrides.get(reset)?.cleanup()
      overrides.delete(reset)
      render()
      showStatus(`${reset} restored`)
      return
    }
    const action = element.dataset.action
    void (async () => {
      try {
        if (action === 'copy-diagnostic') {
          if (!navigator.clipboard?.writeText)
            throw new Error('Clipboard access is unavailable.')
          await navigator.clipboard.writeText(JSON.stringify(diagnostic(), null, 2))
          showStatus('Diagnostic JSON copied')
        }
        else if (action === 'play-motion') {
          const step = motionRequest()
          const result = await target.playMotion(step.group, step.index, step.options)
          showStatus(`Motion ${result.status}`)
        }
        else if (action === 'queue-motion') {
          sequence.push(motionRequest())
          render()
          showStatus('Motion step queued')
        }
        else if (action === 'clear-sequence') {
          sequence = []
          render()
          showStatus('Sequence cleared')
        }
        else if (action === 'play-sequence') {
          const result = await target.sequence(sequence)
          showStatus(`Sequence ${result.status}; ${result.completedSteps} completed`)
        }
        else if (action === 'apply-expression') {
          const id = shadow.querySelector<HTMLSelectElement>('[data-expression]')?.value
          const fadeInMs = finiteInput(shadow.querySelector<HTMLInputElement>('[data-expression-fade-in]')?.value ?? '')
          const fadeOutMs = finiteInput(shadow.querySelector<HTMLInputElement>('[data-expression-fade-out]')?.value ?? '')
          await target.expression(id, { fadeInMs, fadeOutMs })
          showStatus(`Expression ${id} applied`)
        }
        else if (action === 'clear-expression') {
          target.clearExpression()
          showStatus('Expression cleared')
        }
      }
      catch (error) {
        showError(error)
      }
    })()
  })

  shadow.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement
    const id = input.dataset.paramSlider
    if (id) {
      const value = Number(input.value)
      const existing = overrides.get(id)
      if (existing) {
        existing.value = value
      }
      else {
        const entry = { cleanup: () => {}, value }
        entry.cleanup = target.addParameterDriver(id, { getValue: () => entry.value })
        overrides.set(id, entry)
      }
      const output = findByData<HTMLOutputElement>(shadow, 'param-value', id)
      if (output)
        output.textContent = value.toFixed(3)
      return
    }
    if (input.matches('[data-parameter-search]')) {
      const query = input.value.trim().toLowerCase()
      for (const row of Array.from(shadow.querySelectorAll<HTMLElement>('[data-parameter]')))
        row.hidden = !row.dataset.parameter!.toLowerCase().includes(query)
    }
  })

  shadow.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement
    if (!select.matches('[data-motion-group]'))
      return
    const info = readInfo()
    const index = shadow.querySelector<HTMLInputElement>('[data-motion-index]')
    if (index) {
      index.max = String(Math.max(0, (info.motions[select.value] ?? 1) - 1))
      index.value = '0'
    }
  })

  const connect = () => {
    unsubscribe?.()
    unsubscribe = target.subscribe?.(() => {
      if (tab === 'overview')
        render()
    })
  }
  connect()
  render()

  return Object.freeze({
    setTarget(nextTarget: Live2DDevtoolsTarget) {
      if (disposed)
        invalid('Cannot set a target on disposed Live2D Devtools.')
      assertTarget(nextTarget)
      clearOverrides()
      sequence = []
      target = nextTarget
      connect()
      showStatus('Target changed')
      render()
    },
    setTab(nextTab: Live2DDevtoolsTab) {
      if (disposed)
        invalid('Cannot select a tab on disposed Live2D Devtools.')
      assertTab(nextTab)
      tab = nextTab
      render()
    },
    dispose() {
      if (disposed)
        return
      disposed = true
      stopSampling()
      unsubscribe?.()
      unsubscribe = undefined
      clearOverrides()
      host.remove()
    },
  })
}
