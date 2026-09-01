export const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
export const PIXI_CORE_URL = '/assets/js/cubism/5.2/live2dcubismcore.min.js'
export const HIYORI_MANIFEST_URL = '/assets/live2d/hiyori/manifest.json'
export const MEDIAPIPE_MODEL_URL = '/assets/mediapipe/face_landmarker.task'
export const MEDIAPIPE_WASM_URL = '/assets/mediapipe/wasm'
export const TRACKING_PORTRAIT_URL = '/assets/mediapipe/portrait.jpg'

export interface AssetManifest {
  model3: string
  moc3?: string
  textures?: string[]
}

export async function loadManifest(signal?: AbortSignal) {
  const response = await fetch(HIYORI_MANIFEST_URL, { signal })
  if (!response.ok)
    throw new Error(`Demo assets unavailable (${response.status}). Run LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets.`)
  return response.json() as Promise<AssetManifest>
}
