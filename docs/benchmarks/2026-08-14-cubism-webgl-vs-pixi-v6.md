# cubism-webgl과 pixi-v6 성능 비교

측정일은 **2026-08-14**다. 이 기록의 목적은 cubism-webgl이 Pixi보다
빠르다고 주장하는 것이 아니라, Pixi를 제거한 기본 backend가 기존
pixi-v6 adapter보다 유의미하게 느려지지 않았는지 확인하는 것이다.

## 결론

- cubism-webgl 중앙 FPS는 **59.88**, pixi-v6는 **59.52**였다.
- cubism-webgl 중앙 FPS가 pixi-v6보다 약 **0.60% 높았다**.
- 33ms 초과 프레임 비율은 cubism-webgl **0.0389%**, pixi-v6
  **0.0227%**였다. 차이는 **+0.0162%p**로 허용 기준인 +0.5%p 안이다.
- 두 backend 모두 정해 둔 비열화 기준을 통과했다.

따라서 이번 측정으로 뒷받침할 수 있는 표현은 **“Pixi 의존성을 제거하고
공식 Framework WebGL renderer를 직접 연결했지만, 동일한 Hiyori 조건에서
기존 Pixi backend와 동등한 프레임 성능을 유지했다”**이다. 단일 장치에서 한
번 측정한 결과이므로 cubism-webgl이 일반적으로 더 빠르다고 주장하지 않는다.

## 결과

| 항목 | cubism-webgl | pixi-v6 | 판정 |
|---|---:|---:|---|
| 중앙 FPS | 59.8802 | 59.5238 | 기준 통과 |
| 측정 프레임 | 18,003 | 17,619 | 둘 다 평균 30 FPS 이상 |
| 33ms 초과 프레임 | 7 | 4 | 기준 통과 |
| 33ms 초과 비율 | 0.0389% | 0.0227% | +0.0162%p |

합격 기준은 다음과 같다.

- cubism-webgl 중앙 FPS가 pixi-v6보다 5% 이상 낮아지지 않을 것
- cubism-webgl의 33ms 초과 프레임 비율 증가가 0.5%p 이하일 것
- 두 backend 모두 실제 update frame이 평균 30 FPS를 넘을 것

## 측정 조건

- 모델: 공식 Hiyori
- 브라우저: Chrome for Testing 151.0.7922.34, Playwright 1.62.0
- 운영체제: macOS 15.6.1, arm64
- 장치: Mac14,10, Apple M2 Pro, 메모리 16GiB
- viewport: 1200 × 900
- Canvas resolution: 1
- maxFps: 60
- warm-up: backend별 5초
- 측정 시간: backend별 300초
- cubism-webgl Core: `core/06`, Cubism 5.3
- pixi-v6 Core: `core/05`, pre-5.3
- 구현 기준 커밋: `78e6442`

Pixi 쪽 Framework가 Cubism 5.3 Core의 blend-mode 구조와 호환되지 않아 Core
버전은 같게 만들 수 없었다. 모델, viewport, CSS 크기, Canvas resolution과
프레임 상한은 동일하게 유지했으며 backend를 바꿀 때 페이지를 다시 로드했다.

## 측정 방법

Playground를 production build와 `next start`로 실행한다. `/compare`에서 실제
Stage update 간격을 기록하고, 각 backend를 5초간 준비한 뒤 5분간 순차
측정한다. 측정 결과 원본은 `benchmark-results/backend-comparison.latest.json`에
생성되며 반복 실행 결과가 실수로 커밋되지 않도록 Git에서 제외한다.

```bash
LIVE2D_BENCHMARK_MS=300000 pnpm benchmark:backends
```

테스트와 임계값은 `benchmarks/backend-comparison.spec.ts`, 실행 환경은
`benchmarks/playwright.config.ts`에서 관리한다.

## 해석할 때의 제한

- 단일 장치와 단일 Chromium 버전에서 한 번 측정한 결과다.
- FPS와 33ms 초과 비율만 비교했으며 CPU, GPU, 메모리, 초기 로드 시간은
  측정하지 않았다.
- 60 FPS 상한에 가까운 두 결과의 작은 차이는 시스템 부하나 타이머 오차일
  수 있다.
- 성능 회귀를 판단할 때는 같은 장치와 조건에서 다시 5분 측정한다.
