# cubism-webgl과 pixi-v6 성능 재측정

측정일은 **2026-08-15**다. 내부 diagnostics를 통합한 뒤에도 진단이 없는
일반 runtime fast path가 기존 Pixi 비교 기준을 유지하는지 확인했다.

## 결론

- cubism-webgl과 pixi-v6의 중앙 FPS는 모두 **59.8802**였다.
- 33ms 초과 프레임은 cubism-webgl 5개(**0.0278%**), pixi-v6 0개였다.
- 긴 프레임 비율 차이 **+0.0278%p**는 허용 기준 +0.5%p 안이다.
- cubism-webgl은 Pixi 대비 중앙 FPS 5% 비열화 기준도 통과했다.

따라서 diagnostics 통합 뒤에도 **“Pixi 없이 동일한 Hiyori 조건에서 기존
Pixi backend와 동등한 중앙 프레임 성능을 유지했다”**고 말할 수 있다.
두 값 모두 60 FPS 상한에 붙어 있으므로 어느 backend가 더 빠르다는 근거로는
사용하지 않는다.

## 결과

| 항목 | cubism-webgl | pixi-v6 | 판정 |
|---|---:|---:|---|
| 중앙 FPS | 59.8802 | 59.8802 | 기준 통과 |
| 측정 프레임 | 18,000 | 17,605 | 둘 다 평균 30 FPS 이상 |
| 33ms 초과 프레임 | 5 | 0 | 기준 통과 |
| 33ms 초과 비율 | 0.0278% | 0.0000% | +0.0278%p |

## 측정 조건

- 모델: 공식 Hiyori
- 브라우저: Chrome for Testing 151.0.7922.34, Playwright 1.62.0
- 운영체제: macOS 15.6.1, arm64
- 장치: Apple M2 Pro, 메모리 16GiB
- viewport: 1200 × 900
- Canvas resolution: 1
- maxFps: 60
- warm-up: backend별 5초
- 측정 시간: backend별 300초
- cubism-webgl Core: `core/06`, Cubism 5.3
- pixi-v6 Core: `core/05`, pre-5.3
- 기준 커밋: `be2791d`와 현재 다중 모델 diagnostics 작업 트리

Pixi의 구형 Framework가 Cubism 5.3 Core의 blend-mode 구조와 호환되지 않아
Core 버전은 동일하게 만들 수 없었다. 모델, viewport, CSS 크기, resolution과
프레임 상한은 동일하게 유지했고 backend 전환 시 페이지를 다시 로드했다.

## 재현

```bash
LIVE2D_BENCHMARK_MS=300000 pnpm benchmark:backends
```

raw 결과는 ignored `benchmark-results/backend-comparison.latest.json`에 남는다.
단일 장치·단일 Chromium 실행 결과이므로 일반적인 우열이나 모바일 성능으로
확장 해석하지 않는다.
