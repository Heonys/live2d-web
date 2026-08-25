import { describe, expect, it } from 'vitest'
import { FaceTrackingState, poseFromMatrix } from './state'

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

function input(scores: Record<string, number> = {}, matrix = identity) {
  return { blendshapes: new Map(Object.entries(scores)), matrix }
}

function calibrate(state: FaceTrackingState, scores: Record<string, number> = {}) {
  let update = state.update(input(scores), 0)
  for (let timestamp = 34; timestamp <= 1_020; timestamp += 34)
    update = state.update(input(scores), timestamp)
  return update
}

describe('mediaPipe face tracking state', () => {
  it('calibrates for one second and subtracts the neutral baseline', () => {
    const state = new FaceTrackingState()
    const update = calibrate(state, { mouthSmileLeft: 0.1 })

    expect(update.status).toBe('tracked')
    expect(update.signals?.blendshapes.get('mouthSmileLeft')).toBeCloseTo(0)

    const smile = state.update(input({ mouthSmileLeft: 0.7 }), 1_054)
    expect(smile.signals?.blendshapes.get('mouthSmileLeft')).toBeGreaterThan(0.2)
  })

  it('smooths by elapsed time and never emits invalid values', () => {
    const a = new FaceTrackingState()
    const b = new FaceTrackingState()
    calibrate(a)
    calibrate(b)

    const once = a.update(input({ jawOpen: 1 }), 1_120)
    let split = b.update(input({ jawOpen: 1 }), 1_070)
    split = b.update(input({ jawOpen: 1 }), 1_120)

    expect(once.signals?.blendshapes.get('jawOpen')).toBeCloseTo(
      split.signals?.blendshapes.get('jawOpen') ?? -1,
      5,
    )
    expect(Number.isFinite(split.signals?.pose.x)).toBe(true)
  })

  it('holds a lost face briefly and then returns toward neutral', () => {
    const state = new FaceTrackingState()
    calibrate(state)
    const tracked = state.update(input({ jawOpen: 1 }), 1_120)
    const open = tracked.signals?.blendshapes.get('jawOpen') ?? 0

    const held = state.update(undefined, 1_300)
    expect(held.signals?.blendshapes.get('jawOpen')).toBeCloseTo(open)

    const releasing = state.update(undefined, 1_500)
    expect(releasing.status).toBe('lost')
    expect(releasing.signals?.blendshapes.get('jawOpen')).toBeLessThan(open)

    const neutral = state.update(undefined, 1_670)
    expect(neutral.signals?.blendshapes.get('jawOpen')).toBe(0)
    expect(neutral.signals?.pose).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('extracts finite Euler angles and rejects invalid matrices', () => {
    expect(poseFromMatrix(identity)).toEqual({ x: -0, y: -0, z: -0 })
    expect(poseFromMatrix([Number.NaN])).toEqual({ x: 0, y: 0, z: 0 })

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
    expect(poseFromMatrix(yaw30).x).toBeCloseTo(30)
  })

  it('restarts calibration without retaining prior signals', () => {
    const state = new FaceTrackingState()
    calibrate(state)
    state.update(input({ jawOpen: 1 }), 1_120)
    state.calibrate()

    const update = state.update(input(), 2_000)
    expect(update).toMatchObject({ calibrated: false, signals: undefined, status: 'calibrating' })
  })

  // The delta fed to smoothing is clamped to 100ms; calibration must not be.
  it('calibrates on wall-clock time even at a low inference rate', () => {
    const state = new FaceTrackingState()
    let update = state.update(input(), 0)
    for (let timestamp = 200; timestamp <= 1_000; timestamp += 200)
      update = state.update(input(), timestamp)

    expect(update.status).toBe('tracked')
  })

  it('does not amplify frame jitter on a near-saturated neutral', () => {
    const state = new FaceTrackingState()
    calibrate(state, { _neutral: 0.98 })

    let low = Number.POSITIVE_INFINITY
    let high = Number.NEGATIVE_INFINITY
    for (let step = 1; step <= 20; step++) {
      const score = step % 2 ? 0.985 : 0.975
      const update = state.update(input({ _neutral: score }), 1_020 + step * 34)
      const value = update.signals?.blendshapes.get('_neutral') ?? 0
      low = Math.min(low, value)
      high = Math.max(high, value)
    }

    expect(high - low).toBeLessThan(0.05)
  })

  // Column-major rotation matrices. These pin the sign convention so a
  // refactor cannot flip an axis unnoticed; whether each sign matches a real
  // camera is a consumer check with a live face.
  it('keeps pitch and roll signs stable', () => {
    const c = Math.cos(Math.PI / 9)
    const s = Math.sin(Math.PI / 9)
    const pitch20 = [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]
    const roll20 = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

    expect(poseFromMatrix(pitch20).y).toBeCloseTo(-20)
    expect(poseFromMatrix(pitch20).x).toBeCloseTo(0)
    expect(poseFromMatrix(roll20).z).toBeCloseTo(-20)
    expect(poseFromMatrix(roll20).x).toBeCloseTo(0)
  })
})
