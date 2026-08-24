import type { MotionPlaybackResult, MotionSequenceStep } from './contract'
import { describe, expect, it, vi } from 'vitest'
import { playMotionSequence, validateMotionSequence } from './motion-sequence'

const info = {
  expressions: [],
  hitAreas: [],
  motions: { Idle: 2, Tap: 2 },
}

describe('motion sequences', () => {
  it('plays every step in order and reports an empty sequence as complete', async () => {
    const play = vi.fn(async (): Promise<MotionPlaybackResult> => ({ status: 'completed' }))
    const steps: MotionSequenceStep[] = [
      { group: 'Tap', index: 0, options: { fadeInMs: 100 } },
      { group: 'Idle', index: 1 },
    ]

    await expect(playMotionSequence([], info, play)).resolves.toEqual({
      completedSteps: 0,
      status: 'completed',
    })
    await expect(playMotionSequence(steps, info, play)).resolves.toEqual({
      completedSteps: 2,
      status: 'completed',
    })
    expect(play.mock.calls).toEqual([
      ['Tap', 0, { fadeInMs: 100 }],
      ['Idle', 1, undefined],
    ])
  })

  it.each(['interrupted', 'skipped', 'disposed'] as const)(
    'stops at a %s step',
    async (status) => {
      const play = vi.fn()
        .mockResolvedValueOnce({ status: 'completed' })
        .mockResolvedValueOnce({ status })
      await expect(playMotionSequence([
        { group: 'Tap', index: 0 },
        { group: 'Tap', index: 1 },
        { group: 'Idle', index: 0 },
      ], info, play)).resolves.toEqual({
        completedSteps: 1,
        status,
        stepIndex: 1,
      })
      expect(play).toHaveBeenCalledTimes(2)
    },
  )

  it('validates the whole sequence before playback', async () => {
    const play = vi.fn()
    const sequence = [
      { group: 'Tap', index: 0 },
      { group: 'Missing', index: 0 },
    ]
    await expect(playMotionSequence(sequence, info, play)).rejects.toMatchObject({
      code: 'invalid-props',
    })
    expect(play).not.toHaveBeenCalled()
  })

  it('rejects invalid indices and options', () => {
    expect(() => validateMotionSequence([{ group: 'Tap', index: 2 }], info))
      .toThrowError(expect.objectContaining({ code: 'invalid-props' }))
    expect(() => validateMotionSequence([
      { group: 'Tap', options: { priority: 'wrong' as never } },
    ], info)).toThrowError(expect.objectContaining({ code: 'invalid-props' }))
  })

  it('propagates playback errors', async () => {
    const failure = new Error('motion failed')
    await expect(playMotionSequence(
      [{ group: 'Tap' }],
      info,
      async () => { throw failure },
    )).rejects.toBe(failure)
  })
})
