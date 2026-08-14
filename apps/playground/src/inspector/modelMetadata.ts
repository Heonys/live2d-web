export interface InspectorMotion {
  group: string
  index: number
}

export interface InspectorModelMetadata {
  expressions: string[]
  motions: InspectorMotion[]
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function resolveInspectorModelUrl(input: string, baseUrl: string) {
  const trimmed = input.trim()
  if (!trimmed)
    throw new Error('Enter a model3.json URL.')
  const url = new URL(trimmed, baseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Only relative, HTTP and HTTPS model URLs are supported.')
  if (!url.pathname.toLowerCase().endsWith('.model3.json'))
    throw new Error('The model URL must point to a .model3.json file.')
  return url.href
}

export function parseInspectorModelMetadata(value: unknown): InspectorModelMetadata {
  const root = record(value)
  const references = record(root?.FileReferences)
  if (!root || !references)
    throw new Error('Invalid model3.json: FileReferences is missing.')

  const motionsRecord = record(references.Motions)
  const motions = motionsRecord
    ? Object.entries(motionsRecord).flatMap(([group, entries]) => (
        Array.isArray(entries)
          ? entries.map((_, index) => ({ group, index }))
          : []
      ))
    : []
  const expressions = Array.isArray(references.Expressions)
    ? references.Expressions.flatMap((entry) => {
        const name = record(entry)?.Name
        return typeof name === 'string' && name.trim() ? [name] : []
      })
    : []

  return { expressions, motions }
}
