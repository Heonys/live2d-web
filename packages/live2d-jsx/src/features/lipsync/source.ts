import type { Profile, WLipSyncAudioNode } from 'wlipsync'

export type LipSyncProfile = Profile
export type LipSyncProfileInput = string | URL | ArrayBuffer | LipSyncProfile

type WLipSyncModule = Pick<
  typeof import('wlipsync'),
  'createWLipSyncNode' | 'parseBinaryProfile'
>

interface SourceLipSyncOptions {
  fetcher?: typeof fetch
  loadModule?: () => Promise<WLipSyncModule>
  now?: () => number
}

export interface SourceLipSyncConnection {
  getMouthOpen: () => number
  node: WLipSyncAudioNode
  dispose: () => void
}

const RAW_VOWELS = [
  ['A', 'A'],
  ['E', 'E'],
  ['I', 'I'],
  ['O', 'O'],
  ['U', 'U'],
  // Treat the unvoiced S shape as a small I rather than snapping shut.
  ['S', 'I'],
] as const

const MOUTH_CAP = 0.7
const MOUTH_UPDATE_INTERVAL_MS = 50
const MOUTH_SMOOTHING_MS = 50
const VOLUME_EXPONENT = 0.7
const VOLUME_SCALE = 0.9

const profileRequests = new Map<string, Promise<LipSyncProfile>>()
let moduleRequest: Promise<WLipSyncModule> | undefined

function idempotent(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function finitePositive(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function defaultNow() {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function loadWLipSyncModule() {
  if (!moduleRequest) {
    moduleRequest = import('wlipsync').catch((error) => {
      moduleRequest = undefined
      throw error
    })
  }
  return moduleRequest
}

function profileUrl(input: string | URL) {
  if (input instanceof URL)
    return input.href
  const base = typeof location === 'undefined'
    ? 'http://localhost/'
    : location.href
  return new URL(input, base).href
}

function fetchProfile(
  input: string | URL,
  module: WLipSyncModule,
  fetcher: typeof fetch,
) {
  const url = profileUrl(input)
  const cached = profileRequests.get(url)
  if (cached)
    return cached

  const request = fetcher(url).then(async (response) => {
    if (!response.ok)
      throw new Error(`Failed to load the lip-sync profile (${response.status}).`)
    const pathname = new URL(url).pathname.toLowerCase()
    if (pathname.endsWith('.bin'))
      return module.parseBinaryProfile(await response.arrayBuffer())
    return await response.json() as LipSyncProfile
  })
  profileRequests.set(url, request)
  void request.catch(() => {
    if (profileRequests.get(url) === request)
      profileRequests.delete(url)
  })
  return request
}

export function resolveLipSyncProfile(
  input: LipSyncProfileInput,
  module: WLipSyncModule,
  fetcher: typeof fetch = fetch,
): Promise<LipSyncProfile> {
  if (typeof input === 'string' || input instanceof URL)
    return fetchProfile(input, module, fetcher)
  if (input instanceof ArrayBuffer)
    return Promise.resolve(module.parseBinaryProfile(input))
  return Promise.resolve(input)
}

export function createSourceMouthReader(
  node: Pick<WLipSyncAudioNode, 'volume' | 'weights'>,
  now: () => number = defaultNow,
) {
  let lastRawMouthOpen = 0
  let lastRawUpdateMs = Number.NaN
  let lastSmoothedMouthOpen = 0
  let lastSmoothedUpdateMs = Number.NaN

  const computeMouthOpen = () => {
    const volume = Math.min(finitePositive(node.volume) * VOLUME_SCALE, 1)
      ** VOLUME_EXPONENT
    const projected = { A: 0, E: 0, I: 0, O: 0, U: 0 }

    for (const [raw, vowel] of RAW_VOWELS) {
      const weight = Math.min(
        MOUTH_CAP,
        finitePositive(node.weights?.[raw] ?? 0) * volume,
      )
      projected[vowel] = Math.max(projected[vowel], weight)
    }
    return Math.max(...Object.values(projected))
  }

  return () => {
    const timestamp = now()
    if (
      Number.isNaN(lastRawUpdateMs)
      || timestamp - lastRawUpdateMs >= MOUTH_UPDATE_INTERVAL_MS
    ) {
      lastRawMouthOpen = computeMouthOpen()
      lastRawUpdateMs = timestamp
    }

    if (Number.isNaN(lastSmoothedUpdateMs)) {
      lastSmoothedMouthOpen = lastRawMouthOpen
      lastSmoothedUpdateMs = timestamp
      return lastSmoothedMouthOpen
    }

    const elapsedMs = Math.max(0, timestamp - lastSmoothedUpdateMs)
    const alpha = Math.min(1, elapsedMs / MOUTH_SMOOTHING_MS)
    lastSmoothedMouthOpen += (lastRawMouthOpen - lastSmoothedMouthOpen) * alpha
    lastSmoothedUpdateMs = timestamp
    return lastSmoothedMouthOpen
  }
}

export async function createSourceLipSync(
  source: AudioNode,
  profile: LipSyncProfileInput,
  options: SourceLipSyncOptions = {},
): Promise<SourceLipSyncConnection> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error('wLipSync requires HTTPS or localhost because it uses AudioWorklet.')
  }
  if (!source.context || !('audioWorklet' in source.context))
    throw new Error('The source AudioNode context does not support AudioWorklet.')

  const module = await (options.loadModule ?? loadWLipSyncModule)()
  const fetcher = options.fetcher
    ?? (typeof fetch === 'undefined' ? undefined : fetch.bind(globalThis))
  if (
    (typeof profile === 'string' || profile instanceof URL)
    && !fetcher
  ) {
    throw new Error('fetch is unavailable, so the lip-sync profile URL cannot be loaded.')
  }
  const resolvedProfile = await resolveLipSyncProfile(
    profile,
    module,
    fetcher as typeof fetch,
  )
  const node = await module.createWLipSyncNode(
    source.context as AudioContext,
    resolvedProfile,
  )
  const disposeNode = idempotent(() => {
    try {
      node.disconnect()
    }
    catch {
      // The node may already have been detached by its AudioContext.
    }
    try {
      node.port.close()
    }
    catch {
      // MessagePort.close is best-effort during browser teardown.
    }
  })

  try {
    source.connect(node)
  }
  catch (error) {
    disposeNode()
    throw error
  }

  const getMouthOpen = createSourceMouthReader(node, options.now)
  return {
    dispose: idempotent(() => {
      try {
        source.disconnect(node)
      }
      catch {
        // Disconnect only this edge; it may already have been removed.
      }
      disposeNode()
    }),
    getMouthOpen,
    node,
  }
}

export function clearLipSyncCachesForTests() {
  profileRequests.clear()
  moduleRequest = undefined
}
