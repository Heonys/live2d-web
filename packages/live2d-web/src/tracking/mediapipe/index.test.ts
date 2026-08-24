import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type { ParameterDriver } from '../../core/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Live2DError } from '../../core/errors'
import { createMediaPipeFaceTracker } from './index'

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

const source = {} as TexImageSource
const identity = [
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
]

function result(scores: Record<string, number> = {}, face = true): FaceLandmarkerResult {
  const categories = Object.keys(scores).length ? scores : { _neutral: 1 }
  return {
    faceBlendshapes: face
      ? [{
          categories: Object.entries(categories).map(([categoryName, score], index) => ({
            categoryName,
            displayName: '',
            index,
            score,
          })),
          headIndex: 0,
          headName: '',
        }]
      : [],
    faceLandmarks: face ? [[]] : [],
    facialTransformationMatrixes: face ? [{ columns: 4, data: identity, rows: 4 }] : [],
  }
}

function targetWithDrivers() {
  const drivers = new Map<string, ParameterDriver>()
  const cleanups: Array<ReturnType<typeof vi.fn>> = []
  return {
    cleanups,
    drivers,
    target: {
      addParameterDriver: vi.fn((id: string, driver: ParameterDriver) => {
        drivers.set(id, driver)
        const cleanup = vi.fn(() => drivers.delete(id))
        cleanups.push(cleanup)
        return cleanup
      }),
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    },
  }
}

function finishCalibration(tracker: Awaited<ReturnType<typeof createMediaPipeFaceTracker>>) {
  tracker.update(source, 0)
  for (let timestamp = 34; timestamp <= 1_020; timestamp += 34)
    tracker.update(source, timestamp)
}

describe('createMediaPipeFaceTracker', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {})
    mediaPipeMocks.close.mockReset()
    mediaPipeMocks.createFromOptions.mockReset()
    mediaPipeMocks.detectForVideo.mockReset()
    mediaPipeMocks.forVisionTasks.mockReset()
    mediaPipeMocks.forVisionTasks.mockResolvedValue({ wasm: 'fileset' })
    mediaPipeMocks.createFromOptions.mockResolvedValue({
      close: mediaPipeMocks.close,
      detectForVideo: mediaPipeMocks.detectForVideo,
    })
    mediaPipeMocks.detectForVideo.mockReturnValue(result())
  })

  it('creates a CPU video task with explicit model and output options', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })

    expect(mediaPipeMocks.createFromOptions).toHaveBeenCalledWith(
      { wasm: 'fileset' },
      expect.objectContaining({
        baseOptions: { delegate: 'CPU', modelAssetPath: '/face.task' },
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
      }),
    )
    tracker.dispose()
  })

  it('passes an explicit model buffer without converting it to a path', async () => {
    const modelAssetBuffer = new Uint8Array([1, 2, 3])
    const tracker = await createMediaPipeFaceTracker({
      delegate: 'GPU',
      modelAssetBuffer,
      wasmPath: '/buffer-wasm',
    })

    expect(mediaPipeMocks.createFromOptions).toHaveBeenLastCalledWith(
      { wasm: 'fileset' },
      expect.objectContaining({
        baseOptions: { delegate: 'GPU', modelAssetBuffer },
      }),
    )
    tracker.dispose()
  })

  it('uses the measured 15fps main-thread default', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/default-rate',
    })

    expect(tracker.update(source, 0).status).toBe('calibrating')
    expect(tracker.update(source, 50)).toEqual({ status: 'skipped' })
    expect(tracker.update(source, 67).status).toBe('calibrating')
    expect(mediaPipeMocks.detectForVideo).toHaveBeenCalledTimes(2)
    tracker.dispose()
  })

  it.each([
    { modelAssetPath: '', wasmPath: '/wasm' },
    { modelAssetPath: '/face.task', wasmPath: '' },
    { maxFps: 0, modelAssetPath: '/face.task', wasmPath: '/wasm' },
    { maxFps: 61, modelAssetPath: '/face.task', wasmPath: '/wasm' },
    { modelAssetBuffer: new Uint8Array(), wasmPath: '/wasm' },
    { modelAssetBuffer: new Uint8Array([1]), modelAssetPath: '/face.task', wasmPath: '/wasm' },
  ])('rejects invalid options %#', async (options) => {
    await expect(createMediaPipeFaceTracker(options as never)).rejects.toMatchObject({
      code: 'invalid-props',
    })
  })

  it('caps inference, calibrates, tracks, and reports loss', async () => {
    const tracker = await createMediaPipeFaceTracker({
      maxFps: 30,
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })
    expect(tracker.update(source, 0).status).toBe('calibrating')
    expect(tracker.update(source, Number.NaN)).toEqual({ status: 'skipped' })
    expect(tracker.update(source, -1)).toEqual({ status: 'skipped' })
    expect(tracker.update(source, 1)).toEqual({ status: 'skipped' })
    let update = tracker.update(source, 34)
    expect(tracker.update(source, 20)).toEqual({ status: 'skipped' })
    for (let timestamp = 68; timestamp <= 1_020; timestamp += 34)
      update = tracker.update(source, timestamp)
    expect(update.status).toBe('tracked')
    expect(tracker.isTracking()).toBe(true)

    mediaPipeMocks.detectForVideo.mockReturnValue(result({}, false))
    expect(tracker.update(source, 1_054).status).toBe('lost')
    expect(tracker.isTracking()).toBe(false)
  })

  it('attaches transient drivers, replaces a target, and cleans up once', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })
    const drivers = new Map<string, ParameterDriver>()
    const cleanup = vi.fn()
    const target = {
      addParameterDriver: vi.fn((id: string, driver: ParameterDriver) => {
        drivers.set(id, driver)
        return cleanup
      }),
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    }
    const detach = tracker.attach(target, { channels: { mouth: false } })
    expect(drivers.has('ParamMouthOpenY')).toBe(false)
    expect(drivers.get('ParamEyeLOpen')?.getValue()).toBe(1)

    tracker.attach(target)
    expect(cleanup).toHaveBeenCalled()
    detach()
    const beforeDispose = cleanup.mock.calls.length
    tracker.dispose()
    tracker.dispose()
    expect(mediaPipeMocks.close).toHaveBeenCalledTimes(1)
    expect(cleanup.mock.calls.length).toBeGreaterThan(beforeDispose)
  })

  it('mirrors left/right expressions and horizontal pose from input pixels', async () => {
    const yaw30 = [
      Math.cos(Math.PI / 6),
      0,
      -Math.sin(Math.PI / 6),
      0,
      0,
      1,
      0,
      0,
      Math.sin(Math.PI / 6),
      0,
      Math.cos(Math.PI / 6),
      0,
      0,
      0,
      0,
      1,
    ]
    const measure = async (inputMirrored: boolean) => {
      const tracker = await createMediaPipeFaceTracker({
        inputMirrored,
        modelAssetPath: '/face.task',
        wasmPath: `/mirror-${inputMirrored}`,
      })
      const { drivers, target } = targetWithDrivers()
      tracker.attach(target)
      mediaPipeMocks.detectForVideo.mockReturnValue(result({
        _neutral: 1,
        eyeBlinkLeft: 0,
        eyeBlinkRight: 0,
      }))
      finishCalibration(tracker)
      mediaPipeMocks.detectForVideo.mockReturnValue({
        ...result({ _neutral: 1, eyeBlinkLeft: 1, eyeBlinkRight: 0 }),
        facialTransformationMatrixes: [{ columns: 4, data: yaw30, rows: 4 }],
      })
      tracker.update(source, 1_088)
      const values = {
        angle: drivers.get('ParamAngleX')?.getValue() ?? 0,
        leftEye: drivers.get('ParamEyeLOpen')?.getValue() ?? 1,
        rightEye: drivers.get('ParamEyeROpen')?.getValue() ?? 1,
      }
      tracker.dispose()
      return values
    }

    const normal = await measure(false)
    const mirrored = await measure(true)
    expect(normal.leftEye).toBeLessThan(normal.rightEye)
    expect(mirrored.rightEye).toBeLessThan(mirrored.leftEye)
    expect(normal.angle).toBeGreaterThan(0)
    expect(mirrored.angle).toBeLessThan(0)
  })

  it('attaches multiple targets and makes every cleanup idempotent', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/multiple-targets',
    })
    const first = targetWithDrivers()
    const second = targetWithDrivers()
    const detachFirst = tracker.attach(first.target)
    tracker.attach(second.target)

    detachFirst()
    detachFirst()
    expect(first.cleanups.every(cleanup => cleanup.mock.calls.length === 1)).toBe(true)
    expect(second.cleanups.every(cleanup => cleanup.mock.calls.length === 0)).toBe(true)

    tracker.dispose()
    expect(second.cleanups.every(cleanup => cleanup.mock.calls.length === 1)).toBe(true)
  })

  it('keeps the previous attachment when replacement options are invalid', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })
    const cleanup = vi.fn()
    const target = {
      addParameterDriver: vi.fn(() => cleanup),
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    }
    tracker.attach(target)

    expect(() => tracker.attach(target, {
      channels: { mouth: 'yes' as unknown as boolean },
    })).toThrow(expect.objectContaining({ code: 'invalid-props' }))
    expect(cleanup).not.toHaveBeenCalled()
    tracker.dispose()
  })

  it('closes the MediaPipe task even when target cleanup fails', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })
    const cleanupError = new Error('cleanup failed')
    tracker.attach({
      addParameterDriver: () => () => { throw cleanupError },
      getModelInfo: () => ({ expressions: [], hitAreas: [], motions: {} }),
    })

    expect(() => tracker.dispose()).toThrow(cleanupError)
    expect(mediaPipeMocks.close).toHaveBeenCalledTimes(1)
    expect(() => tracker.dispose()).not.toThrow()
  })

  it('wraps inference failures without disposing the stage target', async () => {
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })
    mediaPipeMocks.detectForVideo.mockImplementation(() => {
      throw new Error('bad frame')
    })

    expect(() => tracker.update(source, 0)).toThrow(
      expect.objectContaining({ code: 'tracking-error', cause: expect.any(Error) }),
    )
  })

  it('closes a task that resolves after initialization is aborted', async () => {
    let resolveTask!: (task: { close: () => void, detectForVideo: typeof mediaPipeMocks.detectForVideo }) => void
    mediaPipeMocks.createFromOptions.mockReturnValue(new Promise((resolve) => {
      resolveTask = resolve
    }))
    const controller = new AbortController()
    const creating = createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      signal: controller.signal,
      wasmPath: '/abort-late',
    })
    await vi.waitFor(() => expect(mediaPipeMocks.createFromOptions).toHaveBeenCalled())
    controller.abort()
    await expect(creating).rejects.toMatchObject({ name: 'AbortError' })

    resolveTask({ close: mediaPipeMocks.close, detectForVideo: mediaPipeMocks.detectForVideo })
    await vi.waitFor(() => expect(mediaPipeMocks.close).toHaveBeenCalledTimes(1))
  })

  it('disposes an initialized tracker when its abort signal fires', async () => {
    const controller = new AbortController()
    const tracker = await createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      signal: controller.signal,
      wasmPath: '/abort-after-create',
    })

    controller.abort()
    expect(mediaPipeMocks.close).toHaveBeenCalledTimes(1)
    expect(tracker.isTracking()).toBe(false)
    expect(tracker.update(source, 0)).toEqual({ status: 'skipped' })
  })

  it('preserves the MediaPipe initialization failure as a tracking error cause', async () => {
    const cause = new Error('bad task')
    mediaPipeMocks.createFromOptions.mockRejectedValue(cause)

    await expect(createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/bad-task',
    })).rejects.toMatchObject({
      cause,
      code: 'tracking-error',
    })
  })

  it('is browser-only', async () => {
    vi.unstubAllGlobals()
    await expect(createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })).rejects.toEqual(expect.any(Live2DError))
  })
})
