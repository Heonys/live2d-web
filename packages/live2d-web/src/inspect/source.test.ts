import type { Live2DAssetResolver } from '../core/contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { inspectModelSource } from './source'

function buffer(value: string | number) {
  return typeof value === 'number'
    ? new ArrayBuffer(value)
    : new TextEncoder().encode(value).buffer as ArrayBuffer
}

function model3(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    FileReferences: {
      Expressions: [{ File: 'expressions/smile.exp3.json', Name: 'smile' }],
      Moc: 'model.moc3',
      Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
      Physics: 'model.physics3.json',
      Textures: ['textures/texture.png'],
    },
    HitAreas: [{ Id: 'HitAreaBody', Name: 'Body' }],
    Version: 3,
    ...overrides,
  })
}

function resolver(files: Record<string, string | number>): Live2DAssetResolver {
  return path => path in files ? buffer(files[path]) : undefined
}

describe('model source inspection', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reports all declared local assets and model metadata', async () => {
    const report = await inspectModelSource({
      resolveAsset: resolver({
        'avatar/expressions/smile.exp3.json': '{}',
        'avatar/model.moc3': 8,
        'avatar/model.model3.json': model3(),
        'avatar/model.physics3.json': '{}',
        'avatar/motions/idle.motion3.json': '{}',
        'avatar/textures/texture.png': 12,
      }),
      src: 'avatar/model.model3.json',
    })

    expect(report).toMatchObject({
      expressions: ['smile'],
      hitAreas: ['Body'],
      model3Version: 3,
      motions: { Idle: 1 },
      source: 'avatar/model.model3.json',
      status: 'compatible',
    })
    expect(report.assets).toHaveLength(6)
    expect(report.assets.every(asset => asset.status === 'available')).toBe(true)
  })

  it('returns malformed JSON and missing references as findings', async () => {
    const invalid = await inspectModelSource({
      resolveAsset: () => buffer('{oops'),
      src: 'broken.model3.json',
    })
    expect(invalid.status).toBe('incompatible')
    expect(invalid.findings.map(finding => finding.code)).toEqual(['invalid-model3'])

    const missing = await inspectModelSource({
      resolveAsset: resolver({ 'empty.model3.json': JSON.stringify({ Version: 2 }) }),
      src: 'empty.model3.json',
    })
    expect(missing.findings.map(finding => finding.code)).toEqual([
      'unsupported-model3-version',
      'missing-file-reference',
      'missing-file-reference',
    ])
  })

  it('aggregates empty, missing and external local references without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const report = await inspectModelSource({
      resolveAsset: resolver({
        'model.model3.json': model3({
          FileReferences: {
            Moc: 'gone.moc3',
            Physics: '',
            Textures: ['https://cdn.example.com/face.png'],
          },
        }),
      }),
      src: 'model.model3.json',
    })

    expect(report.findings.map(finding => finding.code)).toEqual([
      'empty-reference',
      'missing-asset',
      'external-asset',
    ])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('warns for cross-origin URL assets and records CORS failures', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === 'https://models.example/avatar.model3.json') {
        return {
          arrayBuffer: async () => buffer(model3({
            FileReferences: {
              Moc: 'https://cdn.example/avatar.moc3',
              Textures: [],
            },
          })),
          body: null,
          headers: new Headers(),
          ok: true,
          status: 200,
        } as Response
      }
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    const report = await inspectModelSource({
      src: 'https://models.example/avatar.model3.json',
    })
    expect(report.findings.map(finding => finding.code)).toEqual([
      'cross-origin-asset',
      'unreadable-asset',
    ])
    expect(report.assets[1]).toMatchObject({ external: true, status: 'unreadable' })
  })

  it('enforces per-asset, total and reference limits', async () => {
    const tooLarge = await inspectModelSource({
      limits: { maxAssetBytes: 128, maxReferences: 10, maxTotalBytes: 256 },
      resolveAsset: resolver({
        'large.moc3': 129,
        'model.model3.json': JSON.stringify({
          FileReferences: { Moc: 'large.moc3' },
          Version: 3,
        }),
      }),
      src: 'model.model3.json',
    })
    expect(tooLarge.findings.some(finding => finding.code === 'asset-too-large')).toBe(true)

    const many = await inspectModelSource({
      limits: { maxAssetBytes: 1_024, maxReferences: 1, maxTotalBytes: 1_024 },
      resolveAsset: resolver({
        'a.moc3': 10,
        'model.model3.json': JSON.stringify({
          FileReferences: { Moc: 'a.moc3', Textures: ['a.png'] },
          Version: 3,
        }),
      }),
      src: 'model.model3.json',
    })
    expect(many.findings.some(finding => finding.code === 'too-many-references')).toBe(true)

    const total = await inspectModelSource({
      limits: { maxAssetBytes: 512, maxReferences: 10, maxTotalBytes: 160 },
      resolveAsset: resolver({
        'a.moc3': 50,
        'a.png': 50,
        'model.model3.json': JSON.stringify({
          FileReferences: { Moc: 'a.moc3', Textures: ['a.png'] },
          Version: 3,
        }),
      }),
      src: 'model.model3.json',
    })
    expect(total.findings.some(finding => finding.code === 'total-assets-too-large')).toBe(true)
  })

  // A model3.json is untrusted input, and this entry runs in Node where no
  // CORS wall exists: a declared data:, file: or blob: reference must never
  // reach fetch().
  it('refuses non-HTTP(S) references in URL mode without fetching them', async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input === 'https://models.example/avatar.model3.json') {
        return {
          arrayBuffer: async () => buffer(model3({
            FileReferences: {
              Moc: 'data:application/octet-stream;base64,AAAA',
              Physics: 'file:///etc/passwd',
              Textures: ['textures/texture.png'],
            },
          })),
          body: null,
          headers: new Headers(),
          ok: true,
          status: 200,
        } as Response
      }
      return {
        arrayBuffer: async () => buffer(4),
        body: null,
        headers: new Headers(),
        ok: true,
        status: 200,
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const report = await inspectModelSource({
      src: 'https://models.example/avatar.model3.json',
    })

    const external = report.findings.filter(finding => finding.code === 'external-asset')
    expect(external).toHaveLength(2)
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([
      'https://models.example/avatar.model3.json',
      'https://models.example/textures/texture.png',
    ])
  })

  // A resolver returning the wrong type is a caller bug, not a model defect:
  // it must reject rather than surface as an unreadable-asset finding.
  it('rejects a resolver that returns the wrong type', async () => {
    await expect(inspectModelSource({
      resolveAsset: (() => 'not-bytes') as unknown as Live2DAssetResolver,
      src: 'model.model3.json',
    })).rejects.toMatchObject({
      code: 'invalid-props',
      message: expect.stringContaining('resolveAsset'),
    })

    await expect(inspectModelSource({
      resolveAsset: () => buffer(model3()),
      src: 'model\0.model3.json',
    })).rejects.toMatchObject({
      code: 'invalid-props',
      message: expect.stringContaining('NUL'),
    })
  })

  it('rejects invalid options and an aborted inspection', async () => {
    await expect(inspectModelSource({ src: '' })).rejects.toMatchObject({
      code: 'invalid-props',
    })
    await expect(inspectModelSource({
      limits: { maxReferences: 0 },
      src: 'https://example.com/model.model3.json',
    })).rejects.toMatchObject({ code: 'invalid-props' })

    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    await expect(inspectModelSource({
      resolveAsset: () => buffer(model3()),
      signal: controller.signal,
      src: 'model.model3.json',
    })).rejects.toThrow('cancelled')
  })
})
