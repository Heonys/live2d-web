import { describe, expect, it } from 'vitest'
import { resolveInspectorModelUrl } from './modelMetadata'

describe('model inspector metadata', () => {
  it('resolves relative model3 URLs and rejects unsupported input', () => {
    expect(resolveInspectorModelUrl(
      '../models/Hiyori.model3.json?revision=1',
      'https://example.com/playground/inspect',
    )).toBe('https://example.com/models/Hiyori.model3.json?revision=1')

    expect(() => resolveInspectorModelUrl(
      'data:application/json,{}',
      'https://example.com/inspect',
    )).toThrow('Only relative, HTTP and HTTPS')
    expect(() => resolveInspectorModelUrl(
      '/models/not-a-model.json',
      'https://example.com/inspect',
    )).toThrow('.model3.json')
  })
})
