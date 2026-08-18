import { Live2DError } from './errors'

declare global {
  interface Window {
    Live2DCubismCore?: unknown
  }
}

/**
 * Cubism 5.3 Core URL that Live2D publishes for hosting use. Handy to get
 * started (`coreUrl: OFFICIAL_CUBISM_CORE_URL`); self-host the file for
 * production so your app does not depend on a third-party host.
 */
export const OFFICIAL_CUBISM_CORE_URL
  = 'https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js'

const pendingLoads = new Map<string, Promise<void>>()

// A script that never fires load or error would otherwise leave every caller
// for this URL pending forever, including the ones that arrive later.
const CORE_LOAD_TIMEOUT_MS = 30_000

function resourceHttpStatus(url: string) {
  if (typeof performance === 'undefined' || !performance.getEntriesByName)
    return undefined
  const entry = performance.getEntriesByName(url, 'resource').at(-1) as
    | (PerformanceResourceTiming & { responseStatus?: number })
    | undefined
  const status = entry?.responseStatus
  return typeof status === 'number' && status > 0 ? status : undefined
}

function coreDetails(url?: string) {
  return {
    assetType: 'core' as const,
    httpStatus: url ? resourceHttpStatus(url) : undefined,
    url,
  }
}

function coreMissingMessage() {
  return 'Live2D Cubism Core is not loaded. Pass a coreUrl option (to createLive2D() or <Live2DCanvas>), '
    + 'for example the OFFICIAL_CUBISM_CORE_URL constant, or load the script before creating a model:\n'
    + '  <script src="/path/to/live2dcubismcore.min.js"></script>\n'
    + 'Official SDK download: https://www.live2d.com/sdk/download/web/'
}

function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Live2DError(
      'browser-only',
      'live2d-web can only create a stage in a browser.',
    )
  }
}

function loadCoreScript(absoluteUrl: string) {
  return new Promise<void>((resolve, reject) => {
    // Never adopt a script the page already owns: load and error are one-shot,
    // and an element that fired before we looked can never settle this promise.
    const script = document.createElement('script')
    const listeners = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const settle = (error?: Live2DError) => {
      if (timer !== undefined)
        clearTimeout(timer)
      timer = undefined
      listeners.abort()
      if (!error) {
        resolve()
        return
      }
      script.remove()
      reject(error)
    }

    const onSettleEvent = (event: Event) => {
      if (event.type === 'load' && window.Live2DCubismCore) {
        settle()
        return
      }
      settle(event.type === 'load'
        ? new Live2DError(
            'core-missing',
            coreMissingMessage(),
            { details: coreDetails(absoluteUrl) },
          )
        : new Live2DError(
            'core-missing',
            `Failed to load Live2D Cubism Core from ${absoluteUrl}.`,
            {
              cause: event,
              details: coreDetails(absoluteUrl),
            },
          ))
    }

    script.addEventListener('load', onSettleEvent, { signal: listeners.signal })
    script.addEventListener('error', onSettleEvent, { signal: listeners.signal })
    timer = setTimeout(() => {
      settle(new Live2DError(
        'core-missing',
        `Live2D Cubism Core did not load from ${absoluteUrl} within `
        + `${CORE_LOAD_TIMEOUT_MS} ms.`,
        { details: coreDetails(absoluteUrl) },
      ))
    }, CORE_LOAD_TIMEOUT_MS)

    script.src = absoluteUrl
    script.async = true
    script.dataset.live2dWebCore = 'true'
    document.head.appendChild(script)
  })
}

// The shared load stays untouched so aborting one caller cannot cancel or
// reject the script load that the other callers are still waiting on.
function withAbort(load: Promise<void>, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    load.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}

export interface EnsureCubismCoreOptions {
  /** Stops waiting for the script; the shared load continues for other callers. */
  signal?: AbortSignal
}

/**
 * Verifies the user-supplied Cubism Core global, optionally loading a user-hosted
 * script first. Concurrent calls for the same URL share one script load.
 */
export async function ensureCubismCore(
  coreUrl?: string,
  options: EnsureCubismCoreOptions = {},
): Promise<void> {
  assertBrowser()

  const { signal } = options
  if (signal?.aborted)
    throw signal.reason

  if (window.Live2DCubismCore)
    return

  if (!coreUrl) {
    throw new Live2DError(
      'core-missing',
      coreMissingMessage(),
      { details: coreDetails() },
    )
  }

  const absoluteUrl = new URL(coreUrl, document.baseURI).href
  let load = pendingLoads.get(absoluteUrl)

  if (!load) {
    const createdLoad = loadCoreScript(absoluteUrl)
    load = createdLoad.finally(() => {
      if (pendingLoads.get(absoluteUrl) === load)
        pendingLoads.delete(absoluteUrl)
    })
    pendingLoads.set(absoluteUrl, load)
  }

  await (signal ? withAbort(load, signal) : load)
  if (signal?.aborted)
    throw signal.reason
  if (!window.Live2DCubismCore) {
    throw new Live2DError(
      'core-missing',
      coreMissingMessage(),
      { details: coreDetails(absoluteUrl) },
    )
  }
}
