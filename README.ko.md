# live2d-web

[English](README.md) | **한국어** | [日本語](README.ja.md)

> 웹을 위한 Live2D 런타임. 모델 로딩, 모션, 시선 추적, 립싱크를 vanilla
> JavaScript와 React에서 같은 API로 제공합니다. PixiJS에 의존하지 않습니다.

Live2D Inc.와 무관한 비공식 라이브러리입니다. 이 라이브러리로 만든 앱을
배포할 때는 별도의
[Cubism SDK 라이선스](https://www.live2d.com/en/sdk/license/)가 필요할 수
있습니다. [라이선스 문서](docs/licensing.md)를 참고하세요.

**[라이브 데모](https://live2d-web-demo.netlify.app/)** ·
[모델 인스펙터](https://live2d-web-demo.netlify.app/inspect)

## 특징

- 가볍습니다. PixiJS 같은 렌더링 프레임워크 없이 WebGL2로 직접 그리고,
  캐릭터 하나 기준 gzip 약 58KB입니다.
- 캐릭터가 빨리 뜹니다. 실제 GPU에서 첫 화면까지의 시간이 4~6배
  줄었고([측정](docs/benchmarks/2026-08-18-hardware-matrix.md)),
  [프레임 성능은 pixi-live2d-display와
  동등합니다](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md).
- React를 그대로 지원합니다. vanilla API와 같은 기능을 컴포넌트와 훅으로
  쓸 수 있습니다.
- 선택적인 MediaPipe 얼굴 추적은 루트 번들을 무겁게 하지 않으면서 얼굴 방향과
  52개 표정 계수를 표준 또는 Perfect Sync 파라미터에 연결합니다.
- 최신 Cubism 5.3 기준이라 Cubism 4·5 모델을 모두 지원합니다. 업데이트가
  중단된 `pixi-live2d-display` 대신 쓸 수 있습니다.

## 시작하기

```bash
npm install live2d-web
```

패키지에 포함되지 않는 파일 두 가지가 필요합니다.

1. **Cubism Core** (`live2dcubismcore.min.js`). Live2D의 클로즈드 소스
   엔진입니다. https://www.live2d.com/sdk/download/web/ 에서 공식 Web SDK를
   받아 직접 서빙하고 그 URL을 `coreUrl`로 넘깁니다. 테스트 용도로는 Live2D가
   호스팅하는 사본을 가리키는 `OFFICIAL_CUBISM_CORE_URL` 상수를 쓸 수 있고,
   프로덕션에서는 직접 호스팅을 권장합니다.
2. **모델 디렉터리.** `model3.json`이 `.moc3`, 텍스처, 모션, 물리 파일을 상대
   경로로 참조하므로 디렉터리 전체를 정적 파일로 서빙합니다(예:
   `public/models/hiyori/`). `model3.json`의 URL을 `src`로 넘깁니다.

Vanilla:

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  src: '/models/hiyori/hiyori.model3.json',
  fit: 'upper-body',
  followPointer: true,
})
```

React:

```tsx
'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character() {
  return (
    <Live2DCanvas coreUrl="/assets/live2dcubismcore.min.js">
      <Live2DModel src="/models/hiyori/hiyori.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

promise는 캐릭터가 화면에 표시된 뒤 resolve됩니다. 컨테이너에 CSS 크기를 주면
캔버스가 채웁니다.

## 모션과 표정

모션 그룹, 표정, 히트 영역 목록은 `getModelInfo()`로 조회합니다.

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // 그룹 안에서 무작위 선택
await character.motion('Tap@Body', 1) // 인덱스 지정
await character.motion('Idle', 0, { priority: 'normal' }) // 진행 중인 모션을 끊지 않음
await character.motion('Tap@Body', 0, { fadeInMs: 250, fadeOutMs: 400 })
const result = await character.playMotion('Tap@Body')
// { status: 'completed' | 'interrupted' | 'skipped' | 'disposed' }
await character.sequence([
  { group: 'Tap@Body', index: 0 },
  { group: 'Tap@Body', index: 1, options: { fadeInMs: 250 } },
])

await character.expression('smile', { fadeInMs: 250, fadeOutMs: 400 })
character.clearExpression()
```

`motion()`은 재생이 끝나는 시점에 resolve되므로 `await`만으로 순차 연출이
가능하며 기존 `Promise<void>` 계약을 유지합니다. 종료 이유가 필요하면
`playMotion()`을 사용합니다. `sequence()`는 모든 항목을 먼저 검증하고 순서대로
실행하며, 처음으로 정상 완료되지 않은 항목에서 멈춥니다. 렌더·자산 오류는
상태로 바꾸지 않고 reject됩니다.

`fadeInMs`와 `fadeOutMs`는 해당 재생의 모션 전체 페이드만 밀리초 단위로
덮어씁니다. 값은 0 이상의 유한한 수이며 `0`이면 해당 페이드가 즉시
적용됩니다. 생략한 값은 model3/motion3 기본 설정을 유지하고, motion3의
파라미터별 페이드도 그대로 보존됩니다.

기본 움직임은 모델의 `Idle` 그룹이 자동 재생합니다. `idleMotion`으로 다른
그룹을 지정하거나 `false`로 끌 수 있고,
`{ group: 'Idle', weights: [5, 2, 1] }`처럼 가중 랜덤도 설정할 수 있습니다.
weights 길이는 그룹의 모션 수와 같아야 하며 0인 항목은 선택되지 않습니다.
우선순위는 `'idle' | 'normal' | 'force'`이며 기본값 `'force'`는 재생 중인
모션을 중단합니다. 표정 페이드는 모션과 같은 0 이상의 밀리초 규칙을 사용하고,
생략하면 exp3/Framework 기본값을 유지합니다. `clearExpression()`은 기존처럼
즉시 초기화합니다.

## 시선 추적과 탭

`followPointer: true`를 주면 캐릭터가 캔버스 위의 포인터를 따라 보고,
포인터가 벗어나면 시선이 중앙으로 돌아옵니다.

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

시선을 직접 제어하는 메서드는 두 가지입니다. `focusAt()`은 뷰포트 좌표,
`focus()`는 컨테이너 기준 CSS 픽셀을 받습니다.

React에서는 prop 두 개로 처리합니다. 이 prop들은 바뀌어도 모델을 다시
불러오지 않습니다.

```tsx
<Live2DModel
  src="/models/hiyori/hiyori.model3.json"
  followPointer
  onTap={(areas) => {
    if (areas.includes('Body'))
      controller?.motion('Tap@Body')
  }}
/>
```

## 립싱크

립싱크는 세 가지 방식을 지원합니다. 어느 방식이든 SDK의 모션 업데이트 이후에
값을 쓰므로 모션 커브에 덮어써지지 않습니다.

WebAudio 노드(TTS 출력, 마이크)를 wLipSync 모음 분석으로 연결하는 방식.
분석기는 필요할 때 동적으로 로드됩니다.

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // TTS 출력 같은 WebAudio 노드
  profile: '/lipsync/profile.bin', // wLipSync 캘리브레이션 프로파일
  isSpeaking: () => isPlaying,
})
```

마이크처럼 RMS 볼륨을 얻을 수 있는 입력에는 내장 드라이버가 노이즈 기준 보정,
평활화, 발화 히스테리시스를 처리합니다. 캡처, RMS 계산, 프레임 스케줄링은
애플리케이션이 계속 소유합니다.

```ts
import { createVolumeLipSync } from 'live2d-web'

const volume = createVolumeLipSync()
const stopLipSync = character.addLipSync({ driver: volume })

// 캡처 프레임마다 한 번. elapsedMs는 캡처 시작 후 경과 시간입니다.
volume.sample(rms, elapsedMs)
```

`getMouthOpen()`과 `isSpeaking()`을 구현한 사용자 드라이버도 그대로 쓸 수
있습니다.

React 전용으로, 값을 그대로 넘기는 방식.

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

대상 파라미터는 기본 `ParamMouthOpenY`이고 `parameterId`로 변경합니다.
라이브러리는 호출자의 `AudioContext`를 닫거나 중단하지 않으며, 캘리브레이션
프로파일을 포함하지 않습니다. `createVolumeLipSync()` 자체는 React와 WebAudio,
브라우저 전역을 사용하지 않습니다.

## MediaPipe 얼굴 추적

선택 peer를 설치하고 MediaPipe WASM과 Face Landmarker 모델을 직접 호스팅합니다.
`live2d-web` 패키지는 이 자산을 포함하거나 임의의 CDN을 선택하지 않습니다.

```bash
npm install live2d-web @mediapipe/tasks-vision
```

```ts
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'

const tracker = await createMediaPipeFaceTracker({
  wasmPath: '/mediapipe/wasm',
  modelAssetPath: '/mediapipe/face_landmarker.task',
})
const detach = tracker.attach(character, {
  mapping: 'auto',
  channels: { mouth: false }, // 입은 볼륨·오디오 립싱크만 제어
})

function frame(timestamp: number) {
  tracker.update(video, timestamp)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
```

카메라 권한, `getUserMedia`, video, track과 프레임 스케줄링은 앱이 소유합니다.
트래커는 추론, 1초 중립 보정, 평활화와 파라미터 드라이버만 관리합니다. 중립
자세를 다시 잡을 때 `calibrate()`, 정리할 때 `detach()`와 `dispose()`를
호출합니다. `auto`는 52개 Perfect Sync 파라미터가 모두 있으면 직접 매핑하고,
아니면 일반적인 얼굴·눈·눈썹·입·볼 파라미터로 자동 전환합니다.

추론은 기기 안에서 실행되지만 카메라 사용 고지와 MediaPipe 개인정보 안내는
앱 책임입니다. Firefox 로컬 측정이 프레임 예산을 넘어서 첫 버전의 메인
스레드 기본값은 15fps입니다. 다른 상한은 `maxFps`로 명시할 수 있습니다.

## 파라미터 직접 제어

`setParameter()`는 지속 오버라이드입니다. `clearParameter()`를 호출할 때까지
매 프레임 모션 커브보다 우선합니다. 매 프레임 계산하는 값은 드라이버로
등록합니다. SDK 업데이트가 끝날 때마다 라이브러리가 값을 읽습니다.

```ts
character.setParameter('ParamMouthOpenY', 0.6) // 입을 계속 벌려 둠
character.clearParameter('ParamMouthOpenY') // 다시 모션이 제어

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

React에서는 `useLive2DParameter(id, value)`가 오버라이드(언마운트 시 자동
해제), `useParameterDriver(id, getter)`가 드라이버에 해당합니다.

## 화면 구도와 렌더링 품질

`fit`은 모델 파일을 수정하지 않고 화면 구도를 정합니다. `'upper-body'`(기본),
`'full'`, 또는 `{ scale, offsetX, offsetY }`를 지정할 수 있고, 실행 중에는
`setFit()`으로 변경합니다.

렌더링 품질은 기본이 자동입니다. 백킹 버퍼가 `devicePixelRatio`를 따라가되
상한이 있고(모바일 1.5MP, 데스크톱 4MP), 프레임이 길어지면 해상도를 한 단계씩
내립니다. 고정하려면 `resolution`을 지정하고, 프레임 상한은 `maxFps`로
겁니다. 숨겨진 탭과 화면 밖으로 스크롤된 캔버스는 자동으로 멈춥니다.

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // 화면 캡처처럼 계속 그려야 할 때
})
```

## 생명주기와 에러 처리

`getState()`는 `{ status, loadingStage, error, render }`를 반환하고,
`subscribe()`는 상태가 바뀔 때마다 알립니다. 에러에는 안정된 `code`
(`'core-missing'`, `'model-load-failed'`, `'render-error'` 등)와 에셋 정보가
포함됩니다.

```ts
const character = await createLive2D({
  // ...
  onError: error => console.warn(error.code, error.message),
})

const unsubscribe = character.subscribe(() => {
  console.log(character.getState().status) // 'loading' | 'ready' | 'error' | 'disposed'
})

character.pause() // 모달이 열려 있는 동안 등
character.resume()
character.dispose() // 모델·캔버스·GL 컨텍스트 해제. 두 번 불러도 안전합니다
```

HTTP 4xx는 재시도 없이 즉시 실패하고, 일시적인 실패는 기본 2회
재시도합니다(`retries`). WebGL 컨텍스트 손실 같은 렌더 에러 후에는 `retry()`가
스테이지를 다시 만듭니다. 로딩 중단은 `AbortSignal`을 `signal`로 넘깁니다.

## React API 요약

전부 `live2d-web/react`에 있습니다. React는 optional peer(18.2와 19 지원)이고,
루트 임포트에는 React 코드가 없습니다.

| `<Live2DCanvas>` prop                  | 역할                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| `coreUrl`                              | Cubism Core 스크립트 URL (이미 로드했다면 생략 가능) |
| `quality` / `resolution`               | 자동 품질(기본) 또는 고정 백킹 버퍼 배율             |
| `maxFps`, `pauseWhenOffscreen`         | 프레임 상한과 화면 밖 일시정지                       |
| `backend`                              | 렌더러 백엔드. 렌더 간에 같은 값을 유지해야 합니다   |
| `fallback`, `errorFallback`, `onError` | 로딩 UI, 재시도 버튼이 있는 에러 UI, 에러 콜백       |

| `<Live2DModel>` prop                  | 역할                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| `src`, `fit`, `idleMotion`, `retries` | 모델 URL과 로드 시점 옵션                             |
| `resolveAsset`                        | 모델 파일을 fetch 대신 직접 공급                      |
| `followPointer`, `paused`, `onTap`    | 상호작용 토글. 바뀌어도 모델을 다시 불러오지 않습니다 |
| `onLoad`, `onError`                   | 컨트롤러 전달과 에러 콜백                             |

| 훅                               | 역할                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| `useLive2DModel()`               | `onLoad`가 주는 것과 같은 컨트롤러 (모션·표정·포커스·파라미터·모델 정보) |
| `useLive2DCanvas()`              | 스테이지 상태: `status`, `loadingStage`, `error`, 렌더 정보              |
| `useLive2DParameter(id, value)`  | 선언적 파라미터 오버라이드. 정리는 자동입니다                            |
| `useParameterDriver(id, getter)` | 프레임 단위 파라미터 드라이버                                            |
| `useLive2D(options)`             | vanilla 인스턴스를 React 생명주기 안에서 (StrictMode 안전)               |

`<LipSync>`는 세 모드 중 하나만 받습니다: `driver`,
`source`/`active`/`profile`, 또는 `mouthOpen`/`speaking`.

## 백엔드

`backend`를 생략하면 기본인 Framework/WebGL2 백엔드가 로드됩니다. 패키지가
포함하는 백엔드는 이것 하나이며, 셰이더를 직접 호스팅하려면 명시적으로
넘기면 됩니다.

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

Pixi v6 백엔드는 위 벤치마크의 비교 대상으로 저장소에만 있고 발행하지
않습니다. 거의 쓰이지 않을 경로 때문에 모든 설치의 의존성 그래프에 Pixi가
들어가기 때문입니다. `Backend` 인터페이스는 공개되어 있으므로 패키지
바깥에서 직접 구현할 수 있습니다.

## 모델 소스

기본적으로 `src`는 URL이고 모델의 파일들은 그 위치를 기준으로 로드됩니다.
사용자가 방금 고른 압축 파일처럼 모델이 서버에 없을 때는 `resolveAsset`을
넘기면 되고, 그러면 `src`는 그 소스 안의 경로가 됩니다.

```tsx
// 압축 해제·저장소 등에서 채운다
const files = new Map<string, Blob>()

export function Character() {
  return (
    <Live2DModel
      src="hiyori/hiyori.model3.json"
      resolveAsset={path => files.get(path)}
    />
  )
}
```

resolver는 모델이 선언한 파일마다 호출되며, 경로는 `src` 기준으로 이미
해석되고(중첩 디렉터리와 `./`, `../` 포함) 디코드된 상태로 전달됩니다.
그래서 한국어·일본어·중국어로 된 파일명도 그대로 들어옵니다. `undefined`를
돌려주면 그 경로를 알려주며 로드가 실패합니다. model3.json 안의 절대 URL은
그대로 fetch됩니다.

공백과 파일명에 포함된 `%`, `#`, `?`도 그대로 보존됩니다. 신뢰하지 않는 로컬
압축 파일을 열면서 네트워크 요청을 금지하려면 렌더링 전에 model3.json을
검사하세요. 절대 URL은 의도적으로 resolver를 건너뛰고 `fetch`를 사용합니다.

압축 해제는 사용하는 쪽의 몫입니다. resolver를 그냥 함수로 둔 덕분에 이
패키지가 압축 라이브러리에 의존하지 않습니다. React에서는 `useCallback`이나
모듈 상수로 함수 참조를 고정하세요. 참조가 바뀌면 모델을 다시 로드합니다.

## 문제 해결

- 아무것도 안 보이는데 상태는 ready인 경우: 컨테이너에 CSS 크기가 없어
  캔버스가 1x1로 접힌 것입니다. 컨테이너에 너비와 높이를 주세요. 콘솔에
  경고가 출력됩니다.
- 모델이 404인 경우: 모델 디렉터리가 정적 파일로 서빙되는지 확인하세요. 모든
  에셋은 model3.json URL 기준 상대 경로로 로드됩니다.
- 캐릭터 여러 개가 느린 경우: 캔버스마다 WebGL 컨텍스트와 렌더 루프가 생기고,
  브라우저의 컨텍스트 상한은 8~16개 수준입니다. 캔버스 수를 줄이세요.
- 모바일에서 드래그 시 페이지가 스크롤되는 경우: 캔버스에는
  `touch-action: none`이 설정되지만, 스크롤되는 상위 요소에도 필요할 수
  있습니다.

로컬 릴리스 게이트는 최신 Chromium, Firefox, WebKit을 검사합니다. OBS는 별도의
내장 Chromium 환경이므로 현재 하위 제품의 호환 목표를 OBS 31 이상으로 두고,
데스크톱 Chrome 결과로 추정하지 않고 직접 수동 검증합니다.
driver/value 립싱크는 이 브라우저 범위를 지원합니다. 선택적인 wLipSync
AudioWorklet source 모드는 wlipsync 1.3이 Firefox worklet 안에서 오류를 내므로
현재 Chromium/WebKit만 검증합니다.

## 개발

Node 24와 pnpm이 필요합니다.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # 안내되는 약관 확인 후 Core와 샘플 모델 다운로드
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
pnpm verify:packed-consumers             # 실제 tarball을 소비자 3종에 설치
LIVE2D_SOAK_MINUTES=120 pnpm test:soak   # 선택적인 장시간 로컬 게이트
```

내려받은 에셋은 gitignore된 개발 경로에만 저장되며 패키지에 포함되지
않습니다. Playground는 `/`에 React 데모, `/vanilla`에 vanilla API,
`/inspect`에 모델 인스펙터, `/compare`에 WebGL/Pixi 비교 화면을 제공합니다.
벤치마크는 [벤치마크 가이드](docs/benchmarking.md)에 정리되어 있습니다.

## 문서

[문서 지도](docs/README.md)에서 시작하세요. 주요 문서:

- [API reference](docs/api-design.md)
- [아키텍처](docs/architecture.md)
- [라이선스](docs/licensing.md)
- [벤치마크 가이드](docs/benchmarking.md),
  [WebGL vs Pixi v6 결과](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)와
  [실제 GPU 시작 비용](docs/benchmarks/2026-08-18-hardware-matrix.md)

## 라이선스와 상표

프로젝트 자체 코드는 MIT 라이선스입니다. 함께 배포되는 Cubism Web Framework와
셰이더는 Live2D의 라이선스를 따릅니다. 패키지 라이선스 상세와 수정한 Framework
파일 목록은 [LICENSES.md](packages/live2d-web/LICENSES.md)와
[THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md)에
기록되어 있습니다.

이 프로젝트는 비공식 서드파티 프로젝트입니다. Live2D Inc.가 개발하거나
제공하거나 승인한 제품이 아닙니다. Live2D와 Cubism은 Live2D Inc.의 상표입니다.
`live2d-web`은 Cubism Core, 샘플 모델, 립싱크 프로파일을 포함하지 않습니다.

이 라이브러리로 만든 애플리케이션은 그 내용과 릴리스하는 사업자의 규모에 따라
별도의 Live2D Cubism SDK 출판 라이선스가 필요할 수 있습니다.
[Live2D SDK 라이선스 조건](https://www.live2d.com/en/sdk/license/)과
[라이선스 문서](docs/licensing.md)를 참고하세요.
