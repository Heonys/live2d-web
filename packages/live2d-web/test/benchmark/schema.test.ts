import { describe, expect, it } from 'vitest'
import { renderBenchmarkReport } from '../../../../benchmarks/lib/report'
import {
  assertBenchmarkResult,
  createMeasurement,
  summarizeRepetitions,
} from '../../../../benchmarks/lib/schema'
import { parseBenchmarkManifest } from './manifest'

describe('benchmark artifacts', () => {
  it('validates the generated model manifest contract', () => {
    const manifest = parseBenchmarkManifest({
      models: [{
        expected: {
          expressionCount: 0,
          expressions: [],
          hasPhysics: true,
          hasPose: false,
          motionGroups: { Idle: 1 },
          textureCount: 1,
        },
        id: 'mark',
        model3: '/mark.model3.json',
        motion: { group: 'Idle', index: 0 },
        name: 'Mark',
        role: 'lightweight',
        source: 'test',
      }],
      source: { commit: 'abc', ref: '5-r.5', repository: 'repo' },
      version: 1,
    })
    expect(manifest.models[0].id).toBe('mark')
    expect(() => parseBenchmarkManifest({ models: [], version: 2 })).toThrow()
  })

  it('creates finite frame summaries and preserves unsupported GPU timers', () => {
    const measurement = createMeasurement(
      { model: 'mark', resolution: 1, stageCount: 1 },
      1,
      100,
      {
        resources: {
          canvas: 1,
          context: 1,
          frameworkReference: 1,
          pendingExpression: 0,
          pendingMotion: 0,
          texture: 1,
        },
        stages: [{
          firstDrawMs: 90,
          frame: {
            coreUpdate: [1],
            drawCpu: [2],
            effectsPhysicsPose: [0.5],
            externalDrivers: [0],
            frameDelta: [16, 40],
            manualParameters: [0],
            motion: [0.2],
            stageFrame: [4],
          },
          gpuDrawMs: [null],
          gpuTimerSupported: false,
          id: 'stage-1',
          load: {
            mocFetch: [10],
            mocParse: [2],
            modelJsonFetch: [3],
            modelJsonParse: [1],
            optionalAssets: [2],
            ready: [90],
            shaderSetup: [4],
            textureDecode: [5],
            textureFetch: [6],
            textureUpload: [7],
          },
        }],
      },
    )
    expect(measurement.frame.frameDelta.count).toBe(2)
    expect(measurement.longFrameRatio).toBe(0.5)
    expect(measurement.gpuDraw).toBeNull()
  })

  it('validates JSON and renders a Markdown report', () => {
    const result = {
      capturedAt: '2026-08-14T00:00:00.000Z',
      environment: {
        browser: 'Chromium',
        cpu: 'Test CPU',
        memoryBytes: 8 * 1024 ** 3,
        os: 'Test OS',
        webglRenderer: 'Test GPU',
      },
      gitCommit: 'abc123',
      metadata: { core: '5.3', framework: '5-r.5', sampleRef: '5-r.5' },
      runs: [],
      schemaVersion: 1 as const,
      suite: 'smoke' as const,
    }
    expect(() => assertBenchmarkResult(result)).not.toThrow()
    expect(renderBenchmarkReport(result)).toContain('# Live2D smoke benchmark')
    expect(() => assertBenchmarkResult({ schemaVersion: 2 })).toThrow()
  })

  it('uses the median repetition for promoted results', () => {
    const base = createMeasurement(
      { model: 'mark', resolution: 1, stageCount: 1 },
      1,
      100,
      { resources: {
        canvas: 0,
        context: 0,
        frameworkReference: 0,
        pendingExpression: 0,
        pendingMotion: 0,
        texture: 0,
      }, stages: [] },
    )
    const summary = summarizeRepetitions([
      { ...base, readyMs: 300 },
      { ...base, readyMs: 100, repetition: 2 },
      { ...base, readyMs: 200, repetition: 3 },
    ])
    expect(summary).toHaveLength(1)
    expect(summary[0].readyMs).toBe(200)
    expect(summary[0].repetition).toBe(3)
  })
})
