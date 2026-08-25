import type { Live2DAssetResolver } from '../core/contract'
import type { Live2DAssetType } from '../core/errors'
import type {
  InspectModelSourceOptions,
  ModelInspectionAsset,
  ModelInspectionFinding,
  ModelInspectionLimits,
  ModelInspectionReport,
} from './types'
import { Live2DError } from '../core/errors'

const DEFAULT_LIMITS = Object.freeze({
  maxAssetBytes: 64 * 1024 * 1024,
  maxReferences: 2_048,
  maxTotalBytes: 256 * 1024 * 1024,
})

interface ResolvedLimits {
  maxAssetBytes: number
  maxReferences: number
  maxTotalBytes: number
}

interface DeclaredAsset {
  assetType: Live2DAssetType
  path: string
}

interface ParsedModel3 {
  expressions: string[]
  hitAreas: string[]
  model3Version?: number
  motions: Record<string, number>
  references: DeclaredAsset[]
}

class AssetTooLargeError extends Error {
  constructor(readonly bytes?: number) {
    super('asset exceeds inspection limit')
  }
}

function invalidProps(message: string) {
  return new Live2DError('invalid-props', message)
}

function validateLimit(name: keyof ResolvedLimits, value: number) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value))
    throw invalidProps(`inspectModelSource limits.${name} must be a positive finite integer.`)
  return value
}

function resolveLimits(input?: ModelInspectionLimits): ResolvedLimits {
  return {
    maxAssetBytes: validateLimit(
      'maxAssetBytes',
      input?.maxAssetBytes ?? DEFAULT_LIMITS.maxAssetBytes,
    ),
    maxReferences: validateLimit(
      'maxReferences',
      input?.maxReferences ?? DEFAULT_LIMITS.maxReferences,
    ),
    maxTotalBytes: validateLimit(
      'maxTotalBytes',
      input?.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
    ),
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted)
    throw signal.reason
}

function isExternalReference(path: string) {
  return /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//')
}

function normalizeLocalPath(path: string) {
  if (path.includes('\0'))
    throw new Error('Asset paths cannot contain NUL characters.')
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

function resolveLocalReference(modelPath: string, declared: string) {
  if (declared.startsWith('/'))
    return normalizeLocalPath(declared)
  const slash = modelPath.lastIndexOf('/')
  const directory = slash < 0 ? '' : modelPath.slice(0, slash + 1)
  return normalizeLocalPath(`${directory}${declared}`)
}

async function responseBytes(response: Response, limit: number, signal?: AbortSignal) {
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > limit)
    throw new AssetTooLargeError(declaredSize)
  if (!response.body) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > limit)
      throw new AssetTooLargeError(buffer.byteLength)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      throwIfAborted(signal)
      const { done, value } = await reader.read()
      if (done)
        break
      size += value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new AssetTooLargeError(size)
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

async function resolverBytes(
  resolver: Live2DAssetResolver,
  path: string,
  limit: number,
  signal?: AbortSignal,
) {
  throwIfAborted(signal)
  const value = await resolver(path, signal)
  throwIfAborted(signal)
  if (value === undefined)
    return undefined
  if (value instanceof Blob) {
    if (value.size > limit)
      throw new AssetTooLargeError(value.size)
    return value.arrayBuffer()
  }
  if (value instanceof ArrayBuffer) {
    if (value.byteLength > limit)
      throw new AssetTooLargeError(value.byteLength)
    return value
  }
  throw new TypeError('resolveAsset must return a Blob, ArrayBuffer or undefined.')
}

function readName(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function parseModel3(
  buffer: ArrayBuffer,
  findings: ModelInspectionFinding[],
): ParsedModel3 | undefined {
  let root: Record<string, unknown>
  try {
    const parsed = JSON.parse(new TextDecoder().decode(buffer)) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new TypeError('model3.json must contain a JSON object.')
    root = parsed as Record<string, unknown>
  }
  catch (error) {
    findings.push({
      code: 'invalid-model3',
      message: error instanceof Error ? error.message : 'model3.json is not valid JSON.',
      severity: 'error',
    })
    return undefined
  }

  const references: DeclaredAsset[] = []
  const add = (
    value: unknown,
    assetType: Live2DAssetType,
    label: string,
    required = false,
  ) => {
    if (value === undefined) {
      if (required) {
        findings.push({
          assetType,
          code: 'missing-file-reference',
          message: `model3.json does not declare ${label}.`,
          severity: 'error',
        })
      }
      return
    }
    const path = readName(value)
    if (!path) {
      findings.push({
        assetType,
        code: 'empty-reference',
        message: `model3.json declares an empty ${label}.`,
        severity: 'error',
      })
      return
    }
    references.push({ assetType, path })
  }

  const model3Version = typeof root.Version === 'number' && Number.isFinite(root.Version)
    ? root.Version
    : undefined
  if (model3Version !== 3) {
    findings.push({
      code: 'unsupported-model3-version',
      message: model3Version === undefined
        ? 'model3.json does not declare Version: 3.'
        : `model3.json Version ${model3Version} is not supported; expected Version 3.`,
      severity: 'error',
    })
  }

  const fileReferences = root.FileReferences && typeof root.FileReferences === 'object'
    ? root.FileReferences as Record<string, unknown>
    : undefined
  if (!fileReferences) {
    findings.push({
      code: 'missing-file-reference',
      message: 'model3.json does not contain FileReferences.',
      severity: 'error',
    })
  }
  add(fileReferences?.Moc, 'moc3', 'FileReferences.Moc', true)
  add(fileReferences?.Physics, 'physics', 'FileReferences.Physics')
  add(fileReferences?.Pose, 'pose', 'FileReferences.Pose')
  add(fileReferences?.UserData, 'user-data', 'FileReferences.UserData')

  if (Array.isArray(fileReferences?.Textures)) {
    fileReferences.Textures.forEach((value, index) => add(
      value,
      'texture',
      `FileReferences.Textures[${index}]`,
    ))
  }

  const expressions: string[] = []
  if (Array.isArray(fileReferences?.Expressions)) {
    fileReferences.Expressions.forEach((value, index) => {
      const expression = value && typeof value === 'object'
        ? value as Record<string, unknown>
        : {}
      const name = readName(expression.Name)
      if (name)
        expressions.push(name)
      add(expression.File, 'expression', `FileReferences.Expressions[${index}].File`)
    })
  }

  const motions: Record<string, number> = {}
  if (fileReferences?.Motions && typeof fileReferences.Motions === 'object') {
    for (const [group, value] of Object.entries(
      fileReferences.Motions as Record<string, unknown>,
    )) {
      if (!Array.isArray(value))
        continue
      motions[group] = value.length
      value.forEach((motion, index) => add(
        motion && typeof motion === 'object'
          ? (motion as Record<string, unknown>).File
          : undefined,
        'motion',
        `FileReferences.Motions.${group}[${index}].File`,
      ))
    }
  }

  const hitAreas = Array.isArray(root.HitAreas)
    ? root.HitAreas.flatMap((value) => {
        const name = value && typeof value === 'object'
          ? readName((value as Record<string, unknown>).Name)
          : undefined
        return name ? [name] : []
      })
    : []

  return { expressions, hitAreas, model3Version, motions, references }
}

function reportStatus(findings: readonly ModelInspectionFinding[]) {
  if (findings.some(finding => finding.severity === 'error'))
    return 'incompatible' as const
  if (findings.length)
    return 'warning' as const
  return 'compatible' as const
}

export async function inspectModelSource(
  options: InspectModelSourceOptions,
): Promise<ModelInspectionReport> {
  if (!options || typeof options !== 'object')
    throw invalidProps('inspectModelSource options must be an object.')
  if (typeof options.src !== 'string' || !options.src.trim())
    throw invalidProps('inspectModelSource src must be a non-empty string.')
  if (options.resolveAsset !== undefined && typeof options.resolveAsset !== 'function')
    throw invalidProps('inspectModelSource resolveAsset must be a function.')

  const limits = resolveLimits(options.limits)
  const local = options.resolveAsset !== undefined
  let source: string
  try {
    source = local
      ? normalizeLocalPath(options.src)
      : new URL(
        options.src,
        typeof document === 'undefined' ? undefined : document.baseURI,
      ).href
  }
  catch {
    throw invalidProps('inspectModelSource src must be a valid HTTP(S) URL.')
  }
  if (!source)
    throw invalidProps('inspectModelSource src must resolve to a model3.json path.')
  if (!local && !/^https?:/i.test(source))
    throw invalidProps('URL model inspection supports only HTTP and HTTPS sources.')

  const assets: ModelInspectionAsset[] = []
  const findings: ModelInspectionFinding[] = []
  let totalBytes = 0

  const read = async (
    path: string,
    assetType: Live2DAssetType,
    external: boolean,
  ) => {
    try {
      const bytes = local
        ? await resolverBytes(options.resolveAsset!, path, limits.maxAssetBytes, options.signal)
        : await (async () => {
            const response = await fetch(path, { signal: options.signal })
            if (!response.ok) {
              if (response.status === 404)
                return undefined
              throw new Error(`HTTP ${response.status}`)
            }
            return responseBytes(response, limits.maxAssetBytes, options.signal)
          })()
      if (!bytes) {
        assets.push({ assetType, external, path, status: 'missing' })
        findings.push({
          assetType,
          code: 'missing-asset',
          message: `The model references a file that was not found: ${path}`,
          path,
          severity: 'error',
        })
        return undefined
      }
      totalBytes += bytes.byteLength
      if (totalBytes > limits.maxTotalBytes) {
        assets.push({
          assetType,
          bytes: bytes.byteLength,
          external,
          path,
          status: 'too-large',
        })
        findings.push({
          assetType,
          code: 'total-assets-too-large',
          message: `Model assets exceed the ${limits.maxTotalBytes} byte inspection limit.`,
          path,
          severity: 'error',
        })
        return undefined
      }
      assets.push({
        assetType,
        bytes: bytes.byteLength,
        external,
        path,
        status: 'available',
      })
      return bytes
    }
    catch (error) {
      if (options.signal?.aborted)
        throw options.signal.reason
      if (error instanceof AssetTooLargeError) {
        assets.push({
          assetType,
          bytes: error.bytes,
          external,
          path,
          status: 'too-large',
        })
        findings.push({
          assetType,
          code: 'asset-too-large',
          message: `${path} exceeds the ${limits.maxAssetBytes} byte per-asset limit.`,
          path,
          severity: 'error',
        })
      }
      else {
        assets.push({ assetType, external, path, status: 'unreadable' })
        findings.push({
          assetType,
          code: 'unreadable-asset',
          message: `Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`,
          path,
          severity: 'error',
        })
      }
      return undefined
    }
  }

  throwIfAborted(options.signal)
  const modelBytes = await read(source, 'model3', false)
  const parsed = modelBytes ? parseModel3(modelBytes, findings) : undefined
  if (parsed) {
    if (parsed.references.length > limits.maxReferences) {
      findings.push({
        code: 'too-many-references',
        message: `model3.json declares ${parsed.references.length} assets; the limit is ${limits.maxReferences}.`,
        severity: 'error',
      })
    }
    const seen = new Set<string>()
    for (const reference of parsed.references.slice(0, limits.maxReferences)) {
      if (totalBytes > limits.maxTotalBytes)
        break
      const externalReference = isExternalReference(reference.path)
      if (local && externalReference) {
        assets.push({
          assetType: reference.assetType,
          external: true,
          path: reference.path,
          status: 'external',
        })
        findings.push({
          assetType: reference.assetType,
          code: 'external-asset',
          message: `A local model references an external URL and it was not fetched: ${reference.path}`,
          path: reference.path,
          severity: 'error',
        })
        continue
      }

      let resolved: string
      try {
        resolved = local
          ? resolveLocalReference(source, reference.path)
          : new URL(reference.path, source).href
      }
      catch (error) {
        findings.push({
          assetType: reference.assetType,
          code: 'unreadable-asset',
          message: `Could not resolve ${reference.path}: ${error instanceof Error ? error.message : String(error)}`,
          path: reference.path,
          severity: 'error',
        })
        continue
      }
      if (seen.has(resolved))
        continue
      seen.add(resolved)
      const crossOrigin = !local && new URL(resolved).origin !== new URL(source).origin
      if (crossOrigin) {
        findings.push({
          assetType: reference.assetType,
          code: 'cross-origin-asset',
          message: `The model reads a cross-origin asset that must allow CORS: ${resolved}`,
          path: resolved,
          severity: 'warning',
        })
      }
      await read(resolved, reference.assetType, crossOrigin)
    }
  }

  return {
    assets: Object.freeze(assets),
    expressions: Object.freeze(parsed?.expressions ?? []),
    findings: Object.freeze(findings),
    hitAreas: Object.freeze(parsed?.hitAreas ?? []),
    model3Version: parsed?.model3Version,
    motions: Object.freeze(parsed?.motions ?? {}),
    source,
    status: reportStatus(findings),
  }
}
