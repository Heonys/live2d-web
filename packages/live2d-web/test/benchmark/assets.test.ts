import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error Node build helper intentionally has no public declaration.
import { validateModelAssets } from '../../../../scripts/lib/cubism-benchmark-assets.mjs'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { force: true, recursive: true })
})

function fixture(missingTexture = false) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'live2d-web-assets-'))
  temporaryDirectories.push(directory)
  mkdirSync(path.join(directory, 'motions'))
  writeFileSync(path.join(directory, 'model.moc3'), 'moc')
  if (!missingTexture)
    writeFileSync(path.join(directory, 'texture.png'), 'texture')
  writeFileSync(path.join(directory, 'motions/idle.motion3.json'), '{}')
  const model3 = path.join(directory, 'model.model3.json')
  writeFileSync(model3, JSON.stringify({
    FileReferences: {
      Moc: 'model.moc3',
      Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
      Textures: ['texture.png'],
    },
  }))
  return model3
}

describe('official benchmark asset validation', () => {
  it('accepts a complete model and describes its capabilities', () => {
    expect(validateModelAssets(fixture())).toMatchObject({
      expressionCount: 0,
      motionGroups: { Idle: 1 },
      textureCount: 1,
    })
  })

  it('rejects a missing referenced asset', () => {
    expect(() => validateModelAssets(fixture(true))).toThrow('texture.png')
  })
})
