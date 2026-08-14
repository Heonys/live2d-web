# 라이선스와 상표

상태 기준일: **2026-07-30**. 이 문서는 법률 자문이 아니라 프로젝트의
배포 경계를 기록한다.

## 프로젝트 코드

- `live2d-web` 자체 코드는 MIT 라이선스다.
- AIRI에서 유래한 통합 패턴과 MIT 하부 프로젝트는
  `THIRD_PARTY_NOTICES.md`에 고지한다.
- root 번들은 React 없이 자체 runtime만 포함하며 wLipSync는 source 모드에서
  동적으로 로드하는 외부 dependency다.
- PIXI와 pixi-live2d-display는 adapter 전용 optional peer다.

## Live2D 자산과 SDK

- Cubism Core와 Hiyori를 비롯한 샘플 모델은 git이나 npm 패키지에 포함하지
  않는다.
- Cubism Framework와 WebGL 셰이더는 현재 포함하지 않는다. 향후
  cubism-webgl adapter의 재배포를 Live2D가 서면으로 허용한 경우에만
  해당 adapter 전용 dist에 포함한다.
- 개발자는 공식 SDK와 각 샘플의 현재 약관에 동의한 뒤 로컬 ignored
  경로에 준비한다.
- `pnpm fetch-assets`는 비공식 미러를 사용하지 않는다. 공식 Core 호스팅
  URL과 공식 Hiyori 배포 URL만 사용하며, 최초 다운로드에는
  `LIVE2D_ACCEPT_TERMS=1`로 사용자의 약관 확인을 요구한다.
- README에는 “Core 재배포가 무조건 금지” 또는 고정 매출 기준처럼
  개정될 수 있는 법률 해석을 단정하지 않는다.
- 제품 출시자는 자신의 사용 형태가 Publication License나 Expandable
  Application에 해당하는지 최신 공식 안내에서 직접 확인해야 한다.

공식 기준:

- [SDK Release License](https://www.live2d.com/en/sdk/license/)
- [Expandable Applications](https://www.live2d.com/en/sdk/license/expandable/)
- [Live2D Open Software License](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html)
- [Hiyori 공식 샘플 페이지](https://www.live2d.com/en/learn/sample/momose-hiyori/)
- [Free Material License Agreement](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html)

## 장기 cubism-webgl 백엔드

범용 라이브러리에 공식 Framework 코드를 포함하는 형태는 일반 콘텐츠
출시와 다를 수 있다. Framework `5-r.5`는 WebGL 셰이더 파일도 런타임에
요구하므로 Framework 코드와 셰이더를 npm에 함께 포함할 수 있는지도
Live2D에 서면 확인한다.

- 서면 확인 전에는 gitignored 로컬·비공개 기술 실험만 허용한다.
- Framework·셰이더 재배포가 허용된 경우에만 adapter 전용 dist에 포함한다.
- 허용되지 않으면 사용자에게 비공식 설치 절차를 요구하는 공개 어댑터를
  만들지 않고 cubism-webgl을 비공개 실험으로 남긴다.
- Cubism Core와 모델은 결과와 무관하게 계속 비동봉한다.

구체적인 문의 항목과 공개 게이트는
[cubism-webgl 백엔드 구현 계획](cubism-webgl-plan.md)에 기록한다.

## 립싱크

wlipsync 패키지 코드는 MIT지만 MFCC profile은 별도 데이터다. source
모드는 출처를 확인할 수 없는 AIZUCHI profile을 복사하지 않고 사용자가
profile을 명시적으로 제공하게 한다. Playground에는 저장소가 직접 생성한
synthetic smoke-test fixture만 있으며 npm 패키지에는 포함하지 않는다.

## 상표

이 프로젝트는 Live2D Inc.와 무관한 비공식 프로젝트다. Live2D와 Cubism은
Live2D Inc.의 상표이며 공식 로고나 브랜드 자산을 사용하지 않는다.
