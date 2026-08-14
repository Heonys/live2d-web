# Live2D matrix benchmark — 2026-08-14

## 측정 환경

- Git: `be2791d3e96ff6143c7991fa5bf7c3bfa2ec5ec4`
- 작업 트리: 위 커밋을 기반으로 현재 다중 모델 diagnostics 변경을 포함
- OS: Darwin 24.6.0 arm64
- CPU: Apple M2 Pro
- 메모리: 16.0 GiB
- 브라우저: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36
- WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
- Core: 5.3 (core/06)
- Framework: 5-r.5
- 공식 샘플: CubismWebSamples@5-r.5

## 결과

| 모델 | 캐시 | Stage | 해상도 | 반복 수 | Ready | 중앙 FPS | Frame p95 | Draw CPU p50 | Draw GPU p50 | 33ms 초과 | Heap |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mark | - | 1 | 1 | 3 | 312.70 ms | 59.88 FPS | 17.50 ms | 0.10 ms | n/a | 0.00% | n/a |
| mark | - | 1 | 2 | 3 | 401.40 ms | 59.88 FPS | 17.40 ms | 0.10 ms | n/a | 0.06% | n/a |
| hiyori | - | 1 | 1 | 3 | 321.20 ms | 59.88 FPS | 17.40 ms | 0.20 ms | n/a | 0.00% | n/a |
| hiyori | - | 1 | 2 | 3 | 232.60 ms | 59.88 FPS | 17.40 ms | 0.10 ms | n/a | 0.00% | n/a |
| mao | - | 1 | 1 | 3 | 188.80 ms | 59.88 FPS | 17.50 ms | 0.30 ms | n/a | 0.00% | n/a |
| mao | - | 1 | 2 | 3 | 248.00 ms | 59.88 FPS | 25.00 ms | 0.30 ms | n/a | 0.27% | n/a |
| rice | - | 1 | 1 | 3 | 436.50 ms | 59.88 FPS | 17.40 ms | 0.20 ms | n/a | 0.00% | n/a |
| rice | - | 1 | 2 | 3 | 259.60 ms | 59.88 FPS | 17.40 ms | 0.20 ms | n/a | 0.03% | n/a |
| ren | - | 1 | 1 | 3 | 665.10 ms | 17.12 FPS | 66.80 ms | 0.30 ms | n/a | 100.00% | n/a |
| ren | - | 1 | 2 | 3 | 1209.50 ms | 4.80 FPS | 217.23 ms | 0.40 ms | n/a | 100.00% | n/a |
| hiyori | - | 2 | 1 | 3 | 624.20 ms | 59.88 FPS | 17.00 ms | 0.10 ms | n/a | 0.00% | n/a |
| hiyori | - | 2 | 2 | 3 | 888.50 ms | 40.00 FPS | 33.40 ms | 0.10 ms | n/a | 20.72% | n/a |
| hiyori | - | 4 | 1 | 3 | 1280.90 ms | 40.00 FPS | 25.10 ms | 0.10 ms | n/a | 0.38% | n/a |
| hiyori | - | 4 | 2 | 3 | 1731.90 ms | 19.80 FPS | 58.70 ms | 0.10 ms | n/a | 100.00% | n/a |
| ren | - | 2 | 1 | 3 | 1349.90 ms | 8.00 FPS | 125.70 ms | 0.30 ms | n/a | 100.00% | n/a |
| ren | - | 2 | 2 | 3 | 2631.80 ms | 2.40 FPS | 425.30 ms | 0.30 ms | n/a | 100.00% | n/a |
| ren | - | 4 | 1 | 3 | 3017.60 ms | 4.00 FPS | 275.08 ms | 0.30 ms | n/a | 100.00% | n/a |
| ren | - | 4 | 2 | 3 | 5167.70 ms | 1.19 FPS | 875.10 ms | 0.30 ms | n/a | 100.00% | n/a |

## CPU 구간 분해

단위는 ms이며 같은 조건 반복의 중앙값이다.

| 모델 | Stage | 해상도 | Motion p50 | Effect/physics/pose p50 | Core update p50 | Draw CPU p50 | Stage CPU p50 | Stage CPU p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mark | 1 | 1 | 0.00 | 0.00 | 0.10 | 0.10 | 0.20 | 0.30 |
| mark | 1 | 2 | 0.00 | 0.00 | 0.10 | 0.10 | 0.20 | 0.30 |
| hiyori | 1 | 1 | 0.00 | 0.00 | 0.10 | 0.20 | 0.30 | 0.40 |
| hiyori | 1 | 2 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.40 |
| mao | 1 | 1 | 0.00 | 0.00 | 0.30 | 0.30 | 0.70 | 0.80 |
| mao | 1 | 2 | 0.00 | 0.00 | 0.30 | 0.30 | 0.70 | 0.80 |
| rice | 1 | 1 | 0.00 | 0.00 | 0.20 | 0.20 | 0.50 | 0.60 |
| rice | 1 | 2 | 0.00 | 0.00 | 0.20 | 0.20 | 0.40 | 0.60 |
| ren | 1 | 1 | 0.00 | 0.10 | 0.30 | 0.30 | 0.80 | 1.00 |
| ren | 1 | 2 | 0.00 | 0.10 | 0.40 | 0.40 | 0.90 | 1.00 |
| hiyori | 2 | 1 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.30 |
| hiyori | 2 | 2 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.40 |
| hiyori | 4 | 1 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.40 |
| hiyori | 4 | 2 | 0.00 | 0.00 | 0.10 | 0.10 | 0.30 | 0.40 |
| ren | 2 | 1 | 0.00 | 0.10 | 0.30 | 0.30 | 0.80 | 0.90 |
| ren | 2 | 2 | 0.00 | 0.10 | 0.40 | 0.30 | 0.80 | 1.00 |
| ren | 4 | 1 | 0.00 | 0.10 | 0.30 | 0.30 | 0.70 | 1.00 |
| ren | 4 | 2 | 0.00 | 0.10 | 0.30 | 0.30 | 0.80 | 1.00 |

## 결론과 최적화 판단

- Mark, Hiyori, Mao, Rice의 단일 Stage는 두 resolution 모두 중앙 59.88 FPS를 유지했다.
- Ren은 1 Stage에서도 resolution 1은 17.12 FPS, resolution 2는 4.80 FPS였다. Hiyori도 4 Stage / resolution 2에서는 19.80 FPS로 낮아졌다.
- 가장 느린 Ren 4 Stage / resolution 2도 프로젝트가 제어하는 Stage CPU는 p50 0.80ms, p95 1.00ms였다. 실제 frame p50은 약 840ms이므로 JS motion·effect·Core 호출·draw 제출 시간이 병목을 설명하지 못한다.
- 이 측정의 WebGL renderer는 하드웨어 GPU가 아닌 SwiftShader이고 GPU timer extension도 없었다. 따라서 위 차이는 공식 renderer가 제출한 작업을 software GPU가 처리하는 비용 또는 그에 따른 브라우저 scheduling 지연이 지배한다는 추론이며, 실제 하드웨어 GPU 수치로 일반화할 수 없다.
- 프로젝트 소유 구간에서 5% 개선을 검증할 후보가 확인되지 않아 asset cache, effect 생략, 공용 frame scheduler 같은 최적화 코드는 채택하지 않았다. Core와 공식 shader도 수정하지 않았다.
- 다음 성능 release gate는 hardware-accelerated Chromium과 실제 모바일 기기에서 같은 matrix의 대표 조건을 재측정하는 것이다.

## 해석 제한

- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
