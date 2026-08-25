import { describe, expect, it, vi } from 'vitest'
import { createMediaPipeFaceTracker } from './index'

// The optional peer is the one dependency a consumer is most likely to have
// skipped. index.test.ts mocks it into existence, so this file is the only
// place the missing-package path runs.
vi.mock('@mediapipe/tasks-vision', () => {
  throw new Error('Cannot find module @mediapipe/tasks-vision')
})

describe('createMediaPipeFaceTracker without the optional peer', () => {
  it('reports a tracking-error that names the missing dependency', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {})

    await expect(createMediaPipeFaceTracker({
      modelAssetPath: '/face.task',
      wasmPath: '/wasm',
    })).rejects.toMatchObject({
      code: 'tracking-error',
      message: expect.stringContaining('@mediapipe/tasks-vision'),
    })
  })
})
