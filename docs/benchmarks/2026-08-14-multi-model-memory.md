# Live2D memory benchmark — 2026-08-14

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

각 cycle에서 dispose와 강제 GC를 마친 뒤 측정한 값이다.

| 모델 | Stage | cycle 수 | Ready 중앙값 | GC 후 Heap 중앙값 | 종료 후 소유 리소스 |
| --- | ---: | ---: | ---: | ---: | --- |
| hiyori | 1 | 20 | 298.30 ms | 6.00 MiB | 0 (released) |
| hiyori | 4 | 5 | 1243.30 ms | 6.03 MiB | 0 (released) |
| ren | 1 | 20 | 673.65 ms | 6.16 MiB | 0 (released) |
| ren | 4 | 5 | 2737.90 ms | 6.23 MiB | 0 (released) |

## 결론

- Hiyori와 Ren의 단일 Stage 20회, 4 Stage 동시 5회에서 매 cycle 종료 뒤 Canvas, context, texture, pending motion/expression과 Framework reference가 모두 0으로 복귀했다.
- 단일 Stage GC 후 heap은 Hiyori가 첫 5.35MiB에서 마지막 6.06MiB, Ren이 5.48MiB에서 6.19MiB로 올라간 뒤 마지막 5회 범위가 각각 0.011MiB, 0.005MiB로 안정됐다.
- 4 Stage 결과도 마지막에 Hiyori 6.06MiB, Ren 6.24MiB였으며, 소유 리소스 누수 신호는 발견되지 않았다.
- JS heap은 GPU texture 메모리를 포함하지 않으므로 GPU 메모리 누수 통과 판정으로 표현하지 않는다.

## 해석 제한

- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
