# live2d-web 문서 지도

상태 기준일: **2026-08-14**. 바닐라 우선 headless runtime, React binding,
source/driver 립싱크와 pixi-v6 비교 어댑터가 구현돼 있다. 공식 Framework
5-r.5 WebGL2 경로는 ignored 비공개 Hiyori 스파이크만 통과했으며 npm 공개와
공식 cubism-webgl export 전이다.

1. [생태계 조사](ecosystem-survey.md)
2. [제품 비전](product-vision.md)
3. [아키텍처](architecture.md)
4. [API reference](api-design.md)
5. [라이선스와 상표](licensing.md)
6. [cubism-webgl 백엔드 구현 계획](cubism-webgl-plan.md)
7. [로드맵](roadmap.md)
8. [과거 AIZUCHI 추출 지도](extraction-map.md)

## 확정된 결정

- 제품·npm 패키지 이름은 `live2d-web`이다. 저장소 URL과 실제 디렉터리
  이름은 외부 rename 전까지 기존 경로를 유지할 수 있다.
- npm 패키지는 하나이며 `.`, `/react`, `/adapters/pixi-v6`로 경계를
  나눈다. `/adapters/cubism-webgl`은 서면 허가 전에는 만들지 않는다.
- 루트는 React와 `"use client"`가 없는 바닐라 API다. React는 optional
  peer이며 `/react`에만 존재한다.
- 바닐라와 React가 같은 headless controller를 사용한다.
- Cubism 4·5 `model3.json/moc3`, WebGL2, Stage당 모델 하나를 첫 범위로
  고정한다.
- 자동 품질이 기본이며 고정 `resolution`은 명시적 opt-out이다.
- 프레임 순서는 모델 motion/effect/physics → 외부 driver → model update →
  metrics → draw다.
- Core·Hiyori·립싱크 profile은 항상 비동봉이다. Framework와 셰이더도
  서면 허가 전에는 비동봉한다.
- AIZUCHI는 별도 프로젝트이며 구현·출시 게이트가 아니다. 검증 기준은
  공식 Hiyori와 React/vanilla Playground다.
- pixi-v6는 cubism-webgl이 공개 기준을 통과할 때까지 비교·호환용으로
  유지한다.
