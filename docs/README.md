# live2d-web 문서 지도

상태 기준일: **2026-08-18**. 바닐라 우선 headless runtime, React binding,
상호작용 API(hitTest/followPointer/모션 완료 대기), source/driver 립싱크와
pixi-v6 비교 어댑터가 구현돼 있다. 공식 Framework 5-r.5 WebGL2 어댑터가 기본
backend다.

1. [아키텍처](architecture.md)
2. [API reference](api-design.md)
3. [라이선스와 상표](licensing.md)
4. [벤치마크 가이드](benchmarking.md)
5. [시작 비용 최적화 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)
   — 최신 backend A/B 판정
6. [시작 비용 단축 검증](benchmarks/2026-08-18-hardware-matrix.md)
   — 실제 GPU에서의 셰이더·ready 비용
7. [diagnostics 통합 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)
8. [cubism-webgl과 pixi-v6 성능 비교](benchmarks/2026-08-14-cubism-webgl-vs-pixi-v6.md)
9. [WebGL vs Pixi JS heap 비교](benchmarks/2026-08-15-backend-memory.md)
10. [다중 모델 집중 matrix 결과](benchmarks/2026-08-14-multi-model-matrix.md)
11. [다중 모델 startup 결과](benchmarks/2026-08-14-multi-model-startup.md)
12. [다중 모델 memory 결과](benchmarks/2026-08-14-multi-model-memory.md)
13. [하드웨어 스모크](benchmarks/2026-08-15-hardware-smoke.md)

## 확정된 결정

- 제품·npm 패키지, 로컬 디렉터리와 GitHub 저장소 이름은 `live2d-web`이다.
- 버전은 `0.1.0`이며, `v*` 태그 푸시가 릴리스 워크플로를 실행해 npm에
  발행한다. 변경 이력은 [CHANGELOG](../CHANGELOG.md)에 기록한다.
- npm 패키지는 하나이며 `.`, `/react`, `/backends/cubism-webgl`,
  `/backends/pixi-v6`로 경계를 나눈다.
- 루트는 React와 `"use client"`가 없는 바닐라 API다. React는 optional
  peer이며 `/react`에만 존재한다.
- 바닐라와 React가 같은 headless controller를 사용한다.
- Cubism 4·5 `model3.json/moc3`, WebGL2, Stage당 모델 하나를 첫 범위로
  고정한다.
- 자동 품질이 기본이며 고정 `resolution`은 명시적 opt-out이다.
- 프레임 순서는 모델 motion/effect/physics → 외부 driver → model update →
  metrics → draw다.
- Core·샘플 모델·립싱크 profile은 항상 비동봉이다. Framework와 셰이더는
  cubism-webgl 전용 chunk/asset에만 포함한다.
- backend 생략 시 cubism-webgl을 동적 로딩한다. pixi-v6는 명시적
  비교·호환용으로 유지한다.
