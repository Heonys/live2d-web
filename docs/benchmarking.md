# 다중 모델 벤치마크

공개 API나 배포 파일에 진단 기능을 노출하지 않고, 공식 모델 5종으로
`cubism-webgl`의 로드·프레임·수명 비용을 측정한다. Core와 공식 셰이더의
동작은 바꾸지 않는다.

## 로컬 자산

공식 이용조건을 먼저 확인한 뒤 다음 명령을 실행한다.

```bash
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
```

명령은 Hiyori와 Cubism Core 외에 `CubismWebSamples`의 고정 태그 `5-r.5`를
sparse checkout으로 받고 Mark, Mao, Rice, Ren만 ignored Playground 경로에
복사한다. 생성된 `benchmark-models.json`은 모든 model3 참조 파일과 고정
`Idle[0]` motion을 검증한다. 모델, ZIP, Git cache와 manifest는 Git 및 npm
tarball에 들어가지 않는다.

- Mark: 경량 기준
- Hiyori: 기존 표준·Pixi A/B 기준
- Mao: expression과 pose
- Rice: 다중 texture와 masking
- Ren: Cubism 5.3 기준

공식 모델 조건은 [Live2D sample model terms](https://www.live2d.com/en/learn/sample/model-terms/)에서 확인한다.

## 명령

모든 성능 명령은 production Playground와 600×600 CSS Stage, 60 FPS 상한을
사용한다.

```bash
# Mark/Hiyori, 1 Stage, resolution 1, 각 10초
pnpm benchmark:smoke

# 5종 cold/warm startup 각 3회
pnpm benchmark:startup

# 18조건 × 3회, 5초 warm-up + 60초 측정 — 약 60분
pnpm benchmark:matrix

# Hiyori/Ren 순차 20회와 4 Stage 동시 5회 생성·정리
pnpm benchmark:memory

# 5종 × resolution 1·2, Chromium·WebKit 호환성
pnpm benchmark:models

# Hiyori WebGL/Pixi 5분 비교
LIVE2D_BENCHMARK_MS=300000 pnpm benchmark:backends
```

개발 중 실행 시간을 줄일 때만 `LIVE2D_BENCHMARK_MS`,
`LIVE2D_BENCHMARK_WARMUP_MS`, `LIVE2D_BENCHMARK_REPETITIONS`를 덮어쓴다.
확정 보고서에는 기본 조건으로 실행한 결과만 사용한다.

## 측정값과 결과 승격

raw JSON은 ignored `benchmark-results/`에 저장된다. 결과에는 Git commit,
OS·CPU·메모리·브라우저·WebGL renderer, Core/Framework/sample 버전, 조건,
반복 번호와 다음 값이 포함된다.

- load: model3, moc, optional assets, shader, texture, ready와 first draw
- frame: motion, effect/physics/pose, manual parameter, external driver,
  Core `model.update()`, draw CPU와 전체 frame delta
- GPU draw: `EXT_disjoint_timer_query_webgl2` 지원 시에만 값, 아니면 `null`
- lifecycle: Canvas, context, texture, pending asset과 Framework reference count
- memory: GC 뒤 JS heap. GPU 메모리로 해석하지 않는다.

확정 결과만 명시적 출력 경로로 승격한다. 기존 보고서는 덮어쓰지 않는다.

```bash
pnpm benchmark:report \
  --input benchmark-results/model-matrix.latest.json \
  --output docs/benchmarks/YYYY-MM-DD-model-matrix.md
```

보고서 표는 같은 조건 반복값의 중앙값이다. GPU timer가 없거나 disjoint인
샘플은 `n/a`로 남긴다.

## 최적화 판정

3회 중앙값에서 가장 큰 프로젝트 소유 구간만 후보로 삼는다. 같은 조건에서
목표 지표가 5% 이상 좋아지고 다른 주요 p95가 5% 이상 나빠지지 않을 때만
코드를 유지한다. Core `model.update()`나 공식 renderer/GPU 비용이 지배하면
Core나 셰이더를 수정하지 않고 측정 결과 자체를 결론으로 기록한다.

브라우저 에뮬레이션 결과는 실제 모바일 GPU 성능으로 표현하지 않는다.
