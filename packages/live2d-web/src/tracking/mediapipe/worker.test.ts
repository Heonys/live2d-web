import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
} from './protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { startMediaPipeFaceTrackerWorker } from './worker'

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
      type: 'init',
    })
    await vi.waitFor(() => expect(scope.messages).toContainEqual({ id: 0, type: 'ready' }))
    expect(mediaPipeMocks.forVisionTasks).toHaveBeenCalledWith(
      'https://example.test/wasm',
      useModule,
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
})
