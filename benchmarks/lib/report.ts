import type { BenchmarkMeasurement, BenchmarkResult } from './schema'
import { assertHardwareRenderer } from './environment'
import { evaluateBackendMemory } from './memory'
import { normalizeBenchmarkResult, summarizeRepetitions } from './schema'

function format(value: number | null, suffix = '') {
  return value === null ? 'n/a' : `${value.toFixed(2)}${suffix}`
}

function runRow(run: BenchmarkMeasurement) {
  const frame = run.frame.frameDelta
  const draw = run.frame.drawCpu
  const fps = frame?.p50 ? 1_000 / frame.p50 : null
  return `| ${run.condition.model} | ${run.condition.backend ?? 'cubism-webgl'} | ${run.condition.cache ?? '-'} | ${run.condition.stageCount} | ${run.condition.resolution} | ${run.repetition} | ${format(run.readyMs, ' ms')} | ${format(fps, ' FPS')} | ${format(frame?.p95 ?? null, ' ms')} | ${format(draw?.p50 ?? null, ' ms')} | ${format(run.gpuDraw?.p50 ?? null, ' ms')} | ${format(run.longFrameRatio === null ? null : run.longFrameRatio * 100, '%')} |`
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
  return `| ${run.condition.model} | ${run.condition.stageCount} | ${run.repetition} | ${format(run.readyMs, ' ms')} | ${format(run.memory ? run.memory.released.heapUsedBytes / 1024 ** 2 : null, ' MiB')} | ${released ? '0 (released)' : 'not released'} |`
}

function bytes(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'n/a'
    : `${(value / 1024 ** 2).toFixed(2)} MiB`
}

function backendMemoryRow(run: BenchmarkMeasurement) {
  const memory = run.memory
  return `| ${run.condition.backend ?? '-'} | ${run.condition.core ?? '-'} | ${run.condition.stageCount} | ${memory?.cycles ?? 'n/a'} | ${run.repetition} | ${bytes(memory?.baseline?.heapUsedBytes)} | ${bytes(memory?.active?.heapUsedBytes)} | ${bytes(memory?.activeHeapDeltaBytes)} | ${bytes(memory?.released.heapUsedBytes)} | ${bytes(memory?.retainedHeapDeltaBytes)} | ${memory?.released.canvasCount ?? 'n/a'} | ${bytes(memory?.scripts?.common)} | ${bytes(memory?.scripts?.adapter)} | ${bytes(memory?.scripts?.core)} | ${bytes(memory?.scripts?.total)} |`
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
  if (result.suite === 'backend-memory') {
    const evaluation = evaluateBackendMemory(result.runs)
    const conclusion = evaluation.conclusion === 'lower'
      ? '두 Stage 조건 모두에서 cubism-webgl의 active JS heap delta가 pixi-v6보다 10% 이상 낮았다.'
      : '두 Stage 조건 모두에서 10% 이상 낮다는 기준을 충족하지 않아 메모리 차이는 불분명하다.'
    const cubismScripts = summaries.find(run => (
      run.condition.backend === 'cubism-webgl'
      && run.condition.stageCount === 1
    ))?.memory?.scripts
    const pixiScripts = summaries.find(run => (
      run.condition.backend === 'pixi-v6'
      && run.condition.stageCount === 1
    ))?.memory?.scripts
    const adapterReduction = cubismScripts && pixiScripts && pixiScripts.adapter > 0
      ? (1 - cubismScripts.adapter / pixiScripts.adapter) * 100
      : null
    const adapterDifference = adapterReduction === null
      ? null
      : adapterReduction >= 0
        ? `${format(adapterReduction, '%')} 적었다`
        : `${format(Math.abs(adapterReduction), '%')} 많았다`
    const scriptComparison = cubismScripts && pixiScripts && adapterReduction !== null
      ? `이 Playground 로드에서 추가 adapter JS encoded byte는 cubism-webgl ${bytes(cubismScripts.adapter)}, pixi-v6 ${bytes(pixiScripts.adapter)}로 cubism-webgl이 ${adapterDifference}. 이는 전송 자산 기록이며 JS heap이나 전체 패키지 크기가 아니다.`
      : '추가 adapter script byte를 비교할 수 없었다.'
    return `## 결과

각 backend는 새 Chromium context에서 측정했다. Heap은 강제 GC 뒤 값이며 GPU 메모리가 아니다.

| Backend | Core | Stage | 회차당 cycle | 반복 수 | Baseline heap | Active heap | Active delta | Released heap | Retained delta | 종료 Canvas | Common JS | Adapter JS | Core JS | Total JS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(backendMemoryRow).join('\n')}

## 판정

${conclusion}

${scriptComparison}`
  }
  return `## 결과

| 모델 | Backend | 캐시 | Stage | 해상도 | 반복 수 | Ready | 중앙 FPS | Frame p95 | Draw CPU p50 | Draw GPU p50 | 33ms 초과 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(runRow).join('\n')}

## CPU 구간 분해

단위는 ms이며 같은 조건 반복의 중앙값이다.

| 모델 | Stage | 해상도 | Motion p50 | Effect/physics/pose p50 | Core update p50 | Draw CPU p50 | Stage CPU p50 | Stage CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${summaries.map(phaseRow).join('\n')}`
}

export function renderBenchmarkReport(input: unknown) {
  const result: BenchmarkResult = normalizeBenchmarkResult(input)
  if (
    result.suite === 'hardware-backends'
    || result.suite === 'hardware-matrix'
    || result.suite === 'hardware-smoke'
  ) {
    assertHardwareRenderer(result.environment.webglRenderer)
  }
  const summaries = summarizeRepetitions(result.runs)
  const renderedResults = renderResults(result, summaries)
  const repetitionNote = result.suite === 'hardware-smoke'
    ? '이 smoke 결과는 조건별 1회 연결 검증이다. 확정 성능 비교에는 hardware matrix의 조건별 3회 중앙값을 사용한다.'
    : '각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.'
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

- ${repetitionNote}
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 \`n/a\`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
`
}
