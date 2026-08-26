# live2d-web 호환성

상태 기준일: **2026-08-26**. 대상은 발행된 `0.5.0`과 `develop`의 통합 0.6.0
후보다. 이 문서는
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

| 대상 | 지원 범위 | 현재 실제 검증 |
| --- | --- | --- |
| React | `>=18.2 <20` optional peer | React/React DOM `19.2.8` |
| Vanilla Vite | ESM root API | Vite `8.1.5`, 실제 npm tarball 설치·typecheck·production build |
| React Vite | `live2d-web/react` | Vite `8.1.5` + React `19.2.8`, 실제 npm tarball build |
| Next.js SSR | client component에서 `/react` 사용 | Next `16.2.12` + React `19.2.8`, 실제 npm tarball production build |
| Vue Vite | 별도 binding 없이 ESM root API | Vue `3.5.21` + Vite `8.1.5`, workspace 예제 typecheck·production build |
| OBS Browser Source | 투명 Vite overlay, query 기반 model/fit | workspace 예제 typecheck·production build. OBS 자체 실기 구동은 미검증 |
| 모델 검사 | `live2d-web/inspect`, URL·resolver | 실제 tarball Vite import·Node SSR 평가, URL/zip은 세 브라우저 Playwright 검증 |

React 18.2는 공개 peer 범위에 포함되지만 현재 자동 소비자 fixture는 React
19.2.8만 설치한다. React 18.2를 포함한 이중 버전 matrix를 추가하기 전까지
"지원"과 "현재 자동 검증 버전"을 같은 의미로 쓰지 않는다. Vue, Svelte,
Webpack, Rollup 직접 구성 중 Vue만 위의 root API 예제로 검증했으며 Svelte와
Webpack/Rollup 직접 구성은 현재 미검증이다.

## 모델 검사와 문서 사이트

`live2d-web/inspect`는 Chromium·WebKit·Firefox에서 같은-origin Hiyori URL,
실제 Hiyori zip, 누락 URL, 외부 URL을 선언한 로컬 archive와 Canvas 정리를
검증한다. zip은 UTF-8·GBK 파일명, macOS metadata, 다중 model3, 정규화 중복,
경로 탈출과 압축 한도를 단위 테스트로 고정한다. 실제 Inspector의 JSZip은
Playground에서만 동적 로드되며 npm `inspect` entry에는 포함되지 않는다.

`/docs/{en|ko|ja}` 45개 경로는 같은 15개 slug 집합에서 정적 생성된다. 세
브라우저가 `/docs` redirect, 검색, 언어 전환, code copy, canonical/hreflang,
TypeDoc API와 내부 링크 응답을 검증한다. 문서 내용의 사람이 느끼는 명확성과
"10분 안에 모델 표시"는 자동 테스트가 아니라 외부 사용자 확인 항목이다.

`live2d-web/devtools`는 Chromium·WebKit·Firefox의 open Shadow DOM에서
SSR evaluation, parameter driver 격리·정리, motion/sequence/expression 호출,
target 교체와 반복 dispose를 검증한다. 위치·크기·scroll은 소비자가 제공한다.

## MediaPipe 선택 기능

| 대상 | 상태 | 현재 실제 검증 |
| --- | --- | --- |
| `@mediapipe/tasks-vision` | `^1.0.1` optional peer | `1.0.1`, CPU delegate와 VIDEO mode |
| Chromium·WebKit | main·Worker 기능 검증 | 공식 portrait로 실제 WASM·Face Landmarker 초기화, 52개 blendshape·변환 행렬, loss·dispose·재생성. WebKit 자동 게이트는 실제 Safari 계열에 가까운 macOS Playwright 러너를 사용한다. |
| Firefox | main 성능 미충족 · Worker 기능 검증 | main 추론은 ~190ms라 실사용 비권장. 같은 portrait를 Worker에서 추론하는 기능·생명주기는 2026-08-25 통과했으며 성능 수치는 별도 benchmark로 관리 |
| 일반 Cubism 표준 파라미터 | 지원·자동 검증 | 합성 결과와 손으로 적은 파라미터 메타데이터로 pose·eye·brow·mouth·cheek 매핑 검증. Perfect Sync는 ARKit 이름 픽스처(50개, `ParamTongueOut` 포함)로 판정·바인딩 검증 |
| Perfect Sync 52 파라미터 | 구현·부분 검증 | 52개 ID와 값 전달은 합성 fixture로 검증. 실제 Perfect Sync 모델의 체감은 미검증 |
| GPU delegate | 미검증 | API로 선택 가능하지만 Live2D WebGL과의 GPU 경합을 측정하지 않아 CPU가 기본이다. |
| 추론 성능 | 데스크톱 검증 | Hiyori 동시 렌더 3회 중앙값에서 Worker frame p95는 Chromium 10ms, WebKit 18ms, Firefox 9.8ms이고 33ms 초과는 모두 0%. Firefox main의 191.6ms/100% 초과를 렌더 스레드에서 분리. 08-26에 worker 모드의 적응형 상한 하향을 제거한 재측정에서도 33ms 초과 0%가 유지되고(skip: Chromium 75%, WebKit 52.5%, Firefox 95.7%. Firefox는 추론 ~193ms의 본질적 배압), 상세는 벤치 문서의 08-26 절. [상세 측정](benchmarks/2026-08-25-0.6-worker-tracking.md) |
| Worker 안정성 | 데스크톱 검증 | Chromium 15분 soak에서 두 차례 재생성, pending 요청 정착, 최종 dispose, console/page error와 heap 증가 한계를 통과(2026-08-25) |
| 물리 카메라 | **부분 검증** | 2026-08-25 실측에서 세 결함을 찾아 고쳤다. 얼굴을 너무 일찍 놓침(임계값 기본 0.5), 놓치면 0.55초 만에 정면 복귀, 경계 프레임의 자세 튐. 여기에 물리보다 뒤에 적용되어 머리카락이 따라오지 않던 문제까지 넷이다. |
| 모바일 실기 | **미검증·0.7 안정화 후보** | iOS Safari·Android Chrome 실기기 각 5분과 실제 전면 카메라 지표가 필요하다. 자동화·데스크톱 수치로 대체하지 않으며, 0.6.0에는 이 제한을 명시해 발행한다. |
| 감도 기본값 | 1대 측정 | `sensitivity.pose` 기본은 **3**이다. 2026-08-25에 눈높이보다 낮은 노트북 카메라 한 대에서 자연스럽게 느껴진 값이며, 표본이 하나다. 카메라 위치에 좌우되므로 소비자는 사용자에게 노출하는 편이 낫다. |

트래킹 전용 브라우저 게이트는 공식 모델·portrait와 npm 패키지의 WASM을
SHA-256으로 고정해 push·PR CI에서 세 엔진을 브라우저별 잡으로 실행한다.
Chromium·Firefox는 Linux, WebKit은 macOS 러너에서 실행한다. Linux의 Playwright
WebKitGTK는 Next 16 Turbopack이 만든 classic Worker 안에서 MediaPipe WASM
초기화가 끝나지 않는 조합이라 Safari 호환성의 대리 게이트로 사용하지 않는다.
세 엔진 모두 차단 게이트이고, 릴리스 잡도 태그 커밋에 같은 스위트를 다시 돌린다. Firefox는 Xvfb 위에서 headed로 돌고 적응형 상한이
10fps로 내려가 통과한다(2026-08-25 러너 실측). Live2D Core와
Hiyori를 요구하지 않으므로 일반 runtime e2e의 자산 제한과 독립적이다.

이 게이트는 **정지 초상 한 장**을 쓴다. 각도의 부호나 크기, 얼굴을 놓치는
경계, 자세 유지는 하나도 검증하지 못한다. 2026-08-25에 발견한 결함 셋이 전부
이 사각지대에 있었다. 부호와 스케일은 합성 행렬 단위 테스트로 잠갔지만
(`state.test.ts`), 나머지는 실제 카메라 확인이 계속 필요하다.

MediaPipe의 WASM 런타임은 시작 시 `INFO: Created TensorFlow Lite XNNPACK
delegate for CPU.`를 `console.error`로 내보낸다. 정보성 로그이므로 콘솔 에러를
단언하는 테스트는 이 줄을 걸러야 한다.

## 브라우저

2026-08-25 로컬 `pnpm test:e2e`는 Playwright `1.62.0`과 다음 엔진에서
실행했고(44 통과, 7 skip), 같은 명령이 CI `browser-e2e`에서 돈다. 공식
Hiyori와 Core는 약관 동의 후 받은 ignored 로컬 자산이다.

| 엔진 | 실제 버전 | 일반 runtime·driver/value 립싱크 | wLipSync source |
| --- | --- | --- | --- |
| Chromium | `151.0.7922.34` | 검증 | 검증 |
| WebKit | `26.5` | 검증 | 검증 |
| Firefox | `153.0` | 검증. Linux 러너의 헤드리스 Firefox는 WebGL2가 없어(`webgl.force-enabled`도 무효, 2026-08-25) CI에서는 Xvfb 위에서 headed로 실행한다 | 미검증·현재 e2e skip |

기본 e2e는 17개 테스트 × 3엔진 = 51개 조합이고, 그중 7개는 설계상 skip이다
(Chromium 전용인 Hiyori 품질·마이크·MediaPipe 카메라 3건 × WebKit·Firefox,
Firefox wLipSync source 1건). 3엔진 전체 실행은 2026-08-25부터 CI
`browser-e2e`(push)와 릴리스 잡이 담당한다. Firefox에서는 `wlipsync@1.3.0`
worklet 오류가 있어 source 모드를 지원 대상으로 승격하지 않았다. driver/value 모드는 AudioWorklet에 의존하지
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
