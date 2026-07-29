# 라이선스와 상표

공개 라이브러리라서 라이선스가 API 형태를 바꾼다. 이 문서는 그 인과를 기록한다. 기준일 **2026-07-29**.

## Cubism Core: 비동봉이 API를 만든다

인과 사슬을 명시한다.

Live2D Cubism Core(`live2dcubismcore.min.js`)는 **재배포 금지**다 → npm 패키지에 동봉할 수 없다 → 사용자가 [공식 SDK](https://www.live2d.com/sdk/download/web/)에서 받아 `<script>`로 직접 로드해야 한다 → 빠뜨리면 하부 라이브러리가 **조용히 실패**한다 → 그래서 공개 API에 `ensureCubismCore()`가 존재한다: 전역 `Live2DCubismCore`를 검증하고, 없으면 로드 방법을 담은 명확한 에러를 던진다.

데모·예제 저장소도 Core를 커밋하지 않는다. aizuchi처럼 다운로드 스크립트 + gitignore로 처리한다.

## Cubism SDK 퍼블리케이션 라이선스

Cubism SDK 기반 제품 출시에는 Live2D의 퍼블리케이션 라이선스가 필요하다. 연매출 1,000만 엔 미만 소규모 사업자는 무료. **라이브러리 자체가 아니라 라이브러리로 제품을 출시하는 사용자에게 해당하는 의무**이므로, 루트 README에 고지한다. 조건은 개정될 수 있으니 인용할 때마다 공식 페이지 확인을 함께 안내한다.

## 상표

"Live2D"와 "Cubism"은 Live2D Inc.의 상표다. 패키지 이름에 기술명을 쓰는 것은 생태계 관례(`pixi-live2d-display` 등)를 따르되:

- 루트 README에 **Unofficial** 명시 — "not affiliated with or endorsed by Live2D Inc." (문안은 README에 반영됨)
- Live2D Inc.의 로고·브랜드 자산은 사용하지 않는다.

## 선행 코드 크레딧

| 출처 | 라이선스 | 이 프로젝트와의 관계 |
|---|---|---|
| `pixi-live2d-display` (guansss) | MIT | v0.1 어댑터의 하부 렌더러 |
| AIRI (moeru-ai) | MIT | 립싱크 드라이버·idle gaze 로직이 (aizuchi를 경유한) 포팅 — LICENSE·README 크레딧 필수 |
| aizuchi (같은 작성자) | 비공개 | 추출 원본 — [추출 지도](extraction-map.md) |

AIRI의 **캐릭터 에셋은 사용 금지**(라이선스 불명) — 코드 패턴만 차용한다. 데모 모델은 Live2D 공식 무료 샘플(Hiyori 등)의 이용 약관을 확인하고 쓴다.

## 자체 라이선스

**MIT 제안** — 생태계 관례(하부·선행 프로젝트 모두 MIT)와 제약 없는 채택 유도에 부합한다. 최종 확정은 미결.

## 미결 항목

- **wlipsync 라이선스 + 동봉 `profile.json`(MFCC 프로파일)의 출처·재배포 가능 여부** — `<LipSync>` 내장 드라이버(v0.2)의 전제 조건. **코드 착수 전 확인.**
- **공식 Cubism SDK Framework의 라이선스(Live2D Open Software License) 검토** — native 어댑터(v2 후보)가 Framework를 의존·동봉할 수 있는 형태인지. [로드맵](roadmap.md) v2의 전제.
- 라이브러리 라이선스 최종 확정 (MIT 제안).
- GitHub 계정·org 선택, 리포 공개 시점 — [로드맵](roadmap.md).
