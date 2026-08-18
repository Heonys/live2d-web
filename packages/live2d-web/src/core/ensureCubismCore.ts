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

/**
 * Verifies the user-supplied Cubism Core global, optionally loading a user-hosted
 * script first. Concurrent calls for the same URL share one script load.
 */
export async function ensureCubismCore(coreUrl?: string): Promise<void> {
  assertBrowser()

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
    const createdLoad = new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === absoluteUrl)
      const script = existing ?? document.createElement('script')
      const ownedByLoader = !existing || script.dataset.live2dWebCore === 'true'

      const listener: EventListenerObject = {
        handleEvent(event) {
          script.removeEventListener('load', listener)
          script.removeEventListener('error', listener)
          if (event.type === 'load' && window.Live2DCubismCore) {
            resolve()
            return
          }
          if (ownedByLoader)
            script.remove()
          reject(event.type === 'load'
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
        },
      }

      script.addEventListener('load', listener, { once: true })
      script.addEventListener('error', listener, { once: true })

      if (!existing) {
        script.src = absoluteUrl
        script.async = true
        script.dataset.live2dWebCore = 'true'
        document.head.appendChild(script)
      }
    })
    load = createdLoad.finally(() => {
      if (pendingLoads.get(absoluteUrl) === load)
        pendingLoads.delete(absoluteUrl)
    })
    pendingLoads.set(absoluteUrl, load)
  }

  await load
  if (!window.Live2DCubismCore) {
    throw new Live2DError(
      'core-missing',
      coreMissingMessage(),
      { details: coreDetails(absoluteUrl) },
    )
  }
}
