export interface BenchmarkModel {
  expected: {
    expressionCount: number
    expressions: string[]
    hasPhysics: boolean
    hasPose: boolean
    motionGroups: Record<string, number>
    textureCount: number
  }
  id: string
  model3: string
  motion: { group: string, index: number }
  name: string
  role: string
  source: string
}

export interface BenchmarkModelManifest {
  models: BenchmarkModel[]
  source: {
    commit: string
    ref: string
    repository: string
  }
  version: 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseBenchmarkManifest(value: unknown): BenchmarkModelManifest {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.models))
    throw new Error('Invalid benchmark-models.json schema.')
  for (const model of value.models) {
    if (
      !isRecord(model)
      || typeof model.id !== 'string'
      || typeof model.name !== 'string'
      || typeof model.role !== 'string'
      || typeof model.source !== 'string'
      || typeof model.model3 !== 'string'
      || !isRecord(model.motion)
      || typeof model.motion.group !== 'string'
      || !Number.isInteger(model.motion.index)
      || !isRecord(model.expected)
      || typeof model.expected.expressionCount !== 'number'
      || typeof model.expected.hasPhysics !== 'boolean'
      || typeof model.expected.hasPose !== 'boolean'
      || typeof model.expected.textureCount !== 'number'
      || !isRecord(model.expected.motionGroups)
      || !Array.isArray(model.expected.expressions)
      || model.expected.expressions.some(expression => typeof expression !== 'string')
    ) {
      throw new Error('Invalid benchmark model entry.')
    }
  }
  return value as unknown as BenchmarkModelManifest
}
