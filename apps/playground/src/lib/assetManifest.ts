export const CUBISM_CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
export const CUBISM_CORE_URL_PIXI = '/assets/js/cubism/5.2/live2dcubismcore.min.js'

export interface AssetManifest {
  model3: string
  /** Written by fetch-assets; optional so an older manifest still works. */
  moc3?: string
  textures?: string[]
}

/**
 * Downloads the model bytes while Cubism Core is still loading.
 *
 * The runtime cannot start these itself until Core has parsed, the adapter
 * chunks have loaded and model3.json has been read, so the largest file in the
 * demo is six round trips late. These requests use plain fetch() with default
 * options on purpose: the runtime's own request is then byte-identical and
 * reuses this one. A <link rel="preload"> would carry a different request
 * destination and could download the texture a second time instead.
 */
export function warmUpModelAssets(manifest: AssetManifest) {
  const urls = [manifest.model3, manifest.moc3, ...(manifest.textures ?? [])]
  for (const url of urls) {
    if (!url)
      continue
    // The body has to be consumed or the load is cancelled once the Response is
    // collected. No AbortSignal: these assets are immutable, and aborting would
    // throw away bytes that are already paid for (StrictMode remounts twice).
    void fetch(url)
      .then(response => response.blob())
      .catch(() => {})
  }
}
