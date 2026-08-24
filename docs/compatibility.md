# live2d-web 호환성

상태 기준일: **2026-08-24**. 대상 라이브러리 버전은 `0.3.1`이다. 이 문서는
공개적으로 지원한다고 약속한 범위와 현재 저장소에서 실제 검증한 조합을
구분한다.

## 상태 정의

- **지원**: 공개 API와 문서가 호환성을 약속하며, 회귀를 버그로 취급한다.
- **검증**: 아래에 적은 버전과 명령으로 실제 테스트했다. 지원 범위 전체가
  항상 같은 버전이라는 뜻은 아니다.
- **미검증**: 동작할 수 있지만 현재 반복 가능한 테스트가 없어 호환성을
  약속하지 않는다.
- **비지원**: 현재 설계 범위 밖이거나 알려진 비호환 조합이다.

## Core, Framework와 모델

| 대상 | 상태 | 현재 기준과 제한 |
| --- | --- | --- |
| Cubism Core 5.3 (`core/06`) | 지원·검증 | Framework 5-r.5와 공식 Hiyori/샘플 모델로 로드·렌더·정리를 검증한다. Core는 사용자가 공급하며 패키지에 포함하지 않는다. |
| Cubism Web Framework 5-r.5 | 지원·검증 | 저장소에 포함된 기본 WebGL2 backend의 고정 버전이다. |
| Cubism 4·5 `model3.json`/`.moc3` | 지원·부분 검증 | 공개 계약은 두 세대다. 현재 로컬 e2e는 공식 Hiyori를, smoke는 Mark와 Hiyori를 검증하지만 세대별 독립 fixture matrix는 아직 없다. |
| Cubism 3 | 미검증 | Framework의 하위 호환 가능성과 별개로 라이브러리 지원 계약에 포함하지 않았다. |
| Cubism 2.1 `.moc` | 비지원 | 별도 Core와 로더가 필요해 현재 범위 밖이다. |
| Core 5.2 (`core/05`) + Framework 5-r.5 | 비지원 | 실제 Hiyori moc 로드에서 실패하며 Core 사전 검사도 5.3 기능을 요구한다. |
| WebGL2 | 지원·검증 | 기본 backend의 필수 조건이다. 미지원 환경은 `webgl-unsupported` 오류를 반환한다. |
| WebGL1 fallback | 비지원 | 자동 fallback을 제공하지 않는다. |

모델의 모든 세대·Editor 출력·리거 도구 조합을 검증했다는 뜻은 아니다. 새 모델
계열을 지원 표에 추가하려면 재배포 가능한 fixture 또는 합법적으로 공급되는
로컬 자산으로 로드·모션·표정·정리까지 반복 검증해야 한다.

## React와 소비자 빌드

| 대상 | 지원 범위 | 2026-08-24 실제 검증 |
| --- | --- | --- |
| React | `>=18.2 <20` optional peer | React/React DOM `19.2.8` |
| Vanilla Vite | ESM root API | Vite `8.1.5`, 실제 npm tarball 설치·typecheck·production build |
| React Vite | `live2d-web/react` | Vite `8.1.5` + React `19.2.8`, 실제 npm tarball build |
| Next.js SSR | client component에서 `/react` 사용 | Next `16.2.12` + React `19.2.8`, 실제 npm tarball production build |

React 18.2는 공개 peer 범위에 포함되지만 현재 자동 소비자 fixture는 React
19.2.8만 설치한다. React 18.2를 포함한 이중 버전 matrix를 추가하기 전까지
"지원"과 "현재 자동 검증 버전"을 같은 의미로 쓰지 않는다. Vue, Svelte,
Webpack, Rollup 직접 구성은 현재 미검증이다.

## 브라우저

2026-08-24 로컬 `pnpm test:e2e`는 Playwright `1.62.0`과 다음 엔진에서
실행했다. 공식 Hiyori와 Core는 약관 동의 후 받은 ignored 로컬 자산이다.

| 엔진 | 실제 버전 | 일반 runtime·driver/value 립싱크 | wLipSync source |
| --- | --- | --- | --- |
| Chromium | `151.0.7922.34` | 검증 | 검증 |
| WebKit | `26.5` | 검증 | 검증 |
| Firefox | `153.0` | 검증 | 미검증·현재 e2e skip |

전체 결과는 30개 브라우저 조합 중 29개 통과, Firefox wLipSync source 1개
skip이다. Firefox에서는 `wlipsync@1.3.0` worklet 오류가 있어 source 모드를
지원 대상으로 승격하지 않았다. driver/value 모드는 AudioWorklet에 의존하지
않아 세 엔진에서 검증한다.

wLipSync source는 브라우저가 `AudioWorklet`을 제공하는 secure context가
필요하다. 로컬 e2e의 `http://127.0.0.1`은 신뢰 가능한 loopback origin으로
취급된다. 마이크를 연결하는 앱은 별도로 HTTPS, 사용자 권한과 브라우저의
`getUserMedia` 정책을 책임진다. 라이브러리는 전달받은 `AudioNode`를 분석하며
마이크 권한 UI를 소유하지 않는다.

현재 e2e는 로컬 수동 게이트다. CI는 lint·typecheck·unit·package 경계와 실제
tarball 소비자 빌드를 자동화하지만, Hiyori와 Core를 Git·Actions cache·artifact에
넣지 않으므로 실제 자산 브라우저 e2e는 자동 실행하지 않는다. 자산 공급에 대한
별도 확인 또는 자체 소유 fixture를 확보한 뒤 CI 승격 여부를 갱신한다.

OBS 31 이상은 하위 제품의 호환 목표일 뿐 이 기준일에 직접 검증한 브라우저
항목은 아니다. iOS Safari와 Android Chrome 실기기도 아직 미검증이다.
