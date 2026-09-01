import type { LabBridge, LabSnapshot, ScenarioState } from './lab-types'

const errors: string[] = []
const consoleErrors: string[] = []
const scenarios: Record<string, ScenarioState> = {}
let models = 0
let status: ScenarioState = 'idle'
let lifecycleRunner: ((count: number) => Promise<void>) | undefined

function currentRoute() {
  return window.location.hash.slice(1) || '/dashboard'
}

function snapshot(): LabSnapshot {
  return {
    canvases: document.querySelectorAll('canvas').length,
    consoleErrors: [...consoleErrors],
    errors: [...errors],
    models,
    route: currentRoute(),
    scenarios: { ...scenarios },
    source: __LIVE2D_LAB_META__.source,
    status,
    version: __LIVE2D_LAB_META__.packageVersion,
  }
}

export function recordError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value)
  if (!errors.includes(message))
    errors.push(message)
  scenarios[currentRoute()] = 'error'
}

export function setLabModels(value: number) {
  models = value
}

export function setLabStatus(value: ScenarioState, route = currentRoute()) {
  status = value
  if (route !== '/dashboard')
    scenarios[route] = value
}

export function setLifecycleRunner(runner: ((count: number) => Promise<void>) | undefined) {
  lifecycleRunner = runner
}

function loseContext() {
  const canvas = document.querySelector('canvas')
  if (!canvas)
    return false
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  return true
}

export function installLabBridge() {
  const originalConsoleError = console.error
  console.error = (...values: unknown[]) => {
    const message = values.map(value => value instanceof Error ? value.message : String(value)).join(' ')
    if (!consoleErrors.includes(message))
      consoleErrors.push(message)
    originalConsoleError(...values)
  }
  const bridge: LabBridge = {
    clearErrors() {
      errors.length = 0
      consoleErrors.length = 0
    },
    loseContext,
    async runLifecycleCycle(count = 1) {
      await lifecycleRunner?.(Math.max(1, Math.floor(count)))
      return snapshot()
    },
    snapshot,
  }
  window.__live2dLab = bridge
  return () => {
    console.error = originalConsoleError
    if (window.__live2dLab === bridge)
      delete window.__live2dLab
  }
}
