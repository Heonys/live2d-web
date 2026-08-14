import { describe, expect, it } from 'vitest'
import {
  parseInspectorModelMetadata,
  resolveInspectorModelUrl,
} from './modelMetadata'

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

  it('lists motion indices and expression names in declaration order', () => {
    expect(parseInspectorModelMetadata({
      FileReferences: {
        Expressions: [
          { File: 'smile.exp3.json', Name: 'Smile' },
          { File: 'invalid.exp3.json' },
        ],
        Motions: {
          Idle: [{ File: 'idle.motion3.json' }],
          Tap: [
            { File: 'tap-0.motion3.json' },
            { File: 'tap-1.motion3.json' },
          ],
        },
      },
    })).toEqual({
      expressions: ['Smile'],
      motions: [
        { group: 'Idle', index: 0 },
        { group: 'Tap', index: 0 },
        { group: 'Tap', index: 1 },
      ],
    })
  })

  it('rejects documents that are not model3 manifests', () => {
    expect(() => parseInspectorModelMetadata({ Version: 3 }))
      .toThrow('FileReferences')
  })
})
