# live2d-web 호환성

기준 버전: **0.9.0**. 이 문서는 공개적으로 지원한다고 약속하는 범위와 알려진
제한만 적는다. 사용 방법과 문제 해결은 [문서 사이트](https://live2d-web.heonys.dev/docs/ko)에 있다.

- **지원**: 공개 API와 문서가 호환성을 약속하며, 회귀를 버그로 취급한다.
- **미검증**: 동작할 수 있지만 반복 가능한 테스트가 없어 약속하지 않는다.
- **비지원**: 설계 범위 밖이거나 알려진 비호환 조합이다.

## Core, Framework와 모델

| 대상 | 상태 | 비고 |
| --- | --- | --- |
| Cubism Core 5.3 (`core/06`) | 지원 | 사용자가 공급한다. 패키지에 포함하지 않는다. |
| Cubism Web Framework 5-r.5 | 지원 | 기본 WebGL2 backend의 고정 버전이다. |
| `.moc3` v1~v6 (Cubism 3.0~5.3) | 지원 | 공식 샘플 5종에서 계보 전 구간을 확인한다. Hiyori가 v1, Mark·Rice가 v3, Mao가 v5, Ren이 v6이다. |
| `model3.json` v3 | 지원 | 위 5종이 모두 v3이다. |
| `model3.json` v1·v2와 그 시절 모션·물리 형식 | 미검증 | Cubism 3 시절 출력에 있을 수 있다. 재출력하면 v3이 된다. |
| Cubism 2.1 `.moc` | 비지원 | 별도 Core와 로더가 필요하다. |
| Core 5.2 (`core/05`) + Framework 5-r.5 | 비지원 | moc 로드에서 실패한다. |
| WebGL2 | 지원 | 필수 조건이다. 없으면 `webgl-unsupported`를 반환한다. |
| WebGL1 fallback | 비지원 | 자동 fallback을 제공하지 않는다. |

## 브라우저

| 엔진 | 상태 | 비고 |
| --- | --- | --- |
| Chromium | 지원 | |
| WebKit · iOS Safari | 지원 | |
| Firefox | 지원 | wLipSync **source** 모드는 미검증이다(worklet 오류). driver·value 모드는 지원한다. |
| OBS Browser Source | 미검증 | 하위 제품의 호환 목표이며 이 저장소가 직접 검증하지 않는다. |
| Android Chrome | 미검증 | 동작할 수 있으나 지원 근거로 사용하지 않는다. |

## React와 번들러

| 대상 | 지원 범위 |
| --- | --- |
| React | `>=18.2 <20` optional peer. 18.2와 19 모두 실제 tarball로 빌드 검증한다. |
| Vite (Vanilla · React · Vue) | root API와 `/react` 모두 지원한다. |
| Next.js | client component에서 `/react`를 사용한다. |
| Svelte · Webpack/Rollup 직접 구성 | 미검증 |

## Canvas 접근성

접근성 의미는 **소비자가 `accessibility`를 줄 때만** 붙는다. 옵션이 없으면
canvas에 아무 속성도 넣지 않는다. canvas를 focusable로 만들지 않으며
`prefers-reduced-motion` 처리는 라이브러리가 하지 않는다. 모션 재생 여부는
소비자가 결정한다.

## MediaPipe 얼굴 추적 (실험적)

`@mediapipe/tasks-vision` `^1.0.1`을 optional peer로 사용한다. WASM과
Face Landmarker 모델은 **애플리케이션이 직접 호스팅한다.** 기본 CDN은 없다.

알려진 제한은 다음과 같다.

- **iOS의 Chrome 앱과 Google 앱에서 Worker 모드가 실패한다.** MediaPipe 1.0.1이
  WASM을 받는 도중 `document`를 참조하는데 워커에는 없다. 라이브러리가 고칠 수
  없으므로 그 실패를 `execution: 'main'`으로 전환하라는 문구가 포함된 오류로
  바꿔 전달한다. 조용한 fallback은 제공하지 않는다. 실행 모드는 애플리케이션의
  선택이다. Safari 본체에서는 두 모드 모두 동작한다.
- **Firefox는 main 모드 추론이 느려 실사용을 권하지 않는다.** Worker 모드를 쓴다.
- **GPU delegate는 미검증이다.** Live2D WebGL과의 경합을 측정하지 않아 CPU가
  기본이다.
- **Perfect Sync는 부분 검증이다.** ARKit 52개 이름 중 45개 이상을 선언한 모델을
  자동 매핑하며 모델이 가진 파라미터만 바인딩한다. `ParamTongueOut`은 MediaPipe에
  대응 신호가 없어 기본값을 유지한다.
- **리그마다 파라미터 범위가 다르다.** 트래킹은 중립을 `minimum`이 아니라
  `defaultValue`로 읽는다. 공식 샘플 중에도 `ParamEyeLOpen` 최대값을 1.0 초과로
  선언하는 리그가 있다. 여유가 기본값 한쪽에만 있는 채널은 그 리그에서 움직이지
  않는다.
- **감도는 카메라 위치에 좌우된다.** `sensitivity.pose`와 `sensitivity.eyes`를
  최종 사용자에게 노출하는 편이 낫다.

## 화면에 맞추기

`fit`에 따라 모델을 화면에 놓는 방식이 다릅니다.

| 값 | 동작 | 언제 |
| --- | --- | --- |
| `full` | 모델 전체가 화면에 들어가게 맞춥니다 | **어느 리그에서나 안전합니다** |
| `upper-body` | 두 배로 확대하고 아래를 기준으로 놓습니다 | 캐릭터가 캔버스 세로를 채우는 전신 리그 |
| `{ scale, offsetX, offsetY }` | `upper-body`를 기준으로 직접 조정합니다 | 위 둘이 안 맞을 때 |
| `{ ..., units: 'stage' }` | 오프셋을 화면 비율로 읽습니다 | **창 크기가 바뀌는 화면** |

오프셋의 기본 단위는 픽셀이고, **잰 크기에 고정됩니다.** 레이아웃은 리사이즈마다
같은 값으로 다시 계산하므로, 한 창에서 찾은 배치가 다른 창에서는 어긋납니다.
`units: 'stage'`는 오프셋을 화면 비율로 읽어 크기가 바뀌어도 유지합니다.

값은 직접 찾습니다. `debug`를 켜면 캔버스 위에 배치 오버레이가 붙고, 드래그와
스크롤로 맞춘 `fit`을 복사해 코드에 붙여넣습니다. 오버레이는 화면 비율로 씁니다.

**`upper-body`는 전신 리그를 가정합니다.** 모델 파일에는 캔버스 크기만 있고
그 안 어디에 캐릭터가 그려졌는지는 없습니다. 이미 상반신만 그려진 리그에서는
두 배 확대가 화면을 넘고, 캔버스 중앙에서 벗어나 그려진 리그는 한쪽으로
치우쳐 보입니다. 공식 샘플 중에도 그런 리그가 있습니다.

맞지 않으면 `full`을 쓰거나 `{ scale, offsetX, offsetY }`로 직접 값을 주세요.

## 한 캔버스에 여러 모델

`addModel()`과 `<Live2DCanvas>` 아래의 여러 `<Live2DModel>`을 지원한다. 모델마다
자신의 `fit`, 모션, 표정, 파라미터, 히트 영역, 립싱크, 트래킹을 갖고, 하나를
정리해도 캔버스와 나머지는 영향을 받지 않는다.

| 대상 | 상태 | 비고 |
| --- | --- | --- |
| 한 캔버스에 여러 모델 | 지원 | WebGL 컨텍스트 하나를 함께 쓴다. |
| 그리는 순서 | 지원 | 추가한 순서다. 나중에 넣은 모델이 위에 온다. |
| 명시적 z-index | 비지원 | 순서를 바꾸려면 다시 추가한다. |
| 배치 오버레이(`debug`) | 지원 | **한 번에 한 모델이다.** 켜면 그 모델로 옮겨가고 경고를 남긴다. |
| 모델 단위 일시정지 | 비지원 | `paused`는 캔버스 단위다. 프레임 루프가 캔버스에 하나뿐이다. |

## 립싱크

wLipSync **source** 모드는 브라우저가 `AudioWorklet`을 제공하는 secure context가
필요하다. 라이브러리는 전달받은 `AudioNode`를 분석할 뿐 마이크 권한 UI나
`AudioContext` 소유권을 갖지 않는다. driver·value 모드는 AudioWorklet에 의존하지
않는다.
