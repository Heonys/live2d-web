import type JSZip from 'jszip'
import type { LocalModelArchive } from './archiveSource'
import {
  collectArchiveFiles,
  ModelArchiveError,
  normalizeArchivePath,
} from './archiveSource'
import { decodeZipFileName } from './zipName'

export const ARCHIVE_LIMITS = Object.freeze({
  compressedBytes: 256 * 1024 * 1024,
  entries: 2_048,
  expandedBytes: 768 * 1024 * 1024,
})

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014B50
const END_OF_DIRECTORY_SIGNATURE = 0x06054B50
const UTF8_FLAG = 0x0800

interface ZipDirectoryInfo {
  entries: number
  expandedBytes: number
}

function findEndOfDirectory(view: DataView) {
  const minimum = Math.max(0, view.byteLength - 65_557)
  for (let offset = view.byteLength - 22; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) !== END_OF_DIRECTORY_SIGNATURE)
      continue
    const commentBytes = view.getUint16(offset + 20, true)
    if (offset + 22 + commentBytes === view.byteLength)
      return offset
  }
  throw new ModelArchiveError('The zip archive has no readable directory.')
}

function assertSafeArchivePath(path: string) {
  if (path.startsWith('/') || /^[a-z]:[/\\]/i.test(path))
    throw new ModelArchiveError(`The archive contains an absolute path: ${path}`)
  let depth = 0
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..') {
      if (depth === 0)
        throw new ModelArchiveError(`The archive path escapes its root: ${path}`)
      depth--
    }
    else {
      depth++
    }
  }
}

export function inspectZipDirectory(
  input: ArrayBuffer,
  limits: typeof ARCHIVE_LIMITS = ARCHIVE_LIMITS,
): ZipDirectoryInfo {
  const view = new DataView(input)
  const end = findEndOfDirectory(view)
  const entries = view.getUint16(end + 10, true)
  const directoryOffset = view.getUint32(end + 16, true)
  if (entries === 0xFFFF || directoryOffset === 0xFFFFFFFF)
    throw new ModelArchiveError('ZIP64 archives are not supported.')
  if (entries > limits.entries) {
    throw new ModelArchiveError(
      `The archive contains more than ${limits.entries.toLocaleString()} entries.`,
    )
  }

  const names = new Set<string>()
  let expandedBytes = 0
  let offset = directoryOffset
  for (let index = 0; index < entries; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE)
      throw new ModelArchiveError('The zip archive directory is damaged.')
    const flags = view.getUint16(offset + 8, true)
    const uncompressedBytes = view.getUint32(offset + 24, true)
    const nameBytes = view.getUint16(offset + 28, true)
    const extraBytes = view.getUint16(offset + 30, true)
    const commentBytes = view.getUint16(offset + 32, true)
    const next = offset + 46 + nameBytes + extraBytes + commentBytes
    if (next > end)
      throw new ModelArchiveError('The zip archive directory is damaged.')
    const bytes = new Uint8Array(input, offset + 46, nameBytes)
    const name = flags & UTF8_FLAG
      ? new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      : decodeZipFileName(bytes)
    assertSafeArchivePath(name)
    const normalized = normalizeArchivePath(name)
    if (normalized && !name.endsWith('/')) {
      if (names.has(normalized))
        throw new ModelArchiveError(`The archive contains the same path twice: ${normalized}`)
      names.add(normalized)
    }
    expandedBytes += uncompressedBytes
    if (expandedBytes > limits.expandedBytes) {
      throw new ModelArchiveError(
        'The archive exceeds the expanded archive limit.',
      )
    }
    offset = next
  }
  return { entries, expandedBytes }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason
}

// The declared sizes in the central directory are attacker-controlled, so the
// pre-scan total is only a fast first gate: the streaming budget below is what
// actually stops a small archive from inflating past the limit.
// The runtime API jszip documents but its typings omit.
interface StreamingZipObject extends JSZip.JSZipObject {
  internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>
}

function entryBlob(
  entry: JSZip.JSZipObject,
  budget: number,
  signal?: AbortSignal,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let bytes = 0
    let settled = false
    const stream = (entry as StreamingZipObject).internalStream('uint8array')
    const fail = (error: unknown) => {
      if (settled)
        return
      settled = true
      stream.pause()
      reject(error)
    }
    stream.on('data', (chunk: Uint8Array) => {
      if (settled)
        return
      if (signal?.aborted) {
        fail(signal.reason)
        return
      }
      bytes += chunk.length
      if (bytes > budget) {
        fail(new ModelArchiveError(
          `${entry.name} expands past the archive limit.`,
        ))
        return
      }
      chunks.push(chunk)
    })
    stream.on('error', fail)
    stream.on('end', () => {
      if (!settled) {
        settled = true
        resolve(new Blob(chunks as BlobPart[]))
      }
    })
    stream.resume()
  })
}

export async function readModelArchive(
  file: File,
  signal?: AbortSignal,
  limits: typeof ARCHIVE_LIMITS = ARCHIVE_LIMITS,
): Promise<LocalModelArchive> {
  if (!(file instanceof File))
    throw new ModelArchiveError('Choose a zip file.')
  if (file.size > limits.compressedBytes) {
    throw new ModelArchiveError(
      `${file.name} exceeds the compressed archive limit.`,
    )
  }

  let input: ArrayBuffer
  try {
    input = await file.arrayBuffer()
    throwIfAborted(signal)
    inspectZipDirectory(input, limits)
  }
  catch (error) {
    if (signal?.aborted)
      throw signal.reason
    if (error instanceof ModelArchiveError)
      throw error
    throw new ModelArchiveError(
      `${file.name} is damaged or is not a readable zip archive.`,
      { cause: error },
    )
  }

  let zip: JSZip
  try {
    const { default: JSZipRuntime } = await import('jszip')
    throwIfAborted(signal)
    zip = await JSZipRuntime.loadAsync(input, { decodeFileName: decodeZipFileName })
  }
  catch (error) {
    if (signal?.aborted)
      throw signal.reason
    throw new ModelArchiveError(
      `${file.name} is damaged or is not a readable zip archive.`,
      { cause: error },
    )
  }

  const files = Object.values(zip.files).filter(entry => !entry.dir)

  const entries: [string, Blob][] = []
  let expandedBytes = 0
  for (const entry of files) {
    throwIfAborted(signal)
    // JSZip decodes names on its own path; they get the same rejection the
    // pre-scan applied to the central directory, so the two cannot disagree.
    assertSafeArchivePath(entry.name)
    const blob = await entryBlob(entry, limits.expandedBytes - expandedBytes, signal)
    expandedBytes += blob.size
    entries.push([entry.name, blob])
  }
  return collectArchiveFiles(entries, file.name)
}
