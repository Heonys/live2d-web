import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
} from './protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMediaPipeFaceTracker } from './index'

class FakeWorker {
  messages: Array<{ message: MediaPipeWorkerRequest, transfer?: Transferable[] }> = []
  terminated = false
  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(message: MediaPipeWorkerRequest, transfer?: Transferable[]) {
    this.messages.push({ message, transfer })
    if (message.type === 'init')
      queueMicrotask(() => this.respond({ id: message.id, type: 'ready' }))
    if (message.type === 'dispose')
      queueMicrotask(() => this.respond({ id: message.id, type: 'disposed' }))
  }

  terminate() {
    this.terminated = true
  }

  respond(message: MediaPipeWorkerResponse) {
    this.dispatch('message', new MessageEvent('message', { data: message }))
  }

  crash(error = new Error('worker crashed')) {
    this.dispatch('error', new ErrorEvent('error', { error, message: error.message }))
  }

  private dispatch(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function')
        listener(event)
      else
        listener.handleEvent(event)
    }
  }
}

function options(worker: FakeWorker) {
  return {
    execution: 'worker' as const,
    modelAssetPath: './face.task',
    wasmPath: './wasm',
    workerFactory: () => worker as unknown as Worker,
  }
}

describe('mediaPipe worker face tracker', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', { baseURI: 'https://example.test/demo/' })
    vi.stubGlobal('ErrorEvent', class extends Event {
      error: unknown
      message: string

      constructor(type: string, init: { error: unknown, message: string }) {
        super(type)
        this.error = init.error
        this.message = init.message
      }
    })
  })

  it('normalizes asset URLs and copies a model buffer before transfer', async () => {
    const pathWorker = new FakeWorker()
    const pathTracker = await createMediaPipeFaceTracker(options(pathWorker))
    expect(pathWorker.messages[0]?.message).toMatchObject({
      options: {
        modelAssetPath: 'https://example.test/demo/face.task',
        wasmPath: 'https://example.test/demo/wasm',
      },
      type: 'init',
    })
    pathTracker.dispose()

    const bufferWorker = new FakeWorker()
    const modelAssetBuffer = new Uint8Array([1, 2, 3])
    const bufferTracker = await createMediaPipeFaceTracker({
      execution: 'worker',
      modelAssetBuffer,
      wasmPath: '/wasm',
      workerFactory: () => bufferWorker as unknown as Worker,
    })
    const init = bufferWorker.messages[0]!.message
    expect(init.type).toBe('init')
    if (init.type !== 'init')
      throw new Error('expected init')
    expect(init.options.modelAssetBuffer).not.toBe(modelAssetBuffer)
    expect([...init.options.modelAssetBuffer!]).toEqual([1, 2, 3])
    expect([...modelAssetBuffer]).toEqual([1, 2, 3])
    bufferTracker.dispose()
  })

  it('runs one frame at a time and applies normalized worker results', async () => {
    const worker = new FakeWorker()
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const tracker = await createMediaPipeFaceTracker(options(worker))

    const first = tracker.update({} as TexImageSource, 0)
    await Promise.resolve()
    await expect(tracker.update({} as TexImageSource, 34)).resolves.toEqual({ status: 'skipped' })
    const detect = worker.messages.find(entry => entry.message.type === 'detect')!
    expect(detect.transfer).toEqual([bitmap])
    worker.respond({
      id: detect.message.id,
      inferenceMs: 12,
      result: {
        blendshapes: [['_neutral', 1], ['eyeBlinkLeft', Number.NaN]],
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      },
      type: 'result',
    })
    await expect(first).resolves.toMatchObject({
      effectiveFps: 30,
      inferenceMs: 12,
      status: 'calibrating',
    })
    tracker.dispose()
  })

  it('settles an old generation once and ignores its late result', async () => {
    const worker = new FakeWorker()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    const pending = tracker.update({} as TexImageSource, 0)
    await vi.waitFor(() => expect(worker.messages.some(entry => entry.message.type === 'detect')).toBe(true))
    const detect = worker.messages.find(entry => entry.message.type === 'detect')!.message

    tracker.calibrate()
    await expect(pending).resolves.toEqual({ status: 'skipped' })
    await expect(tracker.update({} as TexImageSource, 34)).resolves.toEqual({ status: 'skipped' })
    worker.respond({ id: detect.id, inferenceMs: 10, type: 'result' })
    expect(tracker.isTracking()).toBe(false)
    const next = tracker.update({} as TexImageSource, 68)
    await vi.waitFor(() => expect(worker.messages.filter(entry => entry.message.type === 'detect')).toHaveLength(2))
    tracker.dispose()
    await expect(next).resolves.toEqual({ status: 'skipped' })
  })

  it('settles pending work on dispose and terminates after worker cleanup', async () => {
    const worker = new FakeWorker()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    const pending = tracker.update({} as TexImageSource, 0)
    await Promise.resolve()

    tracker.dispose()
    tracker.dispose()
    await expect(pending).resolves.toEqual({ status: 'skipped' })
    await Promise.resolve()
    expect(worker.terminated).toBe(true)
  })

  it('rejects the active request and terminates after a worker crash', async () => {
    const worker = new FakeWorker()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    const pending = tracker.update({} as TexImageSource, 0)
    await vi.waitFor(() => expect(worker.messages.some(entry => entry.message.type === 'detect')).toBe(true))
    worker.crash()

    await expect(pending).rejects.toMatchObject({ code: 'tracking-error' })
    expect(worker.terminated).toBe(true)
    await expect(tracker.update({} as TexImageSource, 34)).resolves.toEqual({ status: 'skipped' })
  })

  it('rejects invalid worker factories and aborts initialization', async () => {
    await expect(createMediaPipeFaceTracker({
      execution: 'worker',
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
      workerFactory: () => undefined as unknown as Worker,
    })).rejects.toMatchObject({ code: 'invalid-props' })

    const worker = new FakeWorker()
    worker.postMessage = vi.fn((message: MediaPipeWorkerRequest) => {
      worker.messages.push({ message })
    })
    const controller = new AbortController()
    const creation = createMediaPipeFaceTracker({
      ...options(worker),
      signal: controller.signal,
    })
    controller.abort()
    await expect(creation).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminated).toBe(true)
  })
})
