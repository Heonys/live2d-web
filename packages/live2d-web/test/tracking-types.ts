import type {
  CreateMediaPipeFaceTrackerOptions,
  MediaPipeAttachOptions,
  MediaPipeFaceChannel,
  MediaPipeFaceTracker,
  MediaPipeFaceTrackingUpdate,
  MediaPipeMappingMode,
  MediaPipeParameterTarget,
} from '../src/tracking/mediapipe'
import { createMediaPipeFaceTracker } from '../src/tracking/mediapipe'

export interface TrackingSurface {
  attachOptions: MediaPipeAttachOptions
  channel: MediaPipeFaceChannel
  createOptions: CreateMediaPipeFaceTrackerOptions
  mapping: MediaPipeMappingMode
  target: MediaPipeParameterTarget
  tracker: MediaPipeFaceTracker
  update: MediaPipeFaceTrackingUpdate
}

void createMediaPipeFaceTracker
