import type { BenchmarkMeasurement, BenchmarkResult } from './schema'
import { assertBenchmarkResult, summarizeRepetitions } from './schema'

function format(value: number | null, suffix = '') {
  return value === null ? 'n/a' : `${value.toFixed(2)}${suffix}`
}

function runRow(run: BenchmarkMeasurement) {
  const frame = run.frame.frameDelta
  const draw = run.frame.drawCpu
  const fps = frame?.p50 ? 1_000 / frame.p50 : null
  return `| ${run.condition.model} | ${run.condition.cache ?? '-'} | ${run.condition.stageCount} | ${run.condition.resolution} | ${run.repetition} | ${format(run.readyMs, ' ms')} | ${format(fps, ' FPS')} | ${format(frame?.p95 ?? null, ' ms')} | ${format(draw?.p50 ?? null, ' ms')} | ${format(run.gpuDraw?.p50 ?? null, ' ms')} | ${format(run.longFrameRatio === null ? null : run.longFrameRatio * 100, '%')} | ${format(run.memory ? run.memory.heapUsedBytes / 1024 ** 2 : null, ' MiB')} |`
}

function phaseRow(run: BenchmarkMeasurement) {
  const frame = run.frame
  const phase = (name: string, percentile: 'p50' | 'p95') => (
    frame[name]?.[percentile] ?? null
  )
  return `| ${run.condition.model} | ${run.condition.stageCount} | ${run.condition.resolution} | ${format(phase('motion', 'p50'))} | ${format(phase('effectsPhysicsPose', 'p50'))} | ${format(phase('coreUpdate', 'p50'))} | ${format(phase('drawCpu', 'p50'))} | ${format(phase('stageFrame', 'p50'))} | ${format(phase('stageFrame', 'p95'))} |`
}

function startupRow(run: BenchmarkMeasurement) {
  const load = (phase: string) => run.load[phase]?.p50 ?? null
  return `| ${run.condition.model} | ${run.condition.cache ?? '-'} | ${run.repetition} | ${format(run.readyMs)} | ${format(run.firstDrawMs)} | ${format(load('modelJsonFetch'))} | ${format(load('mocFetch'))} | ${format(load('mocParse'))} | ${format(load('optionalAssets'))} | ${format(load('shaderSetup'))} | ${format(load('textureFetch'))} | ${format(load('textureDecode'))} | ${format(load('textureUpload'))} |`
}

function memoryRow(run: BenchmarkMeasurement) {
  const released = Object.values(run.lifecycle).every(count => count === 0)
  return `| ${run.condition.model} | ${run.condition.stageCount} | ${run.repetition} | ${format(run.readyMs, ' ms')} | ${format(run.memory ? run.memory.heapUsedBytes / 1024 ** 2 : null, ' MiB')} | ${released ? '0 (released)' : 'not released'} |`
}

function renderResults(result: BenchmarkResult, summaries: BenchmarkMeasurement[]) {
  if (result.suite === 'startup') {
    return `## 결과

단위는 ms이며 cold/warm 조건별 3회 중앙값이다.

| 모델 | 캐시 | 반복 수 | Ready | First draw | model3 fetch | moc fetch | moc parse | Optional | Shader | Texture fetch | Texture decode | Texture upload |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(startupRow).join('\n')}`
  }
  if (result.suite === 'memory') {
    return `## 결과

각 cycle에서 dispose와 강제 GC를 마친 뒤 측정한 값이다.

| 모델 | Stage | cycle 수 | Ready 중앙값 | GC 후 Heap 중앙값 | 종료 후 소유 리소스 |
| --- | ---: | ---: | ---: | ---: | --- |
${summaries.map(memoryRow).join('\n')}`
  }
  return `## 결과

| 모델 | 캐시 | Stage | 해상도 | 반복 수 | Ready | 중앙 FPS | Frame p95 | Draw CPU p50 | Draw GPU p50 | 33ms 초과 | Heap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(runRow).join('\n')}

## CPU 구간 분해

단위는 ms이며 같은 조건 반복의 중앙값이다.

| 모델 | Stage | 해상도 | Motion p50 | Effect/physics/pose p50 | Core update p50 | Draw CPU p50 | Stage CPU p50 | Stage CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(phaseRow).join('\n')}`
}

export function renderBenchmarkReport(input: unknown) {
  assertBenchmarkResult(input)
  const result: BenchmarkResult = input
  const summaries = summarizeRepetitions(result.runs)
  const renderedResults = renderResults(result, summaries)
  return `# Live2D ${result.suite} benchmark — ${result.capturedAt.slice(0, 10)}

## 측정 환경

- Git: \`${result.gitCommit}\`
- OS: ${result.environment.os}
- CPU: ${result.environment.cpu}
- 메모리: ${(result.environment.memoryBytes / 1024 ** 3).toFixed(1)} GiB
- 브라우저: ${result.environment.browser}
- WebGL renderer: ${result.environment.webglRenderer}
- Core: ${result.metadata.core}
- Framework: ${result.metadata.framework}
- 공식 샘플: ${result.metadata.sampleRef}

${renderedResults}

## 해석 제한

- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 \`n/a\`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
`
}
