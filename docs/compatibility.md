# live2d-web 호환성

상태 기준일: **2026-08-25**. 대상은 `develop`의 0.5.0 발행 후보이며, npm의
`0.3.1`에는 MediaPipe 절이 없다. 이 문서는
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
| Cubism 4·5 `model3.json`/`.moc3` | 지원·부분 검증 | 공개 계약은 두 세대다. CI·로컬 e2e는 공식 Hiyori를, smoke는 Mark와 Hiyori를 검증하지만 세대별 독립 fixture matrix는 아직 없다. |
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

## MediaPipe 선택 기능

| 대상 | 상태 | 2026-08-24 실제 검증 |
| --- | --- | --- |
| `@mediapipe/tasks-vision` | `^1.0.1` optional peer | `1.0.1`, CPU delegate와 VIDEO mode |
| Chromium·WebKit·Firefox | 검증 | 공식 portrait로 실제 WASM·Face Landmarker 초기화, 52개 blendshape·변환 행렬, loss·dispose·재생성 |
| 일반 Cubism 표준 파라미터 | 지원·자동 검증 | 합성 결과와 손으로 적은 파라미터 메타데이터로 pose·eye·brow·mouth·cheek 매핑 검증. Perfect Sync는 ARKit 이름 픽스처(50개, `ParamTongueOut` 포함)로 판정·바인딩 검증 |
| Perfect Sync 52 파라미터 | 구현·부분 검증 | 52개 ID와 값 전달은 합성 fixture로 검증. 실제 Perfect Sync 모델의 체감은 미검증 |
| GPU delegate | 미검증 | API로 선택 가능하지만 Live2D WebGL과의 GPU 경합을 측정하지 않아 CPU가 기본이다. |
| 메인 스레드 추론 성능 | 부분 검증 | 모델 없는 페이지 측정(2026-08-25, 적응형 상한): Chromium 30fps 유지(p95 13.4ms), WebKit 20fps로 안착(p95 15ms), Firefox 10fps(p95 197ms, 프레임 100% 초과). 세 엔진 모두 CI 차단 게이트. Worker 검증이 남아 있다. |
| 물리 카메라·모바일 실기 | 미검증 | 권한·장치별 자연스러움은 소비자 검증이 필요하다. |

트래킹 전용 브라우저 게이트는 공식 모델·portrait와 npm 패키지의 WASM을
SHA-256으로 고정해 push·PR CI에서 세 엔진을 브라우저별 잡으로 실행한다. 세
엔진 모두 차단 게이트다. Firefox는 Xvfb 위에서 headed로 돌고 적응형 상한이
10fps로 내려가 통과한다(2026-08-25 러너 실측). Live2D Core와
Hiyori를 요구하지 않으므로 일반 runtime e2e의 자산 제한과 독립적이다.

## 브라우저

2026-08-25 로컬 `pnpm test:e2e`는 Playwright `1.62.0`과 다음 엔진에서
실행했고(32 통과, 7 skip), 같은 명령이 CI `browser-e2e`에서 돈다. 공식 Hiyori와 Core는 약관 동의 후 받은 ignored 로컬 자산이다.

| 엔진 | 실제 버전 | 일반 runtime·driver/value 립싱크 | wLipSync source |
| --- | --- | --- | --- |
| Chromium | `151.0.7922.34` | 검증 | 검증 |
| WebKit | `26.5` | 검증 | 검증 |
| Firefox | `153.0` | 검증. Linux 러너의 헤드리스 Firefox는 WebGL2가 없어(`webgl.force-enabled`도 무효, 2026-08-25) CI에서는 Xvfb 위에서 headed로 실행한다 | 미검증·현재 e2e skip |

기본 e2e는 13개 테스트 × 3엔진 = 39개 조합이고, 그중 7개는 설계상 skip이다
(Chromium 전용인 Hiyori 품질·마이크·MediaPipe 카메라 3건 × WebKit·Firefox,
Firefox wLipSync source 1건). 3엔진 전체 실행은 2026-08-25부터 CI
`browser-e2e`(push)와 릴리스 잡이 담당한다. Firefox에서는 `wlipsync@1.3.0` worklet 오류가 있어 source 모드를
지원 대상으로 승격하지 않았다. driver/value 모드는 AudioWorklet에 의존하지
않아 세 엔진에서 검증한다.

wLipSync source는 브라우저가 `AudioWorklet`을 제공하는 secure context가
필요하다. 로컬 e2e의 `http://127.0.0.1`은 신뢰 가능한 loopback origin으로
취급된다. 마이크를 연결하는 앱은 별도로 HTTPS, 사용자 권한과 브라우저의
`getUserMedia` 정책을 책임진다. 라이브러리는 전달받은 `AudioNode`를 분석하며
마이크 권한 UI를 소유하지 않는다.

Hiyori/Core를 쓰는 일반 runtime e2e는 2026-08-25부터 develop·main push와
릴리스의 자동 게이트다. 두 자산은 Git·Actions cache·artifact에 넣지 않고 매
실행 약관 동의(`LIVE2D_ACCEPT_TERMS=1`)와 함께 공식 배포처에서 새로 받는다.
외부 PR은 자산을 받을 수 없어 병합 뒤 main 결과로 확인한다. MediaPipe 전용
e2e는 모델 없는 정지 초상으로 추론 경로만 검증하므로, 그 결과를 Live2D 모델
렌더링이나 카메라 입력이 CI에서 검증된 것으로 확대해 해석하지 않는다.

OBS 31 이상은 하위 제품의 호환 목표일 뿐 이 기준일에 직접 검증한 브라우저
항목은 아니다. iOS Safari와 Android Chrome 실기기도 아직 미검증이다.
