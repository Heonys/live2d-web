# 0.5 MediaPipe 후보 측정 — 2026-08-24

`develop`의 0.4 Hiyori 검증 커밋 `f547f3a` 다음에 선택형
`/tracking/mediapipe`를 추가한 작업 트리를 측정했다. 비교 대상은
[v0.3.1 안정화 기준선](2026-08-24-v0.3.1-baseline.md)과
[0.4 후보](2026-08-24-motion-expression-candidate.md)다.

## 배포 크기

| 항목 | v0.3.1 | 0.4 후보 | 0.5 후보 | 0.4 대비 |
| --- | ---: | ---: | ---: | ---: |
| root entry raw / gzip | 0.68 / 0.34 kB | 2.61 / 1.11 kB | 2.61 / 1.11 kB | 0 / 0 kB |
| runtime chunk raw / gzip | 32.02 / 8.65 kB | 34.15 / 9.13 kB | 34.15 / 9.13 kB | 0 / 0 kB |
| cubism-webgl entry raw / gzip | 20.52 / 3.16 kB | 20.52 / 3.16 kB | 20.52 / 3.16 kB | 0 / 0 kB |
| Framework/model chunk raw / gzip | 515.98 / 89.62 kB | 520.64 / 90.64 kB | 520.99 / 90.71 kB | +0.35 / +0.07 kB |
| tracking entry raw / gzip | — | — | 23.08 / 5.85 kB | +23.08 / +5.85 kB |
| tarball 압축 / 해제 | 124.8 / 664.8 kB | 129.3 / 683.1 kB | 136.5 / 712.2 kB | +7.2 / +29.1 kB |
| tarball 파일 수 | 31 | 32 | 35 | +3 |

React entry는 22.77/5.81 kB다. 모델 chunk의 증가는 built-in backend가
`ModelInfo.parameters` 범위 메타데이터를 제공하는 코드이고, tracking entry는
순수 매핑·보정·생명주기 wrapper다. root 정적 그래프에는 MediaPipe, React,
Framework, Pixi와 wLipSync runtime이 없고 기존 100kB 예산을 유지한다.

`@mediapipe/tasks-vision@1.0.1`의 JS는 155.44/45.18 kB(raw/gzip), SIMD WASM은
11.76/3.45 MB, Face Landmarker float16 모델은 3.76/3.33 MB다. 모두 optional
peer 또는 사용자 공급 자산이고 live2d-web tarball에는 없다.

## 추론과 프레임

환경은 Apple Silicon macOS, Node 24.11.0, Playwright 1.62.0, 공식 portrait,
CPU delegate와 기본 15fps다. 브라우저별로 단독 실행해 60개 inference sample을
측정했다.

| 브라우저 | inference p50 / p95 | tracking 전/후 frame p95 | 33ms 초과 프레임 |
| --- | ---: | ---: | ---: |
| Chromium | 13.4 / 14.4 ms | 9.2 / 9.3 ms | 0.16% |
| WebKit | 15 / 17 ms | 26 / 24 ms | 0.31% |
| Firefox | 186 / 202 ms | 9.26 / 200.92 ms | 100% |

계획의 Worker 검토 기준(inference p95 16.7ms 초과 또는 33ms 초과 프레임 5%)을
Firefox가 크게 넘고 WebKit도 경계에 걸쳤다. 따라서 기본 `maxFps`는 15로
낮췄다. Worker는 Firefox·저성능 장치에서 Live2D 렌더 스레드를 보호하는 다음
작업으로 기록한다. 이 결과는 reference 데스크톱 판정이며 모바일·GPU delegate의
보장이 아니다.

공식 WASM·모델·portrait를 사용한 실제 Face Landmarker e2e는 Chromium,
WebKit, Firefox에서 모두 통과했다. 52개 blendshape와 변환 행렬이 없는 결과는
tracked로 인정하지 않으며, blank loss와 task 재생성·dispose까지 검증한다.

선택적인 Chromium 안정성 smoke는 5분 동안 실제 portrait 추론을 유지하고
tracker를 한 번 완전히 재생성했다. 분당 heap 5개는 모두 14.3MB였고,
console/page error 없이 마지막 dispose까지 통과했다. 이 짧은 smoke는 생명주기
파손과 급격한 증가를 찾는 검사이며 장기 누수 부재를 증명하는 자료는 아니다.
