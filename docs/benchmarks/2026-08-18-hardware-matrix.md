# Live2D hardware-matrix benchmark — 2026-08-18

## 측정 환경

- Git: `4ded98839878010048212fdbc6be22ead33b01ea-dirty`
- OS: Darwin 24.6.0 arm64
- CPU: Apple M2 Pro
- 메모리: 16.0 GiB
- 브라우저: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36
- WebGL renderer: ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)
- Core: 5.3 (core/06)
- Framework: 5-r.5
- 공식 샘플: CubismWebSamples@5-r.5
- 실행 조건: 조건별 **1회**, warm-up 5초 + 측정 20초 (기본값은 3회 × 60초)

## 목적과 판정

시작 비용 최적화가 실제 GPU에서 얼마나 줄었는지 확인하는 단축 검증이다.
기본 조건 실행이 아니므로 확정 보고서로 쓰지 않고, 아래 시작 비용 비교만
방향성 근거로 사용한다.

blend 모드를 쓰지 않는 모델은 셰이더 5개만 컴파일하고 blend 프로그램 237개를
건너뛴다. 이 최적화의 효과는 모델이 blend 모드를 쓰는지에 따라 갈린다.

| 조건 | 지표 | 2026-08-15 (최적화 전) | 2026-08-18 (최적화 뒤) | 변화 |
|---|---|---:|---:|---|
| hiyori, Stage 1, res 1 | shader setup p50 | 457.30 ms | 14.90 ms | 30배 단축 |
| hiyori, Stage 1, res 1 | ready | 580.30 ms | 137.50 ms | 4.2배 단축 |
| ren, Stage 1, res 1 | shader setup p50 | 406.60 ms | 459.60 ms | 차이 없음 |
| ren, Stage 1, res 1 | ready | 476.60 ms | 520.20 ms | 차이 없음 |

hiyori는 blend 모드를 쓰지 않아 셰이더 구간이 거의 사라졌고 ready가 함께
줄었다. ren은 blend 모드를 쓰므로 결국 같은 셰이더를 모두 컴파일해야 하고 이
최적화의 이득이 없다. ren의 두 값 차이는 1회 측정의 실행 간 편차 범위이며
회귀로 읽지 않는다.

비교 기준은 [2026-08-15 hardware smoke](2026-08-15-hardware-smoke.md)의 같은
두 조건이다. 스위트는 다르지만 모델, Stage 수, resolution, 반복 수가 같다.
셰이더 컴파일과 텍스처 요청을 겹치도록 바꾼 뒤로는 텍스처 구간 타이머가 컴파일
대기 시간을 포함하므로, 구간별 값 대신 ready 총합으로 비교한다.

## 결과

| 모델 | Backend | 캐시 | Stage | 해상도 | 반복 수 | Ready | 중앙 FPS | Frame p95 | Draw CPU p50 | Draw GPU p50 | 33ms 초과 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| hiyori | cubism-webgl | - | 1 | 1 | 1 | 137.50 ms | 74.63 FPS | 26.80 ms | 0.10 ms | 0.10 ms | 0.00% |
| hiyori | cubism-webgl | - | 1 | 2 | 1 | 86.00 ms | 74.63 FPS | 26.70 ms | 0.20 ms | 0.28 ms | 0.00% |
| hiyori | cubism-webgl | - | 4 | 1 | 1 | 125.80 ms | 74.63 FPS | 26.80 ms | 0.10 ms | 0.13 ms | 0.00% |
| hiyori | cubism-webgl | - | 4 | 2 | 1 | 178.40 ms | 74.63 FPS | 26.80 ms | 0.10 ms | 0.50 ms | 0.00% |
| ren | cubism-webgl | - | 1 | 1 | 1 | 520.20 ms | 74.63 FPS | 26.80 ms | 0.30 ms | 3.96 ms | 0.00% |
| ren | cubism-webgl | - | 1 | 2 | 1 | 467.10 ms | 74.63 FPS | 26.83 ms | 0.40 ms | 11.16 ms | 0.17% |
| ren | cubism-webgl | - | 4 | 1 | 1 | 2173.60 ms | 74.63 FPS | 27.00 ms | 0.30 ms | 3.40 ms | 0.00% |
| ren | cubism-webgl | - | 4 | 2 | 1 | 1936.90 ms | 38.61 FPS | 39.90 ms | 0.30 ms | 17.43 ms | 7.74% |

## CPU 구간 분해

단위는 ms이며 같은 조건 반복의 중앙값이다.

| 모델 | Stage | 해상도 | Motion p50 | Effect/physics/pose p50 | Core update p50 | Draw CPU p50 | Stage CPU p50 | Stage CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| hiyori | 1 | 1 | 0.00 | 0.00 | 0.20 | 0.10 | 0.40 | 1.10 |
| hiyori | 1 | 2 | 0.00 | 0.00 | 0.20 | 0.20 | 0.50 | 1.20 |
| hiyori | 4 | 1 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.50 |
| hiyori | 4 | 2 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.50 |
| ren | 1 | 1 | 0.00 | 0.00 | 0.40 | 0.30 | 0.80 | 1.10 |
| ren | 1 | 2 | 0.00 | 0.00 | 0.50 | 0.40 | 1.00 | 1.40 |
| ren | 4 | 1 | 0.00 | 0.00 | 0.30 | 0.30 | 0.70 | 1.00 |
| ren | 4 | 2 | 0.10 | 0.10 | 0.50 | 0.30 | 0.90 | 1.70 |

## 관측

- 중앙 FPS 74.63은 120Hz 디스플레이에서 60 FPS 상한을 프레임 건너뛰기로
  구현할 때 생기는 페이싱 아티팩트다. 프레임 간격이 8.3ms와 16.7ms로 갈려
  중앙값이 13.4ms가 되지만, 20초에 1,201프레임으로 **평균은 60.0 FPS**다.
  60Hz 디스플레이에서 측정한 08-15 스모크는 같은 조건에서 59.88 FPS였다.
- 부하 상한은 ren, Stage 4, resolution 2 조건이다. 이 조건만 GPU draw p50
  17.43ms로 프레임 예산을 넘겨 중앙 38.61 FPS, 33ms 초과 7.74%가 된다.
  나머지 7개 조건은 모두 33ms 초과 0.17% 이하다.
- Stage 수 확장 비용도 blend 모드 사용 여부로 갈린다. hiyori는 Stage 4에서도
  ready가 늘지 않지만(125.80 ms vs 137.50 ms), ren은 4.18배(2,173.60 ms)로 거의
  선형 증가한다. Stage마다 WebGL context가 분리되므로 blend 셰이더 컴파일이
  context 수만큼 반복된다. ren의 Stage 4 조건에서 shader setup p50은 477.65 ms로
  Stage 1과 같고, 그 4회분이 ready 총합의 대부분을 차지한다.
- 조건 실행 순서상 첫 조건인 hiyori resolution 1이 Core script 파싱 같은 1회성
  비용을 함께 부담한다. 같은 모델의 resolution 2가 더 빠른 것(86.00 ms)은
  해상도의 효과가 아니라 이 실행 순서 때문이다.

## 해석 제한

- 조건별 1회 × 20초 단축 실행이다. 확정 성능 비교에는 기본 조건인 조건별 3회 ×
  60초 실행(`pnpm benchmark:hardware:matrix`) 결과를 사용한다.
- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
