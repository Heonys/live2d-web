import { Live2DError } from './errors'

declare global {
  interface Window {
    Live2DCubismCore?: unknown
  }
}

const pendingLoads = new Map<string, Promise<void>>()

function coreMissingMessage() {
  return 'Live2D Cubism Core is not loaded. Download it from the official Cubism SDK and either pass coreUrl to <Live2DStage> or load it before the model:\n'
    + '  <script src="/path/to/live2dcubismcore.min.js"></script>\n'
    + 'Official SDK: https://www.live2d.com/sdk/download/web/'
}

function assertBrowser(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Live2DError(
      'browser-only',
      'live2d-jsx can only create a stage in a browser. Render it from a React client component.',
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

  if (!coreUrl)
    throw new Live2DError('core-missing', coreMissingMessage())

  const absoluteUrl = new URL(coreUrl, document.baseURI).href
  let load = pendingLoads.get(absoluteUrl)

  if (!load) {
    const createdLoad = new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.scripts).find(script => script.src === absoluteUrl)
      const script = existing ?? document.createElement('script')
      const ownedByLoader = !existing || script.dataset.live2dJsxCore === 'true'

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
            ? new Live2DError('core-missing', coreMissingMessage())
            : new Live2DError(
                'core-missing',
                `Failed to load Live2D Cubism Core from ${absoluteUrl}.`,
                { cause: event },
              ))
        },
      }

      script.addEventListener('load', listener, { once: true })
      script.addEventListener('error', listener, { once: true })

      if (!existing) {
        script.src = absoluteUrl
        script.async = true
        script.dataset.live2dJsxCore = 'true'
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
  if (!window.Live2DCubismCore)
    throw new Live2DError('core-missing', coreMissingMessage())
}
