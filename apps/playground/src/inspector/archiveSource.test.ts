import { describe, expect, it } from 'vitest'
import {
  collectArchiveFiles,
  createArchiveResolver,
  normalizeArchivePath,
} from './archiveSource'

describe('inspector archive sources', () => {
  it('normalizes traversal and Windows separators inside the source', () => {
    expect(normalizeArchivePath('a/b/../../../model\\avatar.model3.json'))
      .toBe('model/avatar.model3.json')
  })

  it('ignores macOS noise, sorts candidates and resolves blobs', async () => {
    const source = collectArchiveFiles([
      ['z/model.model3.json', new Blob(['z'])],
      ['__MACOSX/z/._model.model3.json', new Blob(['noise'])],
      ['a/model.model3.json', new Blob(['a'])],
      ['a/model.moc3', new Blob(['moc'])],
    ], 'models.zip')

    expect(source.candidates).toEqual(['a/model.model3.json', 'z/model.model3.json'])
    expect(source.files.has('__MACOSX/z/._model.model3.json')).toBe(false)
    await expect(createArchiveResolver(source)('a/model.moc3')).resolves.toBeInstanceOf(Blob)
  })

  it('rejects duplicate normalized paths and archives without a model', () => {
    expect(() => collectArchiveFiles([
      ['a/../model.model3.json', new Blob()],
      ['model.model3.json', new Blob()],
    ], 'duplicate.zip')).toThrow('same path twice')
    expect(() => collectArchiveFiles([['readme.txt', new Blob()]], 'notes.zip'))
      .toThrow('does not contain a model3.json')
  })
})
