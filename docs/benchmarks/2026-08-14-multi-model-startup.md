# Live2D startup benchmark — 2026-08-14

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

단위는 ms이며 cold/warm 조건별 3회 중앙값이다.

| 모델 | 캐시 | 반복 수 | Ready | First draw | model3 fetch | moc fetch | moc parse | Optional | Shader | Texture fetch | Texture decode | Texture upload |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mark | cold | 3 | 334.00 | 162.90 | 2.60 | 1.50 | 9.50 | 2.30 | 70.10 | 5.70 | 11.70 | 3.80 |
| mark | warm | 3 | 291.70 | 123.40 | 0.60 | 0.80 | 1.00 | 1.00 | 67.10 | 5.10 | 9.60 | 3.50 |
| hiyori | cold | 3 | 341.90 | 169.70 | 2.90 | 1.70 | 10.20 | 4.10 | 69.00 | 5.10 | 16.60 | 3.70 |
| hiyori | warm | 3 | 302.80 | 132.90 | 0.70 | 0.80 | 1.20 | 30.70 | 68.30 | 5.10 | 16.50 | 3.70 |
| mao | cold | 3 | 471.70 | 199.60 | 2.60 | 3.00 | 15.10 | 5.00 | 68.80 | 5.80 | 35.60 | 3.90 |
| mao | warm | 3 | 160.60 | 160.60 | 0.70 | 1.90 | 3.30 | 31.40 | 68.00 | 5.10 | 37.10 | 3.50 |
| rice | cold | 3 | 454.50 | 210.80 | 2.50 | 2.20 | 13.40 | 5.10 | 69.00 | 10.05 | 12.50 | 3.50 |
| rice | warm | 3 | 170.70 | 169.00 | 30.70 | 1.30 | 1.90 | 2.20 | 68.00 | 10.30 | 12.65 | 3.60 |
| ren | cold | 3 | 719.70 | 182.00 | 2.70 | 3.10 | 14.40 | 4.40 | 68.00 | 5.20 | 13.40 | 3.70 |
| ren | warm | 3 | 143.60 | 142.40 | 31.00 | 1.90 | 2.40 | 3.80 | 67.10 | 3.50 | 13.90 | 3.70 |

## 결론

- cold ready 중앙값은 Mark 334.0ms, Hiyori 341.9ms, Mao 471.7ms, Rice 454.5ms, Ren 719.7ms였다.
- warm ready는 각각 291.7ms, 302.8ms, 160.6ms, 170.7ms, 143.6ms였다. 브라우저 cache 효과는 모델마다 달랐다.
- 모든 모델에서 shader setup이 약 67.1~70.1ms로 가장 큰 공통 구간이며 warm에서도 줄지 않았다. 이는 context별 공식 renderer shader 준비 비용이다.
- texture decode는 Mao가 약 35.6~37.1ms로 가장 컸지만, 전체 matrix에서 Mao는 59.88 FPS를 유지했다. 따라서 별도 application URL cache/LRU는 이번 측정만으로 5% 채택 근거가 없어 추가하지 않았다.
- `ready`에는 고정 motion load/start가 포함되고 `first draw`와 별도로 기록되므로 두 값의 순서는 브라우저 scheduling과 cache 상태에 따라 달라질 수 있다.

## 해석 제한

- 각 조건의 반복 원본을 보존한 보고서이며, 최종 비교는 같은 조건 3회의 중앙값으로 판단한다.
- GPU timer extension이 없거나 disjoint 상태면 GPU 시간은 `n/a`다.
- texture 픽셀 수와 JS heap은 GPU 메모리 사용량을 뜻하지 않는다.
- 데스크톱 브라우저 측정으로 실제 모바일 GPU 성능을 단정하지 않는다.
