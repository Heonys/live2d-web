# live2d-web

[English](README.md) | **한국어** | [日本語](README.ja.md)

> 호출 한 번으로 웹에 Live2D 캐릭터를 올립니다. PixiJS 없이, 전역 오염 없이,
> React는 선택 사항입니다.

`live2d-web`은 Live2D 모델의 로딩, 생명주기, 화면 맞춤, 상호작용(탭 히트
테스트, 포인터 추적), 립싱크, 파라미터 드라이버, 렌더 품질, 재시도와 정리를
런타임이 소유합니다. 렌더링은 백엔드 계약 뒤에 있어서, 같은 런타임을 순수
JavaScript에서도 React에서도 쓸 수 있습니다.

라이브 데모: 첫 공개 릴리스와 함께 제공됩니다.

**상태: `0.1.0-alpha.0`은 로컬에서 구현·검증됐지만 아직 npm에 배포되지
않았습니다.** 기본 백엔드는 공식 Cubism Web Framework 5-r.5 렌더러를 WebGL2
위에서 직접 사용합니다. PixiJS v6는 호환·성능 비교용 백엔드로만 남아
있습니다.

## 시작하기

```bash
npm install live2d-web   # 공개 게이트 통과 후 배포됩니다
```

캐릭터 하나를 띄우는 데 필요한 것은 두 가지입니다.

1. **Cubism Core** (`live2dcubismcore.min.js`) — Live2D의 클로즈드 소스
   엔진으로, 의도적으로 번들하지 않습니다. https://www.live2d.com/sdk/download/web/
   에서 공식 Web SDK를 받아 파일을 정적 자산에 두고 그 URL을 `coreUrl`로
   넘기세요. 빠르게 시험해 볼 때는 `OFFICIAL_CUBISM_CORE_URL` 상수(Live2D가
   호스팅하는 사본)를 쓸 수 있습니다. 프로덕션에서는 직접 호스팅을 권장합니다.
2. **모델 디렉터리** — `model3.json`은 `.moc3`, 텍스처, 모션, 물리를 상대
   경로로 참조합니다. 모델 디렉터리를 통째로 서빙하고(예:
   `public/models/hiyori/`) `src`에 `model3.json`의 URL을 넘기세요.

## Vanilla API

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  fit: 'upper-body',
  followPointer: true,
  quality: 'auto',
  src: '/models/hiyori/hiyori.model3.json',
})

// 상호작용: 탭 히트 테스트, 모션 시퀀싱, 모델 메타데이터 조회
container.addEventListener('click', async (event) => {
  if (character.hitTest(event.clientX, event.clientY).includes('Body'))
    await character.motion('Tap@Body') // 재생이 끝나면 resolve됩니다
})
console.log(character.getModelInfo()) // { motions, expressions, hitAreas }

character.setParameter('ParamMouthOpenY', 0.5)
character.clearParameter('ParamMouthOpenY')
character.pause()
character.resume()
character.dispose()
```

`createLive2D()`는 Core, Stage, 모델이 모두 준비된 뒤에만 resolve됩니다.
`expression`/`clearExpression`, `focus`/`focusAt`, `isMotionPlaying`,
`setFit`, `retry`, `addParameterDriver`, `addLipSync`, 상태 구독과 멱등한
정리도 제공합니다. 모션 재생은 `priority`('idle' | 'normal' | 'force')를
받고, idle 그룹은 `idleMotion` 옵션으로 바꾸거나 `false`로 끌 수 있습니다.

## React API

```tsx
'use client'

import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character({ voice }: { voice: AudioNode | null }) {
  return (
    <Live2DCanvas
      // 직접 호스팅한 Core 파일. OFFICIAL_CUBISM_CORE_URL도 사용 가능
      coreUrl="/assets/live2dcubismcore.min.js"
      quality="auto"
    >
      <Live2DModel src="/models/hiyori.model3.json" fit="upper-body">
        <LipSync
          source={voice}
          active={voice !== null}
          profile="/lipsync/profile.bin"
        />
      </Live2DModel>
    </Live2DCanvas>
  )
}
```

React 컴포넌트는 vanilla API와 같은 headless 컨트롤러를 생성·구독합니다.
`Live2DModel.onLoad`와 `useLive2DModel()`은 모션, 표정, 포커스, 파라미터,
모델 정보 메서드만 담은 동일한 안전 컨트롤러를 반환합니다. 프레임 단위
값은 React state를 거치지 않습니다.

`<Live2DModel>`은 `followPointer`, `paused`,
`onTap={(hitAreas, event) => ...}`도 받으며, 이 prop들을 토글해도 모델이
다시 로드되지 않습니다. `<LipSync>`는 안정된 driver 객체가 번거로울 때
순수 값 `mouthOpen`/`speaking`도 받습니다. vanilla 인스턴스를 React에서
직접 다루고 싶다면 `useLive2D({ container, src, ... })`가 전체 생명주기
(StrictMode 안전)를 소유하고 `{ instance, state, error, retry }`를
반환합니다.

## 문제 해결

- **아무것도 안 보이는데 상태는 ready**: 컨테이너에 CSS 크기가 없어 캔버스가
  1x1로 접힌 경우입니다(콘솔 경고가 출력됩니다). 컨테이너에 너비와 높이를
  주세요.
- **모델 404**: 모델 디렉터리가 정적 파일로 서빙되어야 하며, 모든 자산은
  model3.json URL 기준 상대 경로로 로드됩니다. HTTP 4xx는 재시도 없이 즉시
  실패합니다.
- **캐릭터 여러 개가 느림**: 캔버스마다 WebGL 컨텍스트와 렌더 루프를
  소유합니다. 브라우저는 컨텍스트를 8~16개 수준으로 제한하니 캔버스 수를
  적게 유지하세요.
- **모바일에서 캐릭터를 드래그하면 페이지가 스크롤됨**: 캔버스에는
  `touch-action: none`이 설정되지만, 스크롤되는 상위 요소에도 필요할 수
  있습니다.

## 백엔드 선택

`backend`를 생략하면 Framework 기반 WebGL2 백엔드가 선택됩니다. Pixi나
WebGL1로 폴백하지 않습니다.

```ts
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

// 재사용 가능한 기본 WebGL 백엔드 인스턴스
const defaultBackend = cubismWebGL

// 셰이더를 앱 소유 URL에서 서빙해야 할 때만 필요
const customWebGL = createCubismWebGLBackend({
  shaderBaseUrl: '/live2d-shaders/',
})

// 호환/A-B 경로. 선택적 Pixi peer 의존성이 필요
const compatibilityBackend = pixiV6
```

Cubism Core 5.3은 의도적으로 번들하지 않습니다. 공식 브라우저 파일을
`coreUrl`로 공급하거나, 모델 생성 전에 미리 로드하고 `coreUrl`을 생략하세요.

## 패키지 경계

- `live2d-web`: React 없는 vanilla 런타임과 렌더러 중립 계약.
- `live2d-web/react`: 클라이언트 컴포넌트와 훅. React는 optional peer.
- `live2d-web/adapters/cubism-webgl`: Framework 런타임과 셰이더 자산을 담은
  기본 WebGL2 백엔드. Cubism Core는 미포함.
- `live2d-web/adapters/pixi-v6`: `pixi-live2d-display@0.4` 기반 호환/A-B
  백엔드. 모든 Pixi peer는 선택 사항.

자동 품질은 모바일 백킹 버퍼를 1.5MP, 데스크톱을 4MP로 제한합니다. 고정
`resolution`을 주면 자동 강등이 꺼집니다.

## 립싱크

vanilla `addLipSync()`와 React `<LipSync>` 모두 기존 driver 또는 호출자가
소유한 WebAudio `AudioNode`를 받습니다. source 모드는 wLipSync를 동적으로
로드합니다. 패키지는 캘리브레이션 프로파일을 포함하지 않으며, 호출자의
`AudioContext`를 닫거나 중단하지 않습니다.

`ParamMouthOpenY`, 200ms 릴리스, 500ms 입 닫힘 핸드오프는 이 알파 API에서
고정입니다. 최종 파라미터 쓰기는 SDK 모션 업데이트 이후에 일어나며 프레임
단위 React 렌더가 없습니다.

## 개발

Node 24와 pnpm이 필요합니다.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm verify:package
```

벤치마크 스위트(startup, 18조건 matrix, memory, backend A/B, 실기 GPU 실행)는
[벤치마크 가이드](docs/benchmarking.md)에 문서화되어 있습니다.

`LIVE2D_ACCEPT_TERMS=1`은 명령이 안내하는 공식 약관을 확인한 뒤 로컬 개발용
다운로드를 승인하는 플래그입니다. 스크립트는 공식 Cubism 5.3 Core(`core/06`),
Hiyori와 고정된 `CubismWebSamples@5-r.5`의 Mark/Mao/Rice/Ren 리소스를
사용하며, gitignore된 개발 경로에만 기록합니다. 이 자산들은 패키지에 포함되지
않습니다.

Playground는 `/`에 React 데모, `/vanilla`에 vanilla 컨트롤러, `/inspect`에
URL 기반 모델 인스펙터, `/compare`에 WebGL/Pixi A-B 뷰를 제공합니다.
`apps/vanilla-consumer`는 React 의존성이 전혀 없는 별도 Vite 픽스처입니다.

## 문서

[문서 지도](docs/README.md)에서 시작하세요. 주요 문서:

- [API reference](docs/api-design.md)
- [아키텍처](docs/architecture.md)
- [라이선스](docs/licensing.md)
- [벤치마크 가이드](docs/benchmarking.md)와
  [WebGL vs Pixi v6 결과](docs/benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)

## 라이선스와 상표

프로젝트 자체 소스는 MIT 라이선스입니다. 번들된 Cubism Web Framework와
셰이더는 Live2D의 라이선스를 따릅니다. 패키지 라이선스 상세와 수정된
Framework 파일 목록은 [LICENSES.md](packages/live2d-web/LICENSES.md)와
[THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md)에
기록되어 있습니다.

이 프로젝트는 비공식 서드파티 프로젝트이며 Live2D Inc.와 무관하고 승인받지
않았습니다. Live2D와 Cubism은 Live2D Inc.의 상표입니다. `live2d-web`은
Cubism Core, 샘플 모델, 립싱크 프로파일을 번들하지 않습니다. 자세한 경계는
[라이선스 문서](docs/licensing.md)를 참고하세요.
