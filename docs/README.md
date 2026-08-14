# live2d-web 문서 지도

상태 기준일: **2026-08-14**. 바닐라 우선 headless runtime, React binding,
source/driver 립싱크와 pixi-v6 비교 어댑터가 구현돼 있다. 공식 Framework
5-r.5 WebGL2 어댑터도 정식 패키지 경로에 통합돼 기본 backend로 동작한다.
저장소 공개와 npm 배포는 아직 하지 않았다.

1. [생태계 조사](ecosystem-survey.md)
2. [제품 비전](product-vision.md)
3. [아키텍처](architecture.md)
4. [API reference](api-design.md)
5. [라이선스와 상표](licensing.md)
6. [cubism-webgl 백엔드 구현 계획](cubism-webgl-plan.md)
7. [cubism-webgl과 pixi-v6 성능 비교](benchmarks/2026-08-14-cubism-webgl-vs-pixi-v6.md)
8. [로드맵](roadmap.md)
9. [과거 AIZUCHI 추출 지도](extraction-map.md)

## 확정된 결정

- 제품·npm 패키지, 로컬 디렉터리와 GitHub 저장소 이름은 `live2d-web`이다.
- npm 패키지는 하나이며 `.`, `/react`, `/adapters/cubism-webgl`,
  `/adapters/pixi-v6`로 경계를 나눈다.
- 루트는 React와 `"use client"`가 없는 바닐라 API다. React는 optional
  peer이며 `/react`에만 존재한다.
- 바닐라와 React가 같은 headless controller를 사용한다.
- Cubism 4·5 `model3.json/moc3`, WebGL2, Stage당 모델 하나를 첫 범위로
  고정한다.
- 자동 품질이 기본이며 고정 `resolution`은 명시적 opt-out이다.
- 프레임 순서는 모델 motion/effect/physics → 외부 driver → model update →
  metrics → draw다.
- Core·Hiyori·립싱크 profile은 항상 비동봉이다. Framework와 셰이더는
  cubism-webgl 전용 chunk/asset에만 포함한다.
- AIZUCHI는 별도 프로젝트이며 구현·출시 게이트가 아니다. 검증 기준은
  공식 Hiyori와 React/vanilla Playground다.
- backend 생략 시 cubism-webgl을 동적 로딩한다. pixi-v6는 명시적
  비교·호환용으로 유지한다.
- Live2D 문의 결과는 공개·npm 배포 직전의 라이선스 표기와 포함 방식에
  반영한다.
