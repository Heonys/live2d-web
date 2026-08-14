# Live2D backend-memory benchmark — 2026-08-14

## 측정 환경

- Git: `dbfe3f9e3105cfa224246ec1aeb0d649cdea79f9-dirty`
- OS: Darwin 24.6.0 arm64
- CPU: Apple M2 Pro
- 메모리: 16.0 GiB
- 브라우저: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.7922.34 Safari/537.36
- WebGL renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)
- Core: per run; see condition.core
- Framework: 5-r.5 / pixi-live2d-display@0.4
- 공식 샘플: Hiyori

## 결과

각 backend는 새 Chromium context에서 측정했다. Heap은 강제 GC 뒤 값이며 GPU 메모리가 아니다.

| Backend | Core | Stage | 회차당 cycle | 반복 수 | Baseline heap | Active heap | Active delta | Released heap | Retained delta | 종료 Canvas | Common JS | Adapter JS | Core JS | Total JS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cubism-webgl | 5.3 (core/06) | 1 | 20 | 3 | 2.71 MiB | 6.11 MiB | 3.40 MiB | 5.86 MiB | 3.15 MiB | 0 | 0.15 MiB | 0.05 MiB | 0.06 MiB | 0.26 MiB |
| cubism-webgl | 5.3 (core/06) | 4 | 5 | 3 | 2.76 MiB | 7.19 MiB | 4.43 MiB | 5.94 MiB | 3.18 MiB | 0 | 0.15 MiB | 0.05 MiB | 0.06 MiB | 0.26 MiB |
| pixi-v6 | pre-5.3 (core/05) | 1 | 20 | 3 | 2.75 MiB | 6.30 MiB | 3.55 MiB | 6.07 MiB | 3.32 MiB | 0 | 0.15 MiB | 0.08 MiB | 0.06 MiB | 0.29 MiB |
| pixi-v6 | pre-5.3 (core/05) | 4 | 5 | 3 | 2.76 MiB | 7.08 MiB | 4.37 MiB | 6.13 MiB | 3.38 MiB | 0 | 0.15 MiB | 0.08 MiB | 0.06 MiB | 0.29 MiB |

## 판정

두 Stage 조건 모두에서 10% 이상 낮다는 기준을 충족하지 않아 메모리 차이는 불분명하다.

이 Playground 로드에서 추가 adapter JS encoded byte는 cubism-webgl
0.05 MiB, pixi-v6 0.08 MiB로 cubism-webgl이 40.75% 적었다. 이는 전송 자산
기록이며 JS heap이나 전체 패키지 크기가 아니다.

## 해석 제한

- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
