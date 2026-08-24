import type { ModelHandle } from './contract'
import { describe, expect, it, vi } from 'vitest'
import { ManagedFeature } from './runtime-feature'

const modelA = {} as ModelHandle
const modelB = {} as ModelHandle

function deferredCleanup() {
  let reject!: (error: unknown) => void
  let resolve!: (cleanup: () => void) => void
  const promise = new Promise<() => void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('managed feature', () => {
  it('attaches synchronous setup and detaches only once', () => {
    const cleanup = vi.fn()
    const setup = vi.fn(() => cleanup)
    const report = vi.fn()
    const feature = new ManagedFeature(setup, report)

    feature.attach(modelA)
    feature.detach()
    feature.detach()

    expect(setup).toHaveBeenCalledWith(modelA)
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(report).not.toHaveBeenCalled()
  })

  it('cleans the previous model before attaching a replacement', () => {
    const events: string[] = []
    const feature = new ManagedFeature((model) => {
      events.push(model === modelA ? 'setup:a' : 'setup:b')
      return () => events.push(model === modelA ? 'cleanup:a' : 'cleanup:b')
    }, vi.fn())

    feature.attach(modelA)
    feature.attach(modelB)

    expect(events).toEqual(['setup:a', 'cleanup:a', 'setup:b'])
  })

  it('immediately cleans async setup that resolves after detach', async () => {
    const pending = deferredCleanup()
    const cleanup = vi.fn()
    const feature = new ManagedFeature(() => pending.promise, vi.fn())

    feature.attach(modelA)
    feature.detach()
    pending.resolve(cleanup)
    await pending.promise
    await Promise.resolve()

    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('ignores stale rejection and reports the current generation', async () => {
    const stale = deferredCleanup()
    const current = deferredCleanup()
    const report = vi.fn()
    const feature = new ManagedFeature(
      vi.fn()
        .mockReturnValueOnce(stale.promise)
        .mockReturnValueOnce(current.promise),
      report,
    )

    feature.attach(modelA)
    feature.attach(modelB)

    const staleError = new Error('stale')
    stale.reject(staleError)
    await expect(stale.promise).rejects.toBe(staleError)
    await Promise.resolve()
    expect(report).not.toHaveBeenCalled()

    const currentError = new Error('current')
    current.reject(currentError)
    await expect(current.promise).rejects.toBe(currentError)
    await Promise.resolve()
    expect(report).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledWith(currentError)
  })
})
