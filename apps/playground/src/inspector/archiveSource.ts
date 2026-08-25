import type { Live2DAssetResolver } from 'live2d-web'

export interface LocalModelArchive {
  candidates: readonly string[]
  expandedBytes: number
  files: ReadonlyMap<string, Blob>
  label: string
}

export class ModelArchiveError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ModelArchiveError'
  }
}

export function normalizeArchivePath(path: string) {
  if (path.includes('\0'))
    throw new ModelArchiveError('Archive paths cannot contain NUL characters.')
  const segments: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function isPlatformNoise(path: string) {
  return path
    .split('/')
    .some(segment => segment === '__MACOSX' || segment.startsWith('._'))
}

export function collectArchiveFiles(
  entries: Iterable<[string, Blob]>,
  label: string,
): LocalModelArchive {
  const files = new Map<string, Blob>()
  const candidates: string[] = []
  let expandedBytes = 0
  for (const [rawPath, blob] of entries) {
    const path = normalizeArchivePath(rawPath)
    if (!path || isPlatformNoise(path))
      continue
    if (files.has(path))
      throw new ModelArchiveError(`The archive contains the same path twice: ${path}`)
    files.set(path, blob)
    expandedBytes += blob.size
    if (path.toLowerCase().endsWith('.model3.json'))
      candidates.push(path)
  }
  if (!candidates.length) {
    throw new ModelArchiveError(
      files.size
        ? `${label} does not contain a model3.json file.`
        : `${label} is empty.`,
    )
  }
  candidates.sort()
  return {
    candidates: Object.freeze(candidates),
    expandedBytes,
    files,
    label,
  }
}

export function createArchiveResolver(source: LocalModelArchive): Live2DAssetResolver {
  return async (path, signal) => {
    if (signal?.aborted)
      throw signal.reason
    return source.files.get(normalizeArchivePath(path))
  }
}
