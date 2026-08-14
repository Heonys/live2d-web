import type { Live2DErrorDetails } from '../../core/errors'

export function parseShaderErrorDetails(error: unknown): Live2DErrorDetails {
  const message = error instanceof Error ? error.message : String(error)
  const match = message.match(/Failed to load shader (.+?)(?:: HTTP (\d+)|: empty source)$/)
  return {
    assetType: 'shader',
    backend: 'cubism-webgl',
    httpStatus: match?.[2] ? Number(match[2]) : undefined,
    url: match?.[1],
  }
}
