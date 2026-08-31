import type { MediaPipeBlendshape } from './blendshapes'
import type { MediaPipeFaceLostBehaviour } from './types'
import { MEDIAPIPE_BLENDSHAPES } from './blendshapes'

export interface FaceTrackingInput {
  blendshapes: ReadonlyMap<string, number>
  matrix?: readonly number[]
  pose?: { x: number, y: number, z: number }
}

export interface FaceTrackingSignals {
  blendshapes: ReadonlyMap<MediaPipeBlendshape, number>
  pose: { x: number, y: number, z: number }
}

export interface FaceTrackingStateUpdate {
  calibrated: boolean
  status: 'calibrating' | 'tracked' | 'lost'
  signals: FaceTrackingSignals | undefined
}

const CALIBRATION_MS = 1_000
// 250ms + 300ms put the head back at centre inside half a second, which reads
// as a snap when the wearer only glanced away. Only 'neutral' decays at all.
const LOST_HOLD_MS = 1_000
const LOST_RELEASE_MS = 800
const POSE_SMOOTHING_MS = 100
const FACE_SMOOTHING_MS = 60
// A blink is over in roughly 120ms, three or four frames at 30fps. Smoothing
// chosen for head pose averages that peak away: the lid only reaches halfway
// before the eye is already reopening, so the model reads as holding its eyes
// half shut rather than blinking. Closing therefore follows the signal almost
// directly while opening keeps the shared constant, the attack-and-release
// shape createVolumeLipSync already uses on speech. Only the blink shapes get
// this; a squint is a held expression and should stay smooth.
const BLINK_CLOSE_SMOOTHING_MS = 12
const BLINK_BLENDSHAPES = new Set<MediaPipeBlendshape>([
  'eyeBlinkLeft',
  'eyeBlinkRight',
])
// The highest a shut eye actually scores. MediaPipe never reports 1, so
// normalizing against 1 left a fully closed eye reaching only two thirds of the
// way and the model read as squinting rather than blinking. Held medians with
// the eyes closed measured 0.73 and 0.68 on the two sides, and an earlier
// session on another camera read about 0.8.
//
// This is deliberately not a `sensitivity` change. Gain multiplies the resting
// offset and the left-right difference along with the movement, which is why
// raising it was rejected before. Normalizing against the reachable maximum
// moves the top of the range and leaves a calibrated neutral at zero.
//
// One face, two cameras. A camera that scores higher will saturate early, so
// revisit this with a second face.
const FULL_BLINK_SCORE = 0.72
// A head cannot cross 360 degrees in a second. Anything faster is the pose
// estimate breaking down as the face leaves frame, which reached the model as
// a one-frame slam to the parameter rail.
const MAX_POSE_DEGREES_PER_SECOND = 360

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function exponentialStep(current: number, target: number, deltaMs: number, timeMs: number) {
  if (deltaMs <= 0)
    return current
  const alpha = 1 - Math.exp(-deltaMs / timeMs)
  return current + (target - current) * alpha
}

function columnLength(matrix: readonly number[], column: number) {
  const x = matrix[column * 4]
  const y = matrix[column * 4 + 1]
  const z = matrix[column * 4 + 2]
  return Math.hypot(x, y, z)
}

/**
 * Extracts Live2D-oriented Euler angles from a column-major 4x4 matrix.
 *
 * MediaPipe fits the canonical face with a similarity transform, so the basis
 * carries the head's scale as well as its rotation. Dividing it out matters
 * asymmetrically: the two atan2 axes take a ratio and cancel scale on their
 * own, but asin reads a single entry and would report a smaller angle than the
 * head actually turned.
 */
export function poseFromMatrix(matrix?: readonly number[]) {
  if (!matrix || matrix.length < 16 || matrix.some(value => !Number.isFinite(value)))
    return { x: 0, y: 0, z: 0 }
  const scaleX = columnLength(matrix, 0)
  const scaleY = columnLength(matrix, 1)
  const scaleZ = columnLength(matrix, 2)
  if (scaleX === 0 || scaleY === 0 || scaleZ === 0)
    return { x: 0, y: 0, z: 0 }
  const r00 = matrix[0] / scaleX
  const r10 = matrix[1] / scaleX
  const r20 = matrix[2] / scaleX
  const r21 = matrix[6] / scaleY
  const r22 = matrix[10] / scaleZ
  const radiansToDegrees = 180 / Math.PI
  return {
    x: Math.asin(clamp(-r20, -1, 1)) * radiansToDegrees,
    y: -Math.atan2(r21, r22) * radiansToDegrees,
    z: -Math.atan2(r10, r00) * radiansToDegrees,
  }
}

function emptySignals(): FaceTrackingSignals {
  return {
    blendshapes: new Map(MEDIAPIPE_BLENDSHAPES.map(name => [name, 0])),
    pose: { x: 0, y: 0, z: 0 },
  }
}

export interface FaceTrackingStateOptions {
  onFaceLost?: MediaPipeFaceLostBehaviour
}

export class FaceTrackingState {
  private readonly onFaceLost: MediaPipeFaceLostBehaviour
  private baselineBlendshapeSums = new Map<MediaPipeBlendshape, number>()
  private baselinePoseSum = { x: 0, y: 0, z: 0 }
  private calibrationStartedAt: number | undefined
  private calibrationFrames = 0
  private calibrated = false
  private lastFaceTimestamp: number | undefined
  private lastTimestamp: number | undefined
  private lostSignals: FaceTrackingSignals | undefined
  private neutralBlendshapes = new Map<MediaPipeBlendshape, number>()
  private neutralPose = { x: 0, y: 0, z: 0 }
  private smoothed = emptySignals()
  private rawPose: { x: number, y: number, z: number } | undefined

  constructor(options: FaceTrackingStateOptions = {}) {
    this.onFaceLost = options.onFaceLost ?? 'hold'
  }

  calibrate() {
    this.baselineBlendshapeSums.clear()
    this.baselinePoseSum = { x: 0, y: 0, z: 0 }
    this.calibrationStartedAt = undefined
    this.calibrationFrames = 0
    this.calibrated = false
    this.lastFaceTimestamp = undefined
    this.lastTimestamp = undefined
    this.lostSignals = undefined
    this.neutralBlendshapes.clear()
    this.neutralPose = { x: 0, y: 0, z: 0 }
    this.rawPose = undefined
    this.smoothed = emptySignals()
  }

  update(input: FaceTrackingInput | undefined, timestampMs: number): FaceTrackingStateUpdate {
    const previousTimestamp = this.lastTimestamp
    const deltaMs = previousTimestamp === undefined
      ? 0
      : Math.max(0, Math.min(100, timestampMs - previousTimestamp))
    this.lastTimestamp = timestampMs

    if (!input)
      return this.updateLost(timestampMs, deltaMs)

    this.lastFaceTimestamp = timestampMs
    this.lostSignals = undefined
    const pose = this.rateLimitPose(input.pose ?? poseFromMatrix(input.matrix), deltaMs)
    if (!this.calibrated) {
      // Wall-clock, not summed frame deltas: the delta is clamped for smoothing,
      // which would stretch calibration at low inference rates.
      this.calibrationStartedAt ??= timestampMs
      this.calibrationFrames++
      this.baselinePoseSum.x += pose.x
      this.baselinePoseSum.y += pose.y
      this.baselinePoseSum.z += pose.z
      for (const name of MEDIAPIPE_BLENDSHAPES) {
        const score = clamp(input.blendshapes.get(name) ?? 0)
        this.baselineBlendshapeSums.set(
          name,
          (this.baselineBlendshapeSums.get(name) ?? 0) + score,
        )
      }
      if (timestampMs - this.calibrationStartedAt < CALIBRATION_MS) {
        return { calibrated: false, signals: undefined, status: 'calibrating' }
      }
      this.finishCalibration()
    }

    const targetBlendshapes = new Map<MediaPipeBlendshape, number>()
    for (const name of MEDIAPIPE_BLENDSHAPES) {
      const score = clamp(input.blendshapes.get(name) ?? 0)
      const baseline = this.neutralBlendshapes.get(name) ?? 0
      const reachable = BLINK_BLENDSHAPES.has(name) ? FULL_BLINK_SCORE : 1
      // A near-saturated neutral (`_neutral` sits around 0.98) would otherwise
      // turn frame jitter into full-range swings.
      targetBlendshapes.set(
        name,
        clamp((score - baseline) / Math.max(0.2, reachable - baseline)),
      )
    }
    const targetPose = {
      x: pose.x - this.neutralPose.x,
      y: pose.y - this.neutralPose.y,
      z: pose.z - this.neutralPose.z,
    }
    this.smoothToward(targetBlendshapes, targetPose, deltaMs)
    return { calibrated: true, signals: this.smoothed, status: 'tracked' }
  }

  private rateLimitPose(pose: FaceTrackingSignals['pose'], deltaMs: number) {
    const previous = this.rawPose
    // The first frame after a reset has nothing to compare against, and the
    // calibration window needs the estimate raw so the baseline is honest.
    if (!previous || !this.calibrated || deltaMs <= 0) {
      this.rawPose = pose
      return pose
    }
    const limit = MAX_POSE_DEGREES_PER_SECOND * deltaMs / 1_000
    const step = (current: number, target: number) =>
      current + clamp(target - current, -limit, limit)
    const limited = {
      x: step(previous.x, pose.x),
      y: step(previous.y, pose.y),
      z: step(previous.z, pose.z),
    }
    this.rawPose = limited
    return limited
  }

  private finishCalibration() {
    const frames = Math.max(1, this.calibrationFrames)
    for (const name of MEDIAPIPE_BLENDSHAPES)
      this.neutralBlendshapes.set(name, (this.baselineBlendshapeSums.get(name) ?? 0) / frames)
    this.neutralPose = {
      x: this.baselinePoseSum.x / frames,
      y: this.baselinePoseSum.y / frames,
      z: this.baselinePoseSum.z / frames,
    }
    this.calibrated = true
  }

  private smoothToward(
    blendshapes: ReadonlyMap<MediaPipeBlendshape, number>,
    pose: FaceTrackingSignals['pose'],
    deltaMs: number,
  ) {
    const nextBlendshapes = new Map<MediaPipeBlendshape, number>()
    for (const name of MEDIAPIPE_BLENDSHAPES) {
      const current = this.smoothed.blendshapes.get(name) ?? 0
      const target = blendshapes.get(name) ?? 0
      const closing = target > current && BLINK_BLENDSHAPES.has(name)
      nextBlendshapes.set(name, exponentialStep(
        current,
        target,
        deltaMs,
        closing ? BLINK_CLOSE_SMOOTHING_MS : FACE_SMOOTHING_MS,
      ))
    }
    this.smoothed = {
      blendshapes: nextBlendshapes,
      pose: {
        x: exponentialStep(this.smoothed.pose.x, pose.x, deltaMs, POSE_SMOOTHING_MS),
        y: exponentialStep(this.smoothed.pose.y, pose.y, deltaMs, POSE_SMOOTHING_MS),
        z: exponentialStep(this.smoothed.pose.z, pose.z, deltaMs, POSE_SMOOTHING_MS),
      },
    }
  }

  private updateLost(timestampMs: number, _deltaMs: number): FaceTrackingStateUpdate {
    if (!this.calibrated)
      return { calibrated: false, signals: undefined, status: 'lost' }
    const elapsed = timestampMs - (this.lastFaceTimestamp ?? timestampMs)
    this.lostSignals ??= {
      blendshapes: new Map(this.smoothed.blendshapes),
      pose: { ...this.smoothed.pose },
    }
    if (this.onFaceLost === 'neutral' && elapsed > LOST_HOLD_MS) {
      const releaseProgress = clamp((elapsed - LOST_HOLD_MS) / LOST_RELEASE_MS)
      const blendshapes = new Map<MediaPipeBlendshape, number>()
      for (const name of MEDIAPIPE_BLENDSHAPES)
        blendshapes.set(name, (this.lostSignals.blendshapes.get(name) ?? 0) * (1 - releaseProgress))
      this.smoothed = {
        blendshapes,
        pose: {
          x: this.lostSignals.pose.x * (1 - releaseProgress),
          y: this.lostSignals.pose.y * (1 - releaseProgress),
          z: this.lostSignals.pose.z * (1 - releaseProgress),
        },
      }
    }
    return { calibrated: true, signals: this.smoothed, status: 'lost' }
  }
}
