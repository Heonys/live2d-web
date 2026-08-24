import type { MediaPipeBlendshape } from './blendshapes'
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
const LOST_HOLD_MS = 250
const LOST_RELEASE_MS = 300
const POSE_SMOOTHING_MS = 100
const FACE_SMOOTHING_MS = 60

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum))
}

function exponentialStep(current: number, target: number, deltaMs: number, timeMs: number) {
  if (deltaMs <= 0)
    return current
  const alpha = 1 - Math.exp(-deltaMs / timeMs)
  return current + (target - current) * alpha
}

/** Extracts Live2D-oriented Euler angles from a column-major 4x4 matrix. */
export function poseFromMatrix(matrix?: readonly number[]) {
  if (!matrix || matrix.length < 16 || matrix.some(value => !Number.isFinite(value)))
    return { x: 0, y: 0, z: 0 }
  const r00 = matrix[0]
  const r10 = matrix[1]
  const r20 = matrix[2]
  const r21 = matrix[6]
  const r22 = matrix[10]
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

export class FaceTrackingState {
  private baselineBlendshapeSums = new Map<MediaPipeBlendshape, number>()
  private baselinePoseSum = { x: 0, y: 0, z: 0 }
  private calibrationElapsedMs = 0
  private calibrationFrames = 0
  private calibrated = false
  private lastFaceTimestamp: number | undefined
  private lastTimestamp: number | undefined
  private lostSignals: FaceTrackingSignals | undefined
  private neutralBlendshapes = new Map<MediaPipeBlendshape, number>()
  private neutralPose = { x: 0, y: 0, z: 0 }
  private smoothed = emptySignals()

  calibrate() {
    this.baselineBlendshapeSums.clear()
    this.baselinePoseSum = { x: 0, y: 0, z: 0 }
    this.calibrationElapsedMs = 0
    this.calibrationFrames = 0
    this.calibrated = false
    this.lastFaceTimestamp = undefined
    this.lastTimestamp = undefined
    this.lostSignals = undefined
    this.neutralBlendshapes.clear()
    this.neutralPose = { x: 0, y: 0, z: 0 }
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
    const pose = input.pose ?? poseFromMatrix(input.matrix)
    if (!this.calibrated) {
      this.calibrationFrames++
      this.calibrationElapsedMs += deltaMs
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
      if (this.calibrationElapsedMs < CALIBRATION_MS) {
        return { calibrated: false, signals: undefined, status: 'calibrating' }
      }
      this.finishCalibration()
    }

    const targetBlendshapes = new Map<MediaPipeBlendshape, number>()
    for (const name of MEDIAPIPE_BLENDSHAPES) {
      const score = clamp(input.blendshapes.get(name) ?? 0)
      const baseline = this.neutralBlendshapes.get(name) ?? 0
      targetBlendshapes.set(name, clamp((score - baseline) / Math.max(0.01, 1 - baseline)))
    }
    const targetPose = {
      x: pose.x - this.neutralPose.x,
      y: pose.y - this.neutralPose.y,
      z: pose.z - this.neutralPose.z,
    }
    this.smoothToward(targetBlendshapes, targetPose, deltaMs)
    return { calibrated: true, signals: this.smoothed, status: 'tracked' }
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
      nextBlendshapes.set(name, exponentialStep(
        this.smoothed.blendshapes.get(name) ?? 0,
        blendshapes.get(name) ?? 0,
        deltaMs,
        FACE_SMOOTHING_MS,
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
    if (elapsed > LOST_HOLD_MS) {
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
