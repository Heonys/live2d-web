import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
} from './protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MEDIAPIPE_WORKER_PROTOCOL } from './protocol'

// The runner refuses to start twice in one worker scope, so every test case
// loads a fresh module instance instead of sharing a static import.
async function loadWorkerRunner() {
  vi.resetModules()
  const { startMediaPipeFaceTrackerWorker } = await import('./worker')
  return startMediaPipeFaceTrackerWorker
}

const mediaPipeMocks = vi.hoisted(() => ({
  close: vi.fn(),
  createFromOptions: vi.fn(),
  detectForVideo: vi.fn(),
  forVisionTasks: vi.fn(),
}))

vi.mock('@mediapipe/tasks-vision', () => ({
  FaceLandmarker: { createFromOptions: mediaPipeMocks.createFromOptions },
  FilesetResolver: { forVisionTasks: mediaPipeMocks.forVisionTasks },
}))

class FakeWorkerScope {
  closed = false
  messages: MediaPipeWorkerResponse[] = []
  private listener: ((event: MessageEvent<MediaPipeWorkerRequest>) => void) | undefined

  addEventListener(
    _type: 'message',
    listener: (event: MessageEvent<MediaPipeWorkerRequest>) => void,
  ) {
    this.listener = listener
  }

  close() {
    this.closed = true
  }

  postMessage(message: MediaPipeWorkerResponse) {
    this.messages.push(message)
  }

  dispatch(message: MediaPipeWorkerRequest) {
    this.listener?.(new MessageEvent('message', { data: message }))
  }
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function faceResult(): FaceLandmarkerResult {
  return {
    faceBlendshapes: [{
      categories: [{ categoryName: '_neutral', displayName: '', index: 0, score: 1 }],
      headIndex: 0,
      headName: '',
    }],
    faceLandmarks: [[]],
    facialTransformationMatrixes: [{ columns: 4, data: identity, rows: 4 }],
  }
}

describe('mediaPipe worker runner', () => {
  beforeEach(() => {
    mediaPipeMocks.close.mockReset()
    mediaPipeMocks.createFromOptions.mockReset()
    mediaPipeMocks.detectForVideo.mockReset()
    mediaPipeMocks.forVisionTasks.mockReset()
    mediaPipeMocks.forVisionTasks.mockResolvedValue({ wasm: true })
    mediaPipeMocks.createFromOptions.mockResolvedValue({
      close: mediaPipeMocks.close,
      detectForVideo: mediaPipeMocks.detectForVideo,
    })
    mediaPipeMocks.detectForVideo.mockReturnValue(faceResult())
  })

  it.each([
    { classic: false, useModule: true },
    { classic: true, useModule: false },
  ])('selects the matching WASM loader and closes transferred bitmaps ($classic)', async ({ classic, useModule }) => {
    const scope = new FakeWorkerScope()
    vi.stubGlobal('self', scope)
    vi.stubGlobal('postMessage', scope.postMessage.bind(scope))
    vi.stubGlobal('close', scope.close.bind(scope))
    if (classic)
      vi.stubGlobal('importScripts', vi.fn())
    else
      vi.stubGlobal('importScripts', undefined)
    vi.stubGlobal('addEventListener', scope.addEventListener.bind(scope))
    const startMediaPipeFaceTrackerWorker = await loadWorkerRunner()
    startMediaPipeFaceTrackerWorker()

    scope.dispatch({
      id: 0,
      options: {
        delegate: 'GPU',
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.2,
        modelAssetPath: 'https://example.test/face.task',
        wasmPath: 'https://example.test/wasm',
      },
      protocol: MEDIAPIPE_WORKER_PROTOCOL,
      type: 'init',
    })
    await vi.waitFor(() => expect(scope.messages).toContainEqual({ id: 0, type: 'ready' }))
    expect(mediaPipeMocks.forVisionTasks).toHaveBeenCalledWith(
      'https://example.test/wasm',
      useModule,
    )
    // The thresholds relaxed for real cameras in 0.5.0 have to survive the
    // hop into the worker, or worker mode silently reverts to MediaPipe's
    // stricter defaults.
    expect(mediaPipeMocks.createFromOptions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        baseOptions: expect.objectContaining({ delegate: 'GPU' }),
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.2,
      }),
    )

    const bitmap = { close: vi.fn() } as unknown as ImageBitmap
    scope.dispatch({ bitmap, id: 1, timestampMs: 10, type: 'detect' })
    await vi.waitFor(() => expect(scope.messages.some(message => message.type === 'result')).toBe(true))
    expect(bitmap.close).toHaveBeenCalledTimes(1)
    expect(scope.messages.at(-1)).toMatchObject({
      id: 1,
      inferenceMs: expect.any(Number),
      result: {
        blendshapes: [['_neutral', 1]],
        matrix: identity,
      },
      type: 'result',
    })

    scope.dispatch({ id: 2, type: 'dispose' })
    await vi.waitFor(() => expect(scope.messages).toContainEqual({ id: 2, type: 'disposed' }))
    expect(mediaPipeMocks.close).toHaveBeenCalledTimes(1)
    expect(scope.closed).toBe(true)
  })

  it('rejects an init from a different protocol version', async () => {
    const scope = new FakeWorkerScope()
    vi.stubGlobal('self', scope)
    vi.stubGlobal('postMessage', scope.postMessage.bind(scope))
    vi.stubGlobal('close', scope.close.bind(scope))
    vi.stubGlobal('importScripts', undefined)
    vi.stubGlobal('addEventListener', scope.addEventListener.bind(scope))
    const startMediaPipeFaceTrackerWorker = await loadWorkerRunner()
    startMediaPipeFaceTrackerWorker()

    scope.dispatch({
      id: 0,
      options: {
        delegate: 'CPU',
        minFaceDetectionConfidence: 0.4,
        minFacePresenceConfidence: 0.4,
        minTrackingConfidence: 0.3,
        modelAssetPath: 'https://example.test/face.task',
        wasmPath: 'https://example.test/wasm',
      },
      protocol: MEDIAPIPE_WORKER_PROTOCOL + 1,
      type: 'init',
    })
    await vi.waitFor(() => expect(scope.messages.some(message => message.type === 'error')).toBe(true))
    expect(scope.messages.at(-1)).toMatchObject({
      error: { message: expect.stringContaining('protocol mismatch') },
      type: 'error',
    })
    expect(mediaPipeMocks.forVisionTasks).not.toHaveBeenCalled()
  })

  // The bitmap is transferred to this thread, so every early-return path must
  // close it; and an unknown message is version skew, not a shutdown order.
  it('closes stray bitmaps and survives unknown message types', async () => {
    const scope = new FakeWorkerScope()
    vi.stubGlobal('self', scope)
    vi.stubGlobal('postMessage', scope.postMessage.bind(scope))
    vi.stubGlobal('close', scope.close.bind(scope))
    vi.stubGlobal('importScripts', undefined)
    vi.stubGlobal('addEventListener', scope.addEventListener.bind(scope))
    const startMediaPipeFaceTrackerWorker = await loadWorkerRunner()
    startMediaPipeFaceTrackerWorker()

    const early = { close: vi.fn() } as unknown as ImageBitmap
    scope.dispatch({ bitmap: early, id: 1, timestampMs: 10, type: 'detect' })
    await vi.waitFor(() => expect(scope.messages.some(message => message.type === 'error')).toBe(true))
    expect(early.close).toHaveBeenCalledTimes(1)

    scope.dispatch({ id: 2, type: 'future-request' } as never)
    await Promise.resolve()
    expect(scope.closed).toBe(false)
    expect(mediaPipeMocks.close).not.toHaveBeenCalled()

    scope.dispatch({ id: 3, type: 'dispose' })
    await vi.waitFor(() => expect(scope.messages).toContainEqual({ id: 3, type: 'disposed' }))

    const late = { close: vi.fn() } as unknown as ImageBitmap
    scope.dispatch({ bitmap: late, id: 4, timestampMs: 20, type: 'detect' })
    await Promise.resolve()
    expect(late.close).toHaveBeenCalledTimes(1)
  })
})
