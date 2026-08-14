// @vitest-environment jsdom

import type {
  Live2DBackend,
  ModelHandle,
  StageHandle,
} from '../core/contract'
import type { LipSyncProps } from './LipSync'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { Profiler, StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLipSyncCachesForTests } from '../features/lipsync/source'
import { useLive2DCanvas } from './hooks'
import { LipSync } from './LipSync'
import { Live2DCanvas } from './Live2DCanvas'
import { Live2DModel } from './Live2DModel'

const wlipsync = vi.hoisted(() => ({
  createNode: vi.fn(),
  parseBinaryProfile: vi.fn(),
}))

vi.mock('wlipsync', () => ({
  createWLipSyncNode: wlipsync.createNode,
  parseBinaryProfile: wlipsync.parseBinaryProfile,
}))

interface Harness {
  afterMotion: Set<(deltaMs: number) => void>
  backend: Live2DBackend
  events: string[]
  mouth: () => number
  tick: (deltaMs: number) => void
}

function createHarness(): Harness {
  const afterMotion = new Set<(deltaMs: number) => void>()
  const events: string[] = []
  let mouth = 0.4
  const model: ModelHandle = {
    dispose: () => events.push('model:dispose'),
    expression: async () => {},
    focus: () => {},
    getIntrinsicSize: () => ({ height: 1000, width: 500 }),
    getParameter: () => mouth,
    motion: async () => {},
    onAfterMotionUpdate(callback) {
      afterMotion.add(callback)
      return () => {
        if (afterMotion.delete(callback))
          events.push('lipsync:dispose')
      }
    },
    setParameter: (_id, value) => {
      mouth = value
    },
    setTransform: () => {},
  }
  const backend: Live2DBackend = {
    createStage(_element, options): StageHandle {
      let resolution = options.resolution ?? 1
      const size = { height: options.height, width: options.width }
      return {
        dispose: () => events.push('stage:dispose'),
        getResolution: () => resolution,
        getSize: () => size,
        onError: () => () => {},
        onFrame: () => () => {},
        pause: () => {},
        resize: () => {},
        resume: () => {},
        setResolution: (next) => {
          resolution = next
        },
        toWorld: (x, y) => ({ x, y }),
      }
    },
    loadModel: async () => model,
  }
  return {
    afterMotion,
    backend,
    events,
    mouth: () => mouth,
    tick(deltaMs) {
      // The SDK motion pass runs immediately before afterMotionUpdate.
      mouth = 0.4
      for (const callback of afterMotion)
        callback(deltaMs)
    },
  }
}

function Status() {
  const stage = useLive2DCanvas()
  return <output>{stage.status}</output>
}

function createAudioSource() {
  return {
    connect: vi.fn(),
    context: { audioWorklet: {} },
    disconnect: vi.fn(),
  } as unknown as AudioNode
}

function createAnalysisNode() {
  return {
    disconnect: vi.fn(),
    port: { close: vi.fn() },
    volume: 1,
    weights: { A: 1 },
  }
}

beforeEach(() => {
  window.Live2DCubismCore = {}
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: 720,
    height: 720,
    left: 0,
    right: 1280,
    toJSON: () => ({}),
    top: 0,
    width: 1280,
    x: 0,
    y: 0,
  })
})

afterEach(() => {
  cleanup()
  clearLipSyncCachesForTests()
  delete window.Live2DCubismCore
  wlipsync.createNode.mockReset()
  wlipsync.parseBinaryProfile.mockReset()
  vi.restoreAllMocks()
})

describe('<LipSync>', () => {
  it('rejects mixed modes and use outside a model', () => {
    const driver = { getMouthOpen: () => 0, isSpeaking: () => false }
    const source = {
      connect: vi.fn(),
      context: { audioWorklet: {} },
      disconnect: vi.fn(),
    } as unknown as AudioNode
    const mixed = {
      active: true,
      driver,
      profile: {},
      source,
    } as unknown as LipSyncProps

    const harness = createHarness()
    expect(() => render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync {...mixed} />
        </Live2DModel>
      </Live2DCanvas>,
    )).toThrowError(/exactly one mode/)
    expect(() => render(<LipSync driver={driver} />)).toThrowError(/Live2DModel/)
  })

  it('drives the mouth without per-frame React commits', async () => {
    const harness = createHarness()
    let commits = 0
    const speaking = { value: true }
    const driver = {
      getMouthOpen: () => 0.8,
      isSpeaking: () => speaking.value,
    }
    render(
      <Profiler id="lipsync" onRender={() => commits++}>
        <Live2DCanvas backend={harness.backend}>
          <Live2DModel src="/model.model3.json">
            <LipSync driver={driver} />
          </Live2DModel>
          <Status />
        </Live2DCanvas>
      </Profiler>,
    )
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
    await waitFor(() => expect(harness.afterMotion.size).toBe(1))
    const commitsBeforeFrames = commits

    act(() => {
      harness.tick(16)
    })
    expect(harness.mouth()).toBe(0.8)

    speaking.value = false
    act(() => {
      harness.tick(100)
    })
    expect(harness.mouth()).toBeCloseTo(0.6)
    expect(commits).toBe(commitsBeforeFrames)
  })

  it('reads the latest driver object without resubscribing', async () => {
    const harness = createHarness()
    const first = { getMouthOpen: () => 0.2, isSpeaking: () => true }
    const second = { getMouthOpen: () => 0.9, isSpeaking: () => true }
    const view = render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync driver={first} />
        </Live2DModel>
      </Live2DCanvas>,
    )
    await waitFor(() => expect(harness.afterMotion.size).toBe(1))
    view.rerender(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync driver={second} />
        </Live2DModel>
      </Live2DCanvas>,
    )

    act(() => {
      harness.tick(16)
    })
    expect(harness.afterMotion.size).toBe(1)
    expect(harness.mouth()).toBe(0.9)
  })

  it('reports a driver error once without failing the model', async () => {
    const harness = createHarness()
    const onError = vi.fn()
    const driver = {
      getMouthOpen: () => {
        throw new Error('analyzer failed')
      },
      isSpeaking: () => true,
    }
    render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync driver={driver} onError={onError} />
        </Live2DModel>
        <Status />
      </Live2DCanvas>,
    )
    await waitFor(() => expect(harness.afterMotion.size).toBe(1))

    act(() => {
      harness.tick(16)
      harness.tick(16)
    })
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0]?.[0].code).toBe('lipsync-error')
    expect(screen.getByText('ready')).toBeTruthy()
  })

  it('keeps source analysis connected while active changes', async () => {
    const harness = createHarness()
    const source = createAudioSource()
    const node = createAnalysisNode()
    wlipsync.createNode.mockResolvedValue(node)
    const profile = { profile: 'object' }
    const view = render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync active profile={profile as never} source={source} />
        </Live2DModel>
      </Live2DCanvas>,
    )
    await waitFor(() => expect(source.connect).toHaveBeenCalledOnce())
    await waitFor(() => expect(harness.afterMotion.size).toBe(1))

    act(() => harness.tick(16))
    expect(harness.mouth()).toBeCloseTo(0.7)

    view.rerender(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync active={false} profile={profile as never} source={source} />
        </Live2DModel>
      </Live2DCanvas>,
    )
    act(() => harness.tick(100))

    expect(wlipsync.createNode).toHaveBeenCalledOnce()
    expect(source.disconnect).not.toHaveBeenCalled()
    expect(harness.mouth()).toBeCloseTo(0.55)

    view.unmount()
    expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(node)
    expect(node.disconnect).toHaveBeenCalledOnce()
    expect(node.port.close).toHaveBeenCalledOnce()
  })

  it('disposes a stale source generation after profile replacement', async () => {
    const harness = createHarness()
    const firstSource = createAudioSource()
    const secondSource = createAudioSource()
    const firstNode = createAnalysisNode()
    const secondNode = createAnalysisNode()
    let resolveFirst!: (node: typeof firstNode) => void
    let resolveSecond!: (node: typeof secondNode) => void
    wlipsync.createNode
      .mockImplementationOnce(() => new Promise(resolve => resolveFirst = resolve))
      .mockImplementationOnce(() => new Promise(resolve => resolveSecond = resolve))
    const firstProfile = { generation: 1 }
    const secondProfile = { generation: 2 }

    const view = render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync
            active
            profile={firstProfile as never}
            source={firstSource}
          />
        </Live2DModel>
      </Live2DCanvas>,
    )
    await waitFor(() => expect(wlipsync.createNode).toHaveBeenCalledOnce())

    view.rerender(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync
            active
            profile={secondProfile as never}
            source={secondSource}
          />
        </Live2DModel>
      </Live2DCanvas>,
    )
    await waitFor(() => expect(wlipsync.createNode).toHaveBeenCalledTimes(2))

    await act(async () => resolveFirst(firstNode))
    await waitFor(() => expect(firstSource.disconnect).toHaveBeenCalledOnce())
    expect(firstNode.disconnect).toHaveBeenCalledOnce()
    expect(firstNode.port.close).toHaveBeenCalledOnce()

    await act(async () => resolveSecond(secondNode))
    await waitFor(() => expect(secondSource.connect).toHaveBeenCalledOnce())
    expect(harness.afterMotion.size).toBe(1)

    view.unmount()
    expect(secondSource.disconnect).toHaveBeenCalledOnce()
  })

  it('reports source initialization failure once and leaves the model ready', async () => {
    const harness = createHarness()
    const onError = vi.fn()
    wlipsync.createNode.mockRejectedValue(new Error('worklet unavailable'))

    render(
      <StrictMode>
        <Live2DCanvas backend={harness.backend}>
          <Live2DModel src="/model.model3.json">
            <LipSync
              active
              profile={{} as never}
              source={createAudioSource()}
              onError={onError}
            />
          </Live2DModel>
          <Status />
        </Live2DCanvas>
      </StrictMode>,
    )

    await waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(onError.mock.calls[0]?.[0].code).toBe('lipsync-error')
    expect(screen.getByText('ready')).toBeTruthy()
  })

  it('does not initialize wlipsync in driver mode', async () => {
    const harness = createHarness()
    render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync driver={{
            getMouthOpen: () => 0,
            isSpeaking: () => false,
          }}
          />
        </Live2DModel>
      </Live2DCanvas>,
    )
    await waitFor(() => expect(harness.afterMotion.size).toBe(1))
    expect(wlipsync.createNode).not.toHaveBeenCalled()
  })

  it('waits without error when the source is null', async () => {
    const harness = createHarness()
    const onError = vi.fn()
    render(
      <Live2DCanvas backend={harness.backend}>
        <Live2DModel src="/model.model3.json">
          <LipSync
            active={false}
            profile={{} as never}
            source={null}
            onError={onError}
          />
        </Live2DModel>
        <Status />
      </Live2DCanvas>,
    )
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
    expect(wlipsync.createNode).not.toHaveBeenCalled()
    expect(harness.afterMotion.size).toBe(0)
    expect(onError).not.toHaveBeenCalled()
  })

  it('is StrictMode-safe and cleans the feature before model and stage', async () => {
    const harness = createHarness()
    const driver = { getMouthOpen: () => 0, isSpeaking: () => false }
    for (let index = 0; index < 20; index++) {
      const view = render(
        <StrictMode>
          <Live2DCanvas backend={harness.backend}>
            <Live2DModel src="/model.model3.json">
              <LipSync driver={driver} />
            </Live2DModel>
          </Live2DCanvas>
        </StrictMode>,
      )
      await waitFor(() => expect(harness.afterMotion.size).toBe(1))
      view.unmount()
      expect(harness.afterMotion.size).toBe(0)
    }

    const feature = harness.events.lastIndexOf('lipsync:dispose')
    const model = harness.events.lastIndexOf('model:dispose')
    const stage = harness.events.lastIndexOf('stage:dispose')
    expect(feature).toBeGreaterThan(-1)
    expect(feature).toBeLessThan(model)
    expect(model).toBeLessThan(stage)
  })
})
