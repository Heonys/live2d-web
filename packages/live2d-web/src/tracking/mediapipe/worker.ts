import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
  SerializedFaceResult,
} from './protocol'
import { MEDIAPIPE_WORKER_PROTOCOL } from './protocol'

function serializeResult(result: FaceLandmarkerResult): SerializedFaceResult | undefined {
  if (!result.faceLandmarks.length)
    return undefined
  const categories = result.faceBlendshapes[0]?.categories ?? []
  const matrix = result.facialTransformationMatrixes[0]?.data
  if (categories.length === 0 || !matrix || matrix.length < 16)
    return undefined
  return {
    blendshapes: categories.map(category => [category.categoryName, category.score]),
    matrix: Array.from(matrix).slice(0, 16),
  }
}

function serializeError(error: unknown) {
  return error instanceof Error
    ? { message: error.message, name: error.name, stack: error.stack }
    : { message: String(error) }
}

/**
 * MediaPipe 1.0.1 loads its WASM loader with `document.createElement('script')`
 * whenever `importScripts` is missing, which is exactly what a standards
 * compliant module worker looks like. There is no document in a worker, so the
 * task dies with a bare `Can't find variable: document`. Measured on Chrome for
 * iOS, whose WKWebView really does hand back a module worker; Safari and the
 * desktop bundlers get a classic bootstrap and never reach this path.
 *
 * Say so instead of forwarding the raw message. The caller cannot act on
 * "document is not defined"; it can act on "run this tracker on the main
 * thread". Falling back silently is deliberately not offered: execution mode is
 * the application's choice, not something a library should switch underneath it.
 */
function explainWorkerFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (isClassicWorker() || !/\bdocument\b/.test(message))
    return error
  return new Error(
    `${message}. This browser gave the library a real module worker, and the `
    + `bundled MediaPipe loader can only fetch its WASM from a classic worker `
    + `or the main thread. Create the tracker with execution: 'main' here.`,
    { cause: error },
  )
}

function isClassicWorker() {
  const importScripts = (globalThis as unknown as { importScripts?: () => void }).importScripts
  if (!importScripts)
    return false
  try {
    // Calling importScripts() is a harmless no-op in a classic worker and a
    // TypeError in a standards-compliant module worker.
    importScripts()
    return true
  }
  catch {
    return false
  }
}

let started = false

/**
 * Starts the MediaPipe module-worker message loop. Call this once from the
 * application's own worker entry; importing this module has no side effects.
 */
export function startMediaPipeFaceTrackerWorker(): void {
  // A second call would register a second listener and answer every request
  // twice, so repeat calls are a no-op.
  if (started)
    return
  started = true
  const scope = globalThis as unknown as {
    addEventListener: (
      type: 'message',
      listener: (event: MessageEvent<MediaPipeWorkerRequest>) => void,
    ) => void
    close: () => void
    postMessage: (message: MediaPipeWorkerResponse) => void
  }
  let task: FaceLandmarker | undefined
  let disposed = false

  const send = (message: MediaPipeWorkerResponse) => scope.postMessage(message)
  scope.addEventListener('message', async (event: MessageEvent<MediaPipeWorkerRequest>) => {
    const request = event.data
    if (!request)
      return
    if (disposed) {
      // The bitmap was transferred to this thread; nobody else can free it.
      if (request.type === 'detect')
        request.bitmap.close()
      return
    }
    try {
      if (request.type === 'init') {
        if (request.protocol !== MEDIAPIPE_WORKER_PROTOCOL) {
          throw new Error(
            `MediaPipe worker protocol mismatch: the worker chunk speaks v${MEDIAPIPE_WORKER_PROTOCOL} `
            + `but the library sent v${request.protocol}. Rebuild or redeploy the app's worker entry.`,
          )
        }
        const vision = await import('@mediapipe/tasks-vision')
        // Vite and standards-compliant module workers use MediaPipe's ESM
        // loader. Some current framework bundlers (notably Next/Turbopack)
        // compile an explicitly requested module Worker into a classic
        // bootstrap, which must use the classic MediaPipe loader instead.
        const fileset = await vision.FilesetResolver.forVisionTasks(
          request.options.wasmPath,
          !isClassicWorker(),
        )
        if (disposed)
          return
        task = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            delegate: request.options.delegate,
            ...(request.options.modelAssetPath
              ? { modelAssetPath: request.options.modelAssetPath }
              : { modelAssetBuffer: request.options.modelAssetBuffer! }),
          },
          minFaceDetectionConfidence: request.options.minFaceDetectionConfidence,
          minFacePresenceConfidence: request.options.minFacePresenceConfidence,
          minTrackingConfidence: request.options.minTrackingConfidence,
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
        })
        send({ id: request.id, type: 'ready' })
        return
      }
      if (request.type === 'detect') {
        try {
          if (!task)
            throw new Error('MediaPipe worker has not been initialized.')
          const startedAt = performance.now()
          const result = task.detectForVideo(request.bitmap, request.timestampMs)
          send({
            id: request.id,
            inferenceMs: Math.max(0, performance.now() - startedAt),
            result: serializeResult(result),
            type: 'result',
          })
        }
        finally {
          request.bitmap.close()
        }
        return
      }
      if (request.type === 'dispose') {
        disposed = true
        task?.close()
        task = undefined
        send({ id: request.id, type: 'disposed' })
        scope.close()
      }
      // Anything else is a newer protocol this build does not know; tearing
      // the worker down over it would turn a version skew into a dead tracker.
    }
    catch (error) {
      send({ id: request.id, error: serializeError(explainWorkerFailure(error)), type: 'error' })
    }
  })
}
