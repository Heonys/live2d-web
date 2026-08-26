import type {
  MediaPipeWorkerRequest,
  MediaPipeWorkerResponse,
} from './protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  afterEach(() => {
    vi.useRealTimers()
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

  it('terminates an unresponsive worker instead of queueing more frames', async () => {
    const worker = new FakeWorker()
    const cleanup = vi.fn()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    tracker.attach({
      addParameterDriver: () => cleanup,
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    })
    vi.useFakeTimers()

    const pending = tracker.update({} as TexImageSource, 0)
    const rejection = expect(pending).rejects.toMatchObject({ code: 'tracking-error' })
    await vi.runAllTicks()
    await Promise.resolve()
    const detect = worker.messages.find(entry => entry.message.type === 'detect')!.message

    await vi.advanceTimersByTimeAsync(10_000)
    await rejection
    expect(cleanup).toHaveBeenCalled()
    expect(worker.terminated).toBe(true)
    await expect(tracker.update({} as TexImageSource, 34)).resolves.toEqual({ status: 'skipped' })
    expect(worker.messages.filter(entry => entry.message.type === 'detect')).toHaveLength(1)

    worker.respond({ id: detect.id, inferenceMs: 10, type: 'result' })
    expect(worker.messages.filter(entry => entry.message.type === 'detect')).toHaveLength(1)
  })

  it('terminates when a calibrated-away request never finishes', async () => {
    const worker = new FakeWorker()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    vi.useFakeTimers()

    const pending = tracker.update({} as TexImageSource, 0)
    await vi.runAllTicks()
    await Promise.resolve()
    expect(worker.messages.filter(entry => entry.message.type === 'detect')).toHaveLength(1)
    tracker.calibrate()
    await expect(pending).resolves.toEqual({ status: 'skipped' })

    await vi.advanceTimersByTimeAsync(10_000)
    expect(worker.terminated).toBe(true)
    await expect(tracker.update({} as TexImageSource, 34)).resolves.toEqual({ status: 'skipped' })
  })

  it('rejects an unexpected response for a detect request', async () => {
    const worker = new FakeWorker()
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close: vi.fn() }))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    const pending = tracker.update({} as TexImageSource, 0)
    await vi.waitFor(() => expect(worker.messages.some(entry => entry.message.type === 'detect')).toBe(true))
    const detect = worker.messages.find(entry => entry.message.type === 'detect')!.message

    worker.respond({ id: detect.id, type: 'ready' })
    await expect(pending).rejects.toMatchObject({ code: 'tracking-error' })
    expect(worker.terminated).toBe(true)
  })

  // calibrate() while a capture is in flight used to clear the busy flag that
  // belonged to the next request, letting two detects fly at once and deliver
  // results out of order.
  it('keeps one frame in flight across a mid-capture calibrate', async () => {
    const worker = new FakeWorker()
    const captures: Array<(bitmap: ImageBitmap) => void> = []
    vi.stubGlobal('createImageBitmap', vi.fn(() =>
      new Promise<ImageBitmap>(resolve => captures.push(resolve))))
    const tracker = await createMediaPipeFaceTracker(options(worker))

    const first = tracker.update({} as TexImageSource, 0)
    tracker.calibrate()
    const second = tracker.update({} as TexImageSource, 34)

    // The slot still belongs to the first frame's capture; calibrate() must
    // not have freed it on that frame's behalf.
    expect(captures).toHaveLength(1)
    await expect(second).resolves.toEqual({ status: 'skipped' })

    captures[0]({ close: vi.fn() } as unknown as ImageBitmap)
    await expect(first).resolves.toEqual({ status: 'skipped' })

    const third = tracker.update({} as TexImageSource, 68)
    await vi.waitFor(() => expect(captures).toHaveLength(2))
    captures[1]({ close: vi.fn() } as unknown as ImageBitmap)
    await vi.waitFor(() =>
      expect(worker.messages.filter(entry => entry.message.type === 'detect')).toHaveLength(1))

    tracker.dispose()
    await expect(third).resolves.toEqual({ status: 'skipped' })
  })

  // The serialized path used to replace non-finite matrix entries with 0
  // before poseFromMatrix. Keep valid blendshapes, but neutralize pose exactly
  // like the main-thread path instead of turning a corrupted matrix into a
  // full head rotation.
  it('neutralizes corrupted pose while keeping valid blendshapes', async () => {
    const worker = new FakeWorker()
    const c = Math.cos(Math.PI / 6)
    const s = Math.sin(Math.PI / 6)
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    let matrix = identity
    let blendshapes: Array<[string, number]> = []
    const original = worker.postMessage.bind(worker)
    worker.postMessage = (message, transfer) => {
      original(message, transfer)
      if (message.type === 'detect') {
        queueMicrotask(() => worker.respond({
          id: message.id,
          inferenceMs: 5,
          result: { blendshapes, matrix },
          type: 'result',
        }))
      }
    }
    vi.stubGlobal('createImageBitmap', vi.fn(() =>
      Promise.resolve({ close: vi.fn() } as unknown as ImageBitmap)))
    const tracker = await createMediaPipeFaceTracker(options(worker))
    const drivers = new Map<string, { getValue: () => number, phase?: string }>()
    tracker.attach({
      addParameterDriver: (id: string, driver: { getValue: () => number, phase?: string }) => {
        drivers.set(id, driver)
        return () => drivers.delete(id)
      },
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    })
    // Worker mode delegates attach to the shared core: the pose channel keeps
    // its before-physics phase there too.
    expect(drivers.get('ParamAngleX')?.phase).toBe('before-physics')
    expect(drivers.get('ParamMouthOpenY')?.phase).toBe('after-motion')

    for (let timestamp = 0; timestamp <= 1_020; timestamp += 34)
      await tracker.update({} as TexImageSource, timestamp)

    matrix = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, Number.NaN, 0, 0, 0, 0, 1]
    blendshapes = [['jawOpen', 1]]
    const update = await tracker.update({} as TexImageSource, 1_054)
    expect(update.status).toBe('tracked')
    expect(Math.abs(drivers.get('ParamAngleX')!.getValue())).toBeLessThan(0.5)
    expect(drivers.get('ParamMouthOpenY')!.getValue()).toBeGreaterThan(0)
    tracker.dispose()
  })

  it('terminates even when parameter-driver cleanup throws', async () => {
    const worker = new FakeWorker()
    const cleanupError = new Error('cleanup failed')
    const tracker = await createMediaPipeFaceTracker(options(worker))
    worker.postMessage = vi.fn((message: MediaPipeWorkerRequest, transfer?: Transferable[]) => {
      worker.messages.push({ message, transfer })
    })
    tracker.attach({
      addParameterDriver: () => () => {
        throw cleanupError
      },
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    })
    vi.useFakeTimers()

    expect(() => tracker.dispose()).toThrow(cleanupError)
    expect(worker.terminated).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(worker.terminated).toBe(true)
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

  it('times out initialization and rejects unexpected init responses', async () => {
    const silentWorker = new FakeWorker()
    silentWorker.postMessage = vi.fn((message: MediaPipeWorkerRequest, transfer?: Transferable[]) => {
      silentWorker.messages.push({ message, transfer })
    })
    vi.useFakeTimers()
    const creation = createMediaPipeFaceTracker(options(silentWorker))
    const rejection = expect(creation).rejects.toMatchObject({ code: 'tracking-error' })
    await vi.advanceTimersByTimeAsync(30_000)
    await rejection
    expect(silentWorker.terminated).toBe(true)
    vi.useRealTimers()

    const malformedWorker = new FakeWorker()
    malformedWorker.postMessage = vi.fn((message: MediaPipeWorkerRequest, transfer?: Transferable[]) => {
      malformedWorker.messages.push({ message, transfer })
      if (message.type === 'init')
        queueMicrotask(() => malformedWorker.respond({ id: message.id, type: 'disposed' }))
    })
    await expect(createMediaPipeFaceTracker(options(malformedWorker)))
      .rejects
      .toMatchObject({ code: 'tracking-error' })
    expect(malformedWorker.terminated).toBe(true)
  })
})
