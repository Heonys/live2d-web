import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ARCHIVE_LIMITS,
  inspectZipDirectory,
  readModelArchive,
  streamEntryBlob,
} from './archive'

afterEach(() => {
  vi.unstubAllGlobals()
})

function directory(
  entries: readonly { name: string, uncompressedBytes?: number }[],
) {
  const encoder = new TextEncoder()
  const names = entries.map(entry => encoder.encode(entry.name))
  const directoryBytes = names.reduce((total, name) => total + 46 + name.length, 0)
  const buffer = new ArrayBuffer(directoryBytes + 22)
  const view = new DataView(buffer)
  let offset = 0
  entries.forEach((entry, index) => {
    const name = names[index]
    view.setUint32(offset, 0x02014B50, true)
    view.setUint16(offset + 8, 0x0800, true)
    view.setUint32(offset + 24, entry.uncompressedBytes ?? 0, true)
    view.setUint16(offset + 28, name.length, true)
    new Uint8Array(buffer, offset + 46, name.length).set(name)
    offset += 46 + name.length
  })
  view.setUint32(offset, 0x06054B50, true)
  view.setUint16(offset + 8, entries.length, true)
  view.setUint16(offset + 10, entries.length, true)
  view.setUint32(offset + 12, directoryBytes, true)
  view.setUint32(offset + 16, 0, true)
  return buffer
}

async function zipFile(
  entries: Readonly<Record<string, string>>,
  name = 'model.zip',
) {
  const zip = new JSZip()
  for (const [path, value] of Object.entries(entries))
    zip.file(path, value)
  const bytes = await zip.generateAsync({ type: 'arraybuffer' })
  return new File([bytes], name, { type: 'application/zip' })
}

describe('model zip reader', () => {
  it('reads multiple models and ignores macOS metadata', async () => {
    const file = await zipFile({
      '__MACOSX/avatar/._model.model3.json': 'noise',
      'avatar/model.model3.json': '{"Version":3}',
      'avatar/model.moc3': 'moc',
      'second.model3.json': '{"Version":3}',
    })

    const archive = await readModelArchive(file)

    expect(archive.candidates).toEqual([
      'avatar/model.model3.json',
      'second.model3.json',
    ])
    expect(archive.files.has('__MACOSX/avatar/._model.model3.json')).toBe(false)
    expect(archive.expandedBytes).toBeGreaterThan(0)
  })

  it('rejects damaged archives and observes cancellation', async () => {
    await expect(readModelArchive(new File(['not a zip'], 'broken.zip')))
      .rejects
      .toThrow('readable directory')

    const controller = new AbortController()
    controller.abort()
    await expect(readModelArchive(
      await zipFile({ 'model.model3.json': '{}' }),
      controller.signal,
    )).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects traversal, normalized duplicates, entry floods and zip bombs', () => {
    expect(() => inspectZipDirectory(directory([{ name: '../escape.model3.json' }])))
      .toThrow('escapes its root')
    expect(() => inspectZipDirectory(directory([
      { name: 'safe/../model.model3.json' },
      { name: 'model.model3.json' },
    ]))).toThrow('same path twice')
    expect(() => inspectZipDirectory(directory(Array.from(
      { length: ARCHIVE_LIMITS.entries + 1 },
      (_, index) => ({ name: `${index}.txt` }),
    )))).toThrow('entries')
    expect(() => inspectZipDirectory(directory([{
      name: 'huge.bin',
      uncompressedBytes: ARCHIVE_LIMITS.expandedBytes + 1,
    }]))).toThrow('expanded archive limit')
  })

  // The declared sizes are attacker-controlled: an entry can claim a few
  // bytes and inflate to far more, and the pre-scan total cannot see that.
  // JSZip's own length probe catches the per-entry lie mid-stream and the
  // extraction budget bounds the running total; either way the archive must
  // reject during extraction, not after filling memory.
  it('stops an entry that inflates past what its directory declared', async () => {
    const file = await zipFile({
      'avatar/model.model3.json': JSON.stringify({ FileReferences: {}, Version: 3 }),
      'avatar/padding.bin': 'a'.repeat(8_192),
    })
    const input = await file.arrayBuffer()
    const view = new DataView(input)
    // Understate every declared uncompressed size so the pre-scan total stays
    // tiny while the real content still inflates to 8 KiB.
    for (let offset = 0; offset <= view.byteLength - 4; offset++) {
      if (view.getUint32(offset, true) === 0x02014B50)
        view.setUint32(offset + 24, 8, true)
    }
    const patched = new File([input], 'liar.zip', { type: 'application/zip' })

    await expect(readModelArchive(patched, undefined, {
      ...ARCHIVE_LIMITS,
      expandedBytes: 1_024,
    })).rejects.toThrow(/expands past the archive limit|size mismatch/)
  })

  it('stops its own stream as soon as actual bytes exceed the remaining budget', async () => {
    const handlers: {
      data?: (chunk: Uint8Array) => void
      end?: () => void
      error?: (error: unknown) => void
    } = {}
    const pause = vi.fn()
    const OriginalBlob = Blob
    const createBlob = vi.fn((parts: BlobPart[]) => new OriginalBlob(parts))
    vi.stubGlobal('Blob', createBlob)
    const stream = {
      on: vi.fn((event: 'data' | 'end' | 'error', handler: never) => {
        Object.assign(handlers, { [event]: handler })
        return stream
      }),
      pause,
      resume: vi.fn(() => {
        handlers.data?.(new Uint8Array(8))
        handlers.data?.(new Uint8Array(8))
        // A hostile stream can still emit after pause; settled guards must
        // ignore every later chunk and terminal callback.
        handlers.data?.(new Uint8Array(64))
        handlers.error?.(new Error('late stream error'))
        handlers.end?.()
      }),
    }
    const entry = {
      internalStream: () => stream,
      name: 'avatar/padding.bin',
    } as unknown as JSZip.JSZipObject

    await expect(streamEntryBlob(entry, 12))
      .rejects
      .toThrow('avatar/padding.bin expands past the archive limit')
    expect(pause).toHaveBeenCalledTimes(1)
    expect(createBlob).not.toHaveBeenCalled()
  })
})
