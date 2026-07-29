# live2d-jsx 문서 지도

이 폴더는 live2d-jsx의 설계 계약을 정리하는 단일 진입점이다. 설계 문서는 한국어로 쓰고, 저장소 루트 `README.md`와 공개 API 레퍼런스는 영어로 쓴다. 일본어 콘텐츠는 저장소 밖(Zenn)에서 다룬다.

## 현재 한 줄 정의

**Live2D Cubism 모델을 React에서 JSX로 선언적으로 다루는 라이브러리 — 포크가 난립하는 하부 생태계를 어댑터로 흡수하는 단일 React 레이어.**

## 문서 목록

1. [생태계 조사](ecosystem-survey.md): npm 실측 근거, 검색성 실험, 이름 결정 기록
2. [제품 비전](product-vision.md): 풀고 싶은 문제, 제품 약속, 만들지 않는 것
3. [아키텍처](architecture.md): 어댑터 결정, 백엔드 계약, onAfterMotionUpdate 난제
4. [API 설계](api-design.md): 컴포넌트·훅 계약, per-frame 규약, 에러 모델
5. [추출 지도](extraction-map.md): aizuchi에서 무엇을 옮기고 무엇을 새로 쓰는가
6. [라이선스](licensing.md): Cubism Core 비동봉의 인과, 상표, 선행 코드 크레딧
7. [로드맵](roadmap.md): M0 스파이크, v0.1~v0.4, 데모, 공개 계획

## 확정된 결정

- 패키지 이름은 `live2d-jsx`다(2026-07-29). npm 미점유 실측 확인. 근거와 탈락 후보는 [생태계 조사](ecosystem-survey.md)에 기록한다.
- 렌더링 백엔드는 어댑터 계약 뒤에 둔다(2026-07-29). v0.1은 `pixi-live2d-display@0.4`(+PIXI v6) 어댑터 하나만 구현한다. [아키텍처](architecture.md).
- 단일 패키지 + 서브패스 export(`live2d-jsx/adapters/pixi-v6`)로 시작한다(2026-07-29). 모노레포는 두 번째 어댑터가 착지할 때 재검토한다. [아키텍처](architecture.md).
- 퍼블리시 라이브러리이므로 빌드 산출물(ESM + d.ts)을 만든다(2026-07-29) — aizuchi의 "dist 금지" 규칙 반전. [아키텍처](architecture.md).
- Cubism Core는 동봉하지 않는다(2026-07-29). 라이선스상 재배포 금지 — `ensureCubismCore()`로 대응한다. [라이선스](licensing.md).
- 코드 착수 전 M0 스파이크로 `onAfterMotionUpdate` 계약 성립을 검증한다(2026-07-29). [로드맵](roadmap.md).
- 문서 언어는 `docs/` 한국어, README·API 레퍼런스 영어다(2026-07-29).
- 첫 실사용처(도그푸딩)는 aizuchi다 — v0.2에서 StageView를 교체한다(2026-07-29). [로드맵](roadmap.md).
- 립싱크는 RMS가 아니라 wlipsync(모음 분류) 기반이다(2026-07-29). 외부 드라이버 주입 모드도 함께 제공한다. [API 설계](api-design.md).
- v2 후보로 공식 SDK 직결 native 어댑터를 둔다(2026-07-29) — 계약 순수성·탈출구 격리·적합성 스위트 규칙과 함께. M0 불성립 시의 대안 경로이기도 하다. [아키텍처](architecture.md).

## 문서 범위 밖

현재 문서는 설계 계약을 다룬다. 저장소 스캐폴딩(워크스페이스·플레이그라운드·계약 타입과 `ensureCubismCore` 스텁)은 2026-07-29에 완료 — 구조는 [아키텍처](architecture.md)의 저장소 구조 결정 참조. 어댑터 실구현(M0 대기), git 초기화, npm 퍼블리시 절차는 아직 포함하지 않는다.

미결 항목은 각 문서에 명시돼 있다: wlipsync·profile.json 라이선스([라이선스](licensing.md)) / 라이브러리 라이선스 최종 확정(MIT 제안) / GitHub 계정·공개 시점([로드맵](roadmap.md)) / 배경 플레이트의 v0.1 포함 여부([추출 지도](extraction-map.md)) / 동시 로드 보호 설계([아키텍처](architecture.md)).
