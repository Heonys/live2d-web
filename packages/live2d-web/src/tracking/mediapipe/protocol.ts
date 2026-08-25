export interface SerializedFaceResult {
  blendshapes: Array<[string, number]>
  matrix: number[]
}

export interface WorkerTrackerOptions {
  delegate: 'CPU' | 'GPU'
  minFaceDetectionConfidence: number
  minFacePresenceConfidence: number
  minTrackingConfidence: number
  modelAssetBuffer?: Uint8Array
  modelAssetPath?: string
  wasmPath: string
}

export type MediaPipeWorkerRequest
  = | { id: number, type: 'init', options: WorkerTrackerOptions }
    | { id: number, type: 'detect', bitmap: ImageBitmap, timestampMs: number }
    | { id: number, type: 'dispose' }

export type MediaPipeWorkerResponse
  = | { id: number, type: 'ready' }
    | {
      id: number
      type: 'result'
      inferenceMs: number
      result?: SerializedFaceResult
    }
    | { id: number, type: 'disposed' }
    | {
      id: number
      type: 'error'
      error: { message: string, name?: string, stack?: string }
    }
