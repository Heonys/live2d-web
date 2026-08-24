import { describe, expect, it, vi } from 'vitest'
import { preparePlaybackMotion } from './motion-playback'

interface FakeMotion {
  curveFadeIn: number
  fadeIn: number
  fadeOut: number
  setFadeInTime: (seconds: number) => void
  setFadeOutTime: (seconds: number) => void
}

function fakeMotion(fadeIn = 0.75, fadeOut = 1): FakeMotion {
  return {
    curveFadeIn: 0.2,
    fadeIn,
    fadeOut,
    setFadeInTime(seconds) {
      this.fadeIn = seconds
    },
    setFadeOutTime(seconds) {
      this.fadeOut = seconds
    },
  }
}

describe('cubism motion playback ownership', () => {
  it('reuses the authored cache object when no override is supplied', () => {
    const cached = fakeMotion()
    const parse = vi.fn(() => fakeMotion())
    const release = vi.fn()

    const playback = preparePlaybackMotion(
      { buffer: new ArrayBuffer(1), motion: cached },
      {},
      parse,
      release,
    )

    expect(playback.motion).toBe(cached)
    expect(playback.autoDelete).toBe(false)
    expect(parse).not.toHaveBeenCalled()
    playback.releaseBeforeStart()
    expect(release).not.toHaveBeenCalled()
  })

  it('creates isolated objects and only replaces motion-wide values', () => {
    const cached = fakeMotion()
    const created: FakeMotion[] = []
    const parse = vi.fn(() => {
      const motion = fakeMotion()
      created.push(motion)
      return motion
    })
    const asset = { buffer: new ArrayBuffer(1), motion: cached }

    const instant = preparePlaybackMotion(
      asset,
      { fadeInSeconds: 0, fadeOutSeconds: 0 },
      parse,
      vi.fn(),
    )
    const slow = preparePlaybackMotion(
      asset,
      { fadeInSeconds: 0.5 },
      parse,
      vi.fn(),
    )

    expect(instant.motion).not.toBe(slow.motion)
    expect(created).toHaveLength(2)
    expect(instant.motion).toMatchObject({
      curveFadeIn: 0.2,
      fadeIn: 0,
      fadeOut: 0,
    })
    expect(slow.motion).toMatchObject({
      curveFadeIn: 0.2,
      fadeIn: 0.5,
      fadeOut: 1,
    })
    expect(cached).toMatchObject({ fadeIn: 0.75, fadeOut: 1 })
  })

  it('releases an unstarted clone once but leaves queue-owned clones alone', () => {
    const asset = { buffer: new ArrayBuffer(1), motion: fakeMotion() }
    const release = vi.fn()
    const stale = preparePlaybackMotion(
      asset,
      { fadeInSeconds: 0.25 },
      () => fakeMotion(),
      release,
    )

    stale.releaseBeforeStart()
    stale.releaseBeforeStart()
    expect(release).toHaveBeenCalledTimes(1)

    const queued = preparePlaybackMotion(
      asset,
      { fadeOutSeconds: 0.4 },
      () => fakeMotion(),
      release,
    )
    queued.transferToQueue()
    queued.releaseBeforeStart()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
