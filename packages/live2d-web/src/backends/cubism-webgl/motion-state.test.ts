import { describe, expect, it } from 'vitest'
import { Live2DError } from '../../core/errors'
import { MotionStateTracker } from './motion-state'

describe('cubism motion state tracker', () => {
  it('settles natural completion only when the queue entry finishes', async () => {
    const tracker = new MotionStateTracker<number>()
    const result = tracker.track(1)
    tracker.settleFinished(() => false)
    let settled = false
    void result.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    tracker.settleFinished(handle => handle === 1)
    await expect(result).resolves.toEqual({ status: 'completed' })
  })

  it('marks active motions interrupted but waits for their fade-out', async () => {
    const tracker = new MotionStateTracker<number>()
    const result = tracker.track(1)
    tracker.interruptActive()
    tracker.settleFinished(() => false)
    let settled = false
    void result.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    tracker.settleFinished(() => true)
    await expect(result).resolves.toEqual({ status: 'interrupted' })
  })

  it('settles every active motion as disposed exactly once', async () => {
    const tracker = new MotionStateTracker<number>()
    const first = tracker.track(1)
    const second = tracker.track(2)
    tracker.dispose()
    tracker.dispose()
    await expect(first).resolves.toEqual({ status: 'disposed' })
    await expect(second).resolves.toEqual({ status: 'disposed' })
    await expect(tracker.track(3)).resolves.toEqual({ status: 'disposed' })
  })

  it('rejects current and later playback after a render failure', async () => {
    const tracker = new MotionStateTracker<number>()
    const failure = new Live2DError('render-error', 'context lost')
    const result = tracker.track(1)
    tracker.fail(failure)
    tracker.fail(new Live2DError('render-error', 'later'))
    await expect(result).rejects.toBe(failure)
    await expect(tracker.track(2)).rejects.toBe(failure)
  })
})
