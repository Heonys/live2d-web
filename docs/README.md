# live2d-web 문서 지도

상태 기준일: **2026-08-24**. 바닐라 우선 headless runtime, React binding,
상호작용 API(hitTest/followPointer/모션 완료 대기), source/driver 립싱크와
pixi-v6 비교 어댑터가 구현돼 있다. 공식 Framework 5-r.5 WebGL2 어댑터가 기본
backend다.

1. [로드맵](roadmap.md) — 성장 목표·상시 품질 기준·고도화 축·버전 순서
2. [호환성](compatibility.md) — 지원·검증·미검증 범위와 알려진 제한
3. [아키텍처](architecture.md)
4. [API reference](api-design.md)
5. [라이선스와 상표](licensing.md)
6. [벤치마크 가이드](benchmarking.md)
7. [배포물과 개발 저장소 보안 검증](security.md)
8. [v0.3.1 안정화 기준선](benchmarks/2026-08-24-v0.3.1-baseline.md)
   — 공개 패키지·소비자·브라우저·smoke 회귀 기준
9. [볼륨 립싱크 드라이버 패키지 변화](benchmarks/2026-08-24-volume-lipsync.md)
   — root/runtime chunk·tarball의 v0.3.1 기준선 대비 변화
10. [모션 페이드 옵션 패키지 변화](benchmarks/2026-08-24-motion-fade.md)
   — root/runtime/cubism/model chunk·tarball의 v0.3.1 기준선 대비 변화
11. [시작 비용 최적화 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)
   — 최신 backend A/B 판정
12. [시작 비용 단축 검증](benchmarks/2026-08-18-hardware-matrix.md)
   — 실제 GPU에서의 셰이더·ready 비용
13. [diagnostics 통합 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)
14. [cubism-webgl과 pixi-v6 성능 비교](benchmarks/2026-08-14-cubism-webgl-vs-pixi-v6.md)
15. [WebGL vs Pixi JS heap 비교](benchmarks/2026-08-15-backend-memory.md)
16. [다중 모델 집중 matrix 결과](benchmarks/2026-08-14-multi-model-matrix.md)
17. [다중 모델 startup 결과](benchmarks/2026-08-14-multi-model-startup.md)
18. [다중 모델 memory 결과](benchmarks/2026-08-14-multi-model-memory.md)
19. [하드웨어 스모크](benchmarks/2026-08-15-hardware-smoke.md)

## 확정된 결정

- 제품·npm 패키지, 로컬 디렉터리와 GitHub 저장소 이름은 `live2d-web`이다.
- 현재 발행 버전은 `0.3.1`이다. 0.4 기능 개발 전에 0.3.x 기반 안정화를 거치며,
  `v*` 태그 푸시가 릴리스 워크플로를 실행해 npm에 발행한다. 변경 이력은
  [CHANGELOG](../CHANGELOG.md)에 기록한다.
- npm 패키지는 하나이며 `.`, `/react`, `/backends/cubism-webgl`로 경계를
  나눈다. pixi-v6는 저장소 안의 벤치마크 비교 대상이며 발행하지 않는다.
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

### 2026-08-22 라이브러리 성장 방향

- **결정문**: live2d-web은 "브라우저에서 Live2D를 다룰 때의 기본 선택지"를
  목표로 꾸준히 키운다. 방향과 순서는 [로드맵](roadmap.md)이 단일 기준이다.
  기능은 소비자 주도로만 추가하고, 각 버전은 소비자 하나가 실제로 받아쓰는
  것을 완료 조건으로 한다.
- **근거**: 사실상 표준인 `pixi-live2d-display`가 2023-12 이후 멈춰 있어 그
  자리가 비어 있다. Livesona가 1호 소비자로 라이브러리를 단련했고(0.3.x의
  resolveAsset·경로 인코딩이 그 결과), 같은 방식으로 소비자를 늘리는 것이
  기능을 먼저 쌓는 것보다 확실하다.
- **포기와 대체**: 확장 프로그램·위젯 같은 별도 제품을 라이브러리 성장
  수단으로 먼저 만드는 것(또 하나의 제품이 되어 같은 비용이 반복된다).
  대신 라이브러리를 키우고 소비자가 그 위에서 만든다. VS Code 확장은
  Livesona 마무리 뒤의 다음 소비자 후보로 보류.
- **재검토 조건**: 외부 의존 프로젝트가 0.5 시점까지 늘지 않으면 기능
  순서를 멈추고 F(개발자 경험)를 앞당긴다.

### 2026-08-24 기반 안정화와 상시 품질 기준

- **결정문**: 0.4 기능 개발 전에 0.3.x 기반 안정화를 둔다. 현재 자동화된
  lint·typecheck·unit·tarball 소비자 게이트와 아직 수동인 브라우저 e2e를
  구분해 기록하고, e2e를 실제 CI·릴리스 게이트로 승격한다. 이후 모든 기능은
  [로드맵의 상시 품질 기준](roadmap.md#상시-품질-기준)을 함께 만족한다.
- **근거**: 문서가 브라우저 3종 e2e를 현재 릴리스 게이트로 설명하지만 실제
  workflow는 이를 실행하지 않는다. 또한 runtime과 기본 backend의 핵심 파일에
  여러 책임이 모여 있어 0.4 이후 기능을 그대로 쌓으면 공개 계약과 생명주기
  회귀를 추적하기 어려워진다.
- **포기와 대체**: 기능을 먼저 쌓은 뒤 한 번에 내부를 다시 만드는 방식과,
  공개 API를 바꾸는 대규모 선행 리팩터링을 하지 않는다. 대신 기능이 닿는
  책임부터 점진적으로 추출하고 API·번들·성능 기준선을 유지한다.
- **재검토 조건**: 브라우저 3종 e2e가 자동 게이트가 되면 문서의 표현을 현재
  상태로 갱신한다. 다중 모델이 Stage 소유 계약을 바꿔야 할 때는 이 원칙과
  공개 계약을 다시 검토한다.
