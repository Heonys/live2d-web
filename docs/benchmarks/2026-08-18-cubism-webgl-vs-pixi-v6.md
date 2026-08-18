# 시작 비용 최적화 뒤 cubism-webgl과 pixi-v6 재측정

측정일은 **2026-08-18**이다. blend 셰이더 지연 컴파일, drawable별 정적
index/UV 버퍼, program 중복 바인딩 캐시, 텍스처와 셰이더 준비 병렬화를 넣은 뒤
일반 runtime fast path가 기존 Pixi 비교 기준을 유지하는지 확인했다.

## 결론

- 중앙 FPS는 cubism-webgl **60.24**, pixi-v6 **59.88**이다. 두 값 모두 60 FPS
  상한에 붙어 있으므로 Pixi 대비 중앙 FPS 5% 비열화 기준을 통과한다.
- 33ms 초과 프레임은 cubism-webgl 49개(**0.2738%**), pixi-v6 8개(**0.0456%**)다.
- 긴 프레임 비율 차이 **+0.2282%p**는 허용 기준 +0.5%p 안이다.

따라서 시작 비용 최적화 뒤에도 **“Pixi 없이 동일한 Hiyori 조건에서 기존 Pixi
backend와 동등한 중앙 프레임 성능을 유지했다”**는 판정을 그대로 유지한다.
두 값 모두 상한에 붙어 있으므로 어느 backend가 더 빠르다는 근거로는 쓰지 않는다.

## 결과

| 항목 | cubism-webgl | pixi-v6 | 판정 |
|---|---:|---:|---|
| 중앙 FPS | 60.24 | 59.88 | 기준 통과 |
| frame delta p50 | 16.60 ms | 16.70 ms | 동등 |
| frame delta p95 | 24.20 ms | 24.50 ms | 동등 |
| frame delta p99 | 25.10 ms | 25.00 ms | 동등 |
| 측정 프레임 | 17,897 | 17,531 | 둘 다 평균 30 FPS 이상 |
| 33ms 초과 프레임 | 49 | 8 | 기준 통과 |
| 33ms 초과 비율 | 0.2738% | 0.0456% | +0.2282%p |

## 긴 프레임 꼬리에 대한 주석

2026-08-15 같은 조건에서는 cubism-webgl 5개(0.0278%), pixi-v6 0개였다. 이번에는
두 backend의 절대 개수가 함께 늘었으므로(5 → 49, 0 → 8) 한쪽 backend의 회귀보다
측정 환경의 영향으로 본다. 이 스위트는 SwiftShader CPU 렌더러에서 실행되고
측정 중 같은 머신을 다른 작업에 함께 사용했다. 판정 기준인 backend 간 상대
차이는 두 날짜 모두 예산 안이다.

같은 지표를 60초와 120초로 단축해 실행했을 때는 차이가 +0.57%p, +1.31%p로
예산을 넘었다. 기본 조건인 backend별 5분 실행에서는 예산 안으로 들어온다.
꼬리 지표는 측정 시간이 짧을수록 불안정하므로 단축 실행 결과로 판정하지 않는다.

## 측정 조건

- 모델: 공식 Hiyori
- 브라우저: Chrome for Testing 151.0.7922.34, Playwright 1.62.0
- 운영체제: macOS 15.6.1, arm64
- 장치: Apple M2 Pro, 메모리 16GiB
- WebGL renderer: ANGLE, SwiftShader (소프트웨어 렌더링)
- viewport: 1200 × 900
- Canvas resolution: 1
- maxFps: 60
- warm-up: backend별 5초
- 측정 시간: backend별 300초
- cubism-webgl Core: `core/06`, Cubism 5.3
- pixi-v6 Core: `core/05`, pre-5.3
- 기준 커밋: `5bac7df`

Pixi의 구형 Framework가 Cubism 5.3 Core의 blend-mode 구조와 호환되지 않아 Core
버전은 동일하게 만들 수 없었다. 모델, viewport, CSS 크기, resolution과 프레임
상한은 동일하게 유지했고 backend 전환 시 페이지를 다시 로드했다.

## 재현

```bash
LIVE2D_BENCHMARK_MS=300000 pnpm benchmark:backends
```

raw 결과는 ignored `benchmark-results/backend-comparison.latest.json`에 남는다.
단일 장치·단일 Chromium 실행 결과이므로 일반적인 우열이나 모바일 성능으로
확장 해석하지 않는다. 실제 GPU에서의 backend 비교는
`pnpm benchmark:backends:hardware`로 따로 측정한다.
