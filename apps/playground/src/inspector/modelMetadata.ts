export interface InspectorMotion {
  group: string
  index: number
}

export interface InspectorModelMetadata {
  expressions: string[]
  motions: InspectorMotion[]
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

// Motion/expression discovery moved into the library: the inspector reads
// controller.getModelInfo() instead of re-fetching and parsing model3.json.
