# 라이선스와 상표

> **English summary**: live2d-web's own code is MIT licensed. The bundled
> Cubism Web Framework and its WebGL shaders remain under Live2D's license;
> every modification is recorded in the package's `THIRD_PARTY_NOTICES.md`.
> Cubism Core, sample models and lip-sync calibration profiles are never
> bundled; users obtain them under Live2D's own terms. This is an unofficial
> project, not developed, provided or endorsed by Live2D Inc. Live2D and
> Cubism are trademarks of Live2D Inc. Releasing an application built with
> this library can require its own Live2D Cubism SDK publishing license,
> depending on the application and the size of the business behind it.

상태 기준일: **2026-08-18**. 이 문서는 법률 자문이 아니라 프로젝트의
배포 경계를 기록한다.

## Live2D 확인 결과 (2026-08-18)

공개 전에 주식회사 Live2D에 사양을 설명하고 회신을 받았다.

- **이 라이브러리 자체에는 출판허락계약이 필요하지 않다.** GitHub과 npm에
  무료 오픈소스로 공개하는 것도 문제없다는 회신을 받았다. 단, 이 판단은
  회신 시점에 설명한 사양을 전제로 한다.
- **이용자 쪽은 별개다.** 이 라이브러리를 써서 제3자 개발자가 애플리케이션이나
  서비스를 제작·릴리스하는 경우, 그 내용과 사업자 규모 등에 따라 별도의
  Live2D Cubism SDK 출판허락계약이 필요할 수 있다. 이 사실을 이용자에게
  안내해달라는 요청을 받았고, README 3종과 npm 표지 상단에 명기했다.
- **비공식 표기.** 공식 제품으로 오인되지 않도록, 비공식 라이브러리라는 점을
  README와 npm 표지 최상단에 명확히 표기한다.

## 프로젝트 코드

- `live2d-web` 자체 코드는 MIT 라이선스다.
- AIRI에서 유래한 통합 패턴과 MIT 하부 프로젝트는
  `THIRD_PARTY_NOTICES.md`에 고지한다.
- root 번들은 React 없이 자체 runtime만 포함하며 wLipSync는 source 모드에서
  동적으로 로드하는 외부 dependency다.
- PIXI와 pixi-live2d-display는 0.2.0부터 발행 패키지의 의존성이 아니다.
  저장소의 벤치마크 전용 devDependency로만 남는다.

## Live2D 자산과 SDK

- Cubism Core와 Hiyori를 비롯한 샘플 모델은 git이나 npm 패키지에 포함하지
  않는다.
- Cubism Framework 5-r.5와 WebGL 셰이더는 현재 정식 백엔드의 vendor
  소스와 백엔드 전용 dist에 포함한다. 원본 헤더, 공식 라이선스,
  프로젝트 수정 목록을 함께 유지한다.
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

## cubism-webgl 백엔드의 Framework 포함

범용 라이브러리에 공식 Framework 코드와 WebGL 셰이더를 포함하는 형태는
일반 콘텐츠 출시와 달라서, 공개 전에 이 포함 형태를 설명하고 Live2D에 서면
확인을 받았다. 결과는 문서 상단의 "Live2D 확인 결과 (2026-08-18)"에
기록되어 있다: 이 라이브러리 자체에는 계약이 필요 없고, GitHub과 npm에
무료 오픈소스로 공개하는 것도 문제없다.

- Framework 5-r.5 소스와 셰이더는 cubism-webgl 백엔드의 vendor 소스와
  백엔드 전용 dist에만 포함하고, 원본 라이선스와 수정 목록을 함께 유지한다.
- Cubism Core와 모델은 계속 비동봉한다.
- 이 확인은 회신 시점에 설명한 사양을 전제로 하므로, 포함 형태가 크게
  바뀌면 다시 확인한다.

## 립싱크

wlipsync 패키지 코드는 MIT지만 MFCC profile은 별도 데이터다. source
모드는 출처를 확인할 수 없는 기존 profile을 복사하지 않고 사용자가
profile을 명시적으로 제공하게 한다. Playground에는 저장소가 직접 생성한
synthetic smoke-test fixture만 있으며 npm 패키지에는 포함하지 않는다.

## 상표

이 프로젝트는 Live2D Inc.와 무관한 비공식 프로젝트다. Live2D와 Cubism은
Live2D Inc.의 상표이며 공식 로고나 브랜드 자산을 사용하지 않는다.
