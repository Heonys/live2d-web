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

  // MediaPipe never reports 1 for a shut eye. Held medians read 0.73 and 0.68 on
  // the two sides, which normalized against 1 reached the model as a lid a third
  // open and looked like a squint rather than a blink.
  it('closes an eye fully on the score a real closure reports', () => {
    const state = new FaceTrackingState()
    calibrate(state)

    let update = state.update(input({ eyeBlinkLeft: 0.73 }), 1_054)
    update = state.update(input({ eyeBlinkLeft: 0.73 }), 1_088)
    expect(update.signals?.blendshapes.get('eyeBlinkLeft') ?? 0).toBeGreaterThan(0.95)
  })

  // The wearer's own neutral is the floor, so a face that scores a little while
  // doing nothing still reaches the model as zero. A fixed floor cannot do this:
  // the resting score moved between 0.04 and 0.13 as the light and the angle
  // changed, and only calibration sees the current one.
  it('reads a calibrated resting face as no blink at all', () => {
    const state = new FaceTrackingState()
    calibrate(state, { eyeBlinkLeft: 0.02, eyeBlinkRight: 0.06 })

    const update = state.update(input({ eyeBlinkLeft: 0.02, eyeBlinkRight: 0.06 }), 1_054)
    expect(update.signals?.blendshapes.get('eyeBlinkLeft') ?? -1).toBeCloseTo(0)
    expect(update.signals?.blendshapes.get('eyeBlinkRight') ?? -1).toBeCloseTo(0)
  })

  it('leaves held expressions normalized against the full range', () => {
    const state = new FaceTrackingState()
    calibrate(state)

    // Only the blink shapes get the lower ceiling; a squint reaching 0.72 must
    // not read as fully squinting.
    let update = state.update(input({ eyeSquintLeft: 0.72 }), 1_054)
    for (let timestamp = 1_088; timestamp <= 1_400; timestamp += 34)
      update = state.update(input({ eyeSquintLeft: 0.72 }), timestamp)
    expect(update.signals?.blendshapes.get('eyeSquintLeft') ?? 0).toBeLessThan(0.8)
  })

  // A real blink spans three or four frames at 30fps. Smoothing tuned for head
  // pose averaged the peak away, so the model held its eyes half shut instead of
  // blinking. Closing now follows the signal; opening keeps the shared constant.
  it('lands a blink within a few frames and eases the eye back open', () => {
    const state = new FaceTrackingState()
    calibrate(state)

    let closing = state.update(input({ eyeBlinkLeft: 0.8 }), 1_054)
    closing = state.update(input({ eyeBlinkLeft: 0.8 }), 1_088)
    const closed = closing.signals?.blendshapes.get('eyeBlinkLeft') ?? 0
    expect(closed).toBeGreaterThan(0.75)

    const opening = state.update(input({ eyeBlinkLeft: 0 }), 1_122)
    const opened = opening.signals?.blendshapes.get('eyeBlinkLeft') ?? 0
    // Opening stays smooth, so one frame does not snap the lid all the way up.
    expect(opened).toBeGreaterThan(0.1)
    expect(opened).toBeLessThan(closed)
  })

  it('keeps held expressions on the shared smoothing', () => {
    const state = new FaceTrackingState()
    calibrate(state)

    // A squint is not a transient, so it must not inherit the blink attack.
    const first = state.update(input({ eyeSquintLeft: 1 }), 1_034)
    expect(first.signals?.blendshapes.get('eyeSquintLeft') ?? 0).toBeLessThan(0.6)
  })

  // Default. Recentring the head the moment a wearer glances off-camera reads
  // as a snap, so the last pose stays until the face comes back.
  it('holds the last pose indefinitely while the face is lost', () => {
    const state = new FaceTrackingState()
    calibrate(state)
    const tracked = state.update(input({ jawOpen: 1 }), 1_120)
    const open = tracked.signals?.blendshapes.get('jawOpen') ?? 0

    for (const timestamp of [1_300, 1_500, 3_000, 30_000]) {
      const lost = state.update(undefined, timestamp)
      expect(lost.status).toBe('lost')
      expect(lost.signals?.blendshapes.get('jawOpen')).toBeCloseTo(open)
    }
  })

  it('returns toward neutral when asked to', () => {
    const state = new FaceTrackingState({ onFaceLost: 'neutral' })
    calibrate(state)
    const tracked = state.update(input({ jawOpen: 1 }), 1_120)
    const open = tracked.signals?.blendshapes.get('jawOpen') ?? 0

    const held = state.update(undefined, 1_600)
    expect(held.signals?.blendshapes.get('jawOpen')).toBeCloseTo(open)

    const releasing = state.update(undefined, 2_400)
    expect(releasing.status).toBe('lost')
    expect(releasing.signals?.blendshapes.get('jawOpen')).toBeLessThan(open)

    const neutral = state.update(undefined, 3_000)
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

  // MediaPipe fits the canonical face with a similarity transform, so the
  // basis carries head scale. Before normalizing, a scaled basis shrank yaw
  // (asin reads one entry) while leaving pitch and roll intact (atan2 takes a
  // ratio). Measured live as a large head turn reporting a few degrees.
  it.each([0.5, 0.85, 1, 1.4])('recovers angles from a basis scaled by %s', (scale) => {
    const c = Math.cos(Math.PI / 6)
    const s = Math.sin(Math.PI / 6)
    const scaled = [
      c * scale,
      0,
      -s * scale,
      0,
      0,
      scale,
      0,
      0,
      s * scale,
      0,
      c * scale,
      0,
      0,
      0,
      0,
      1,
    ]

    expect(poseFromMatrix(scaled).x).toBeCloseTo(30)
  })

  // Pitch is the only axis whose atan2 operands come from two different basis
  // columns, so it is the only one whose value survives normalization scaled by
  // the ratio between them. A uniformly scaled fixture cannot show that.
  it.each([0.6, 1, 1.5])('recovers pitch from a basis scaled by %s', (scale) => {
    const c = Math.cos(Math.PI / 9)
    const s = Math.sin(Math.PI / 9)
    const scaled = [
      scale,
      0,
      0,
      0,
      0,
      c * scale,
      s * scale,
      0,
      0,
      -s * scale,
      c * scale,
      0,
      0,
      0,
      0,
      1,
    ]

    expect(poseFromMatrix(scaled).y).toBeCloseTo(-20)
  })

  // Pitch divides its two operands by two different column lengths, so a basis
  // whose columns are scaled unequally is the case that would distort it while
  // leaving yaw and roll intact. Normalizing per column recovers the rotation
  // exactly, which is what this pins.
  it('recovers pitch from a basis whose columns are scaled unequally', () => {
    const c = Math.cos(Math.PI / 9)
    const s = Math.sin(Math.PI / 9)
    const [sx, sy, sz] = [0.7, 1.3, 0.9]
    const skewed = [
      sx,
      0,
      0,
      0,
      0,
      c * sy,
      s * sy,
      0,
      0,
      -s * sz,
      c * sz,
      0,
      0,
      0,
      0,
      1,
    ]

    expect(poseFromMatrix(skewed).y).toBeCloseTo(-20)
    expect(poseFromMatrix(skewed).x).toBeCloseTo(0)
    expect(poseFromMatrix(skewed).z).toBeCloseTo(0)
  })

  // Two axes at once. Every earlier fixture rotates about a single axis, which
  // cannot catch a decomposition that mixes them.
  it('separates yaw and pitch applied together', () => {
    const cy = Math.cos(Math.PI / 12)
    const sy = Math.sin(Math.PI / 12)
    const cp = Math.cos(Math.PI / 9)
    const sp = Math.sin(Math.PI / 9)
    // Ry(15)·Rx(20) stored column-major, matching the ZYX convention the
    // extraction assumes. Written out rather than multiplied so the fixture
    // cannot inherit a mistake from the code under test.
    const combined = [
      cy,
      0,
      -sy,
      0,
      sy * sp,
      cp,
      cy * sp,
      0,
      sy * cp,
      -sp,
      cy * cp,
      0,
      0,
      0,
      0,
      1,
    ]

    const pose = poseFromMatrix(combined)
    expect(pose.x).toBeCloseTo(15)
    expect(pose.y).toBeCloseTo(-20)
    expect(pose.z).toBeCloseTo(0)
  })

  it('rejects a degenerate basis instead of returning NaN', () => {
    expect(poseFromMatrix(Array.from<number>({ length: 16 }).fill(0)))
      .toEqual({ x: 0, y: 0, z: 0 })
  })

  // As the face leaves frame the estimate breaks down and slams the pose to
  // the parameter rail for a frame or two. A head cannot actually move that
  // fast, so the jump is capped rather than dropped: dropping would stall a
  // genuine fast turn.
  it('caps an implausible pose jump instead of passing it through', () => {
    const state = new FaceTrackingState()
    calibrate(state)

    const yaw = (degrees: number) => {
      const radians = degrees * Math.PI / 180
      return {
        blendshapes: new Map<string, number>(),
        pose: { x: degrees, y: 0, z: 0 },
        matrix: [
          Math.cos(radians),
          0,
          -Math.sin(radians),
          0,
          0,
          1,
          0,
          0,
          Math.sin(radians),
          0,
          Math.cos(radians),
          0,
          0,
          0,
          0,
          1,
        ],
      }
    }

    // 34ms at 360 deg/s allows ~12 degrees; the estimate claims 80.
    state.update(yaw(0), 1_054)
    const slammed = state.update(yaw(80), 1_088)
    expect(slammed.signals?.pose.x).toBeLessThan(13)

    // A sustained turn still gets there, just across several frames.
    let last = 0
    for (let timestamp = 1_122; timestamp <= 1_500; timestamp += 34)
      last = state.update(yaw(80), timestamp).signals?.pose.x ?? 0
    expect(last).toBeGreaterThan(60)
  })

  it('leaves calibration frames unlimited so the baseline stays honest', () => {
    const state = new FaceTrackingState()
    let update = state.update({ blendshapes: new Map(), pose: { x: 0, y: 0, z: 0 } }, 0)
    for (let timestamp = 34; timestamp <= 1_020; timestamp += 34)
      update = state.update({ blendshapes: new Map(), pose: { x: 40, y: 0, z: 0 } }, timestamp)

    expect(update.status).toBe('tracked')
    // The baseline averaged the 40-degree frames, so holding there reads as
    // neutral rather than as a capped ramp.
    expect(update.signals?.pose.x).toBeLessThan(5)
  })
})
