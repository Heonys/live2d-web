import type { Profile } from 'wlipsync'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearLipSyncCachesForTests,
  createSourceLipSync,
  createSourceMouthReader,
  resolveLipSyncProfile,
} from './source'

const profile: Profile = {
  compareMethod: 0,
  melFilterBankChannels: 1,
  mfccDataCount: 1,
  mfccNum: 1,
  mfccs: [],
  sampleCount: 128,
  targetSampleRate: 16_000,
  useStandardization: false,
}

function moduleStub() {
  return {
    createWLipSyncNode: vi.fn(),
    parseBinaryProfile: vi.fn(() => profile),
  }
}

function response(body: unknown, status = 200) {
  return {
    arrayBuffer: vi.fn(async () => body as ArrayBuffer),
    json: vi.fn(async () => body),
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response
}

afterEach(() => {
  clearLipSyncCachesForTests()
  vi.restoreAllMocks()
})

describe('lip-sync profiles', () => {
  it('loads and deduplicates JSON profile URLs', async () => {
    const module = moduleStub()
    const fetcher = vi.fn(async () => response(profile))

    const first = resolveLipSyncProfile('/voice.json', module, fetcher)
    const second = resolveLipSyncProfile('/voice.json', module, fetcher)

    await expect(first).resolves.toBe(profile)
    await expect(second).resolves.toBe(profile)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(module.parseBinaryProfile).not.toHaveBeenCalled()
  })

  it('parses binary URL and ArrayBuffer profiles', async () => {
    const module = moduleStub()
    const urlBuffer = new ArrayBuffer(8)
    const directBuffer = new ArrayBuffer(4)
    const fetcher = vi.fn(async () => response(urlBuffer))

    await expect(resolveLipSyncProfile('/voice.bin?revision=1', module, fetcher))
      .resolves
      .toBe(profile)
    await expect(resolveLipSyncProfile(directBuffer, module, fetcher))
      .resolves
      .toBe(profile)
    expect(module.parseBinaryProfile).toHaveBeenNthCalledWith(1, urlBuffer)
    expect(module.parseBinaryProfile).toHaveBeenNthCalledWith(2, directBuffer)
  })

  it('uses profile objects directly and evicts failed URL requests', async () => {
    const module = moduleStub()
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response(null, 503))
      .mockResolvedValueOnce(response(profile))

    await expect(resolveLipSyncProfile('/retry.json', module, fetcher))
      .rejects
      .toThrow('503')
    await expect(resolveLipSyncProfile('/retry.json', module, fetcher))
      .resolves
      .toBe(profile)
    await expect(resolveLipSyncProfile(profile, module, fetcher))
      .resolves
      .toBe(profile)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('source lip sync', () => {
  it('projects vowel weights with 50ms updates and smoothing', () => {
    let now = 0
    const node = {
      volume: 1,
      weights: { A: 1, E: 0, I: 0, O: 0, S: 0, U: 0 },
    }
    const read = createSourceMouthReader(node, () => now)
    expect(read()).toBeCloseTo(0.7)

    node.weights.A = 0
    now = 25
    expect(read()).toBeCloseTo(0.7)
    now = 50
    expect(read()).toBeCloseTo(0.35)
    now = 100
    expect(read()).toBe(0)
  })

  it('disconnects only its edge and does not own the AudioContext', async () => {
    const context = {
      audioWorklet: {},
      close: vi.fn(),
      suspend: vi.fn(),
    }
    const source = {
      connect: vi.fn(),
      context,
      disconnect: vi.fn(),
    } as unknown as AudioNode
    const node = {
      disconnect: vi.fn(),
      port: { close: vi.fn() },
      volume: 0,
      weights: {},
    }
    const module = moduleStub()
    module.createWLipSyncNode.mockResolvedValue(node)

    const connection = await createSourceLipSync(source, profile, {
      loadModule: async () => module,
    })
    connection.dispose()
    connection.dispose()

    expect(source.connect).toHaveBeenCalledExactlyOnceWith(node)
    expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(node)
    expect(node.disconnect).toHaveBeenCalledOnce()
    expect(node.port.close).toHaveBeenCalledOnce()
    expect(context.close).not.toHaveBeenCalled()
    expect(context.suspend).not.toHaveBeenCalled()
  })

  it('cleans up a node when connecting the source fails', async () => {
    const source = {
      connect: vi.fn(() => {
        throw new Error('cannot connect')
      }),
      context: { audioWorklet: {} },
      disconnect: vi.fn(),
    } as unknown as AudioNode
    const node = {
      disconnect: vi.fn(),
      port: { close: vi.fn() },
      volume: 0,
      weights: {},
    }
    const module = moduleStub()
    module.createWLipSyncNode.mockResolvedValue(node)

    await expect(createSourceLipSync(source, profile, {
      loadModule: async () => module,
    })).rejects.toThrow('cannot connect')
    expect(source.disconnect).not.toHaveBeenCalled()
    expect(node.disconnect).toHaveBeenCalledOnce()
    expect(node.port.close).toHaveBeenCalledOnce()
  })
})
