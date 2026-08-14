# Live2D hardware-smoke benchmark — 2026-08-14

## 측정 환경

- Git: `dbfe3f9e3105cfa224246ec1aeb0d649cdea79f9-dirty`
- OS: Darwin 24.6.0 arm64
- CPU: Apple M2 Pro
- 메모리: 16.0 GiB
- 브라우저: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36
- WebGL renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)
- Core: 5.3 (core/06)
- Framework: 5-r.5
- 공식 샘플: CubismWebSamples@5-r.5

## 결과

| 모델 | Backend | 캐시 | Stage | 해상도 | 반복 수 | Ready | 중앙 FPS | Frame p95 | Draw CPU p50 | Draw GPU p50 | 33ms 초과 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| hiyori | cubism-webgl | - | 1 | 1 | 1 | 580.30 ms | 59.88 FPS | 24.90 ms | 0.50 ms | 0.15 ms | 0.00% |
| ren | cubism-webgl | - | 1 | 1 | 1 | 476.60 ms | 59.88 FPS | 24.50 ms | 0.60 ms | 4.34 ms | 0.00% |

## CPU 구간 분해

단위는 ms이며 같은 조건 반복의 중앙값이다.

| 모델 | Stage | 해상도 | Motion p50 | Effect/physics/pose p50 | Core update p50 | Draw CPU p50 | Stage CPU p50 | Stage CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| hiyori | 1 | 1 | 0.10 | 0.10 | 0.40 | 0.50 | 1.00 | 1.60 |
| ren | 1 | 1 | 0.10 | 0.10 | 0.60 | 0.60 | 1.40 | 1.70 |

## 해석 제한

- 이 smoke 결과는 조건별 1회 연결 검증이다. 확정 성능 비교에는 hardware
  matrix의 조건별 3회 중앙값을 사용한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
