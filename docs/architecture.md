# 아키텍처

상태 기준일: **2026-08-14**. headless runtime과 React binding이 같은
controller를 사용하며, 공식 Framework 기반 cubism-webgl이 기본 backend다.
pixi-v6는 명시적 비교·호환 backend로 남아 있다.

## 계층과 패키지 경계

```text
바닐라 사용자 ───────────────┐
                             ▼
React /react binding ──→ headless Live2DRuntime
                             ├─ Core 로더
                             ├─ resize / visibility / 품질 / retry
                             ├─ model / feature lifecycle
                             └─ Live2DBackend
                                  ├─ adapters/cubism-webgl (기본)
                                  └─ adapters/pixi-v6 (비교·호환)
```

- `live2d-web` 루트에는 React, `"use client"`, PIXI, Framework가 없다.
- `live2d-web/react`만 React client component를 export한다.
- React와 Pixi 모듈은 optional peer다.
- `apps/vanilla-consumer`는 React dependency 없이 root API를 production
  build하고 실제 브라우저에서 Hiyori를 실행한다.
- 기본 cubism-webgl과 `pixi-live2d-display`, wLipSync runtime은 브라우저
  사용 시점에 동적 import한다.
- 계약은 좌표·크기·파라미터·모션 같은 backend 중립 용어만 사용한다.
- 첫 버전은 Stage당 모델 하나지만 여러 runtime/Canvas 동시 실행은
  허용한다.

## Headless runtime

`createLive2D()`는 `Live2DRuntime`을 생성하고 Core → Stage → model 준비가
끝난 뒤 resolve한다. 초기 실패 시 생성된 자원을 정리하고 reject한다.

runtime이 소유하는 것:

- Core script 요청 dedupe와 오류 정규화
- Stage 생성, ResizeObserver, visibility pause/resume
- 자동 resolution 선택과 한 방향 품질 강등
- AbortSignal, 모델 retry와 stale load 폐기
- fit 재계산, parameter driver와 립싱크 연결
- 기능 → model → Stage의 idempotent dispose
- 저빈도 상태 구독과 전체 Stage retry

React `Live2DStage`는 컨테이너와 설정을 제공하고,
`Live2DModel`은 headless controller를 생성·구독·정리한다. 기존 hooks를 위해
준비된 `ModelHandle`만 내부 context에 연결한다. per-frame 데이터는 React
state로 올리지 않는다.

## Backend 계약

`Live2DBackend`는 `createStage()`와 `loadModel()`만 제공한다.

- `StageHandle`: resize, resolution, 좌표 변환, pause/resume, frame/error
  구독과 dispose
- `ModelHandle`: intrinsic size, transform, parameter, focus, motion,
  expression, after-motion 구독과 dispose

이 경계 덕분에 vanilla/React API와 테스트는 renderer를 몰라도 된다.

## 프레임 순서

고정 계약은 다음과 같다.

```text
motion / expression / eye-blink / physics / look
→ onAfterMotionUpdate
   ├─ LipSync
   └─ parameter drivers
→ model update
→ Stage metrics callbacks
→ draw
```

cubism-webgl은 Stage당 단일 rAF로 이 순서를 실행한다. 수동
`setParameter()` override는 SDK update 뒤 다시 적용되고, 외부 driver와
립싱크가 같은 프레임의 최종값을 덮어쓸 수 있다. pixi-v6에서는 단일
`Application` ticker의 우선순위로 같은 계약을 만든다.

## 렌더 품질

`quality="auto"`가 기본이다.

- 모바일: resolution 상한 1.5, backing buffer 150만 픽셀
- 데스크톱: resolution 상한 2, backing buffer 400만 픽셀
- 최저 resolution 1
- 3초 창에서 33ms 초과 프레임이 5%를 넘으면 0.25 하향
- 같은 Stage 수명에서는 다시 높이지 않음
- ResizeObserver는 rAF당 한 번, 0.5px 미만 변화는 무시
- hidden 시 정지하고 복귀 시 측정 창을 초기화한 뒤 resize/restart

고정 `resolution`은 자동 정책을 끈다. 두 옵션을 같이 주면
`invalid-props`다.

## 립싱크

바닐라 `addLipSync()`와 React `<LipSync>`는 같은 `MouthController` 규칙을
사용한다.

- driver 모드는 매 프레임 getter를 읽는다.
- source 모드는 사용자 AudioNode를 wLipSync 분석 node에 연결한다.
- 사용자 AudioNode/AudioContext 소유권을 가져오지 않는다.
- 말이 끝나면 200ms crossfade, 500ms closed hold 뒤 파라미터 쓰기를
  모션에 돌려준다.
- 실패는 `lipsync-error`로 기능만 중단한다.

## 오류와 정리

- 초기 바닐라 생성 실패는 `Live2DError` reject다.
- 준비 후 backend 오류는 상태 구독과 `onError`에 전달된다.
- context loss는 기존 GPU 상태를 재사용하지 않고 `retry()`로 Stage 전체를
  다시 만든다.
- 모든 비동기 generation은 abort/stale 여부를 확인하고 늦게 도착한
  `ModelHandle`을 즉시 dispose한다.
- 기능 정리가 model보다 먼저, model이 Stage보다 먼저 실행된다.

## cubism-webgl

Framework 5-r.5 + Cubism 5.3 Core(`core/06`) + 공식 Hiyori 조합으로 다음
통합 검증을 통과했다.

- WebGL2 Canvas와 Hiyori idle/physics 렌더
- motion/effect/physics 뒤 `ParamMouthOpenY = 0.5` 최종 쓰기
- 20회 Framework/모델/Canvas/WebGL context 생성·정리
- 마지막 Canvas 하나 외 잔여 Canvas와 브라우저 오류 없음

Core 5.2(`core/05`)는 Framework 5-r.5와 호환되지 않아 moc 로드 중
실패했다. 따라서 로컬 fetch script도 5.3 경로를 고정한다.

Framework 5-r.5의 단일 소스는
`packages/live2d-web/vendor/cubism-web-framework-5-r.5`이고 adapter는
`packages/live2d-web/src/adapters/cubism-webgl`에 있다. Framework는 adapter
전용 동적 chunk에, 13개 셰이더는 embedded source와 배포 asset에 포함된다.
Core와 Hiyori는 ignored 개발 자산으로만 둔다. 공개·npm 배포 전 라이선스
확인은 [라이선스 문서](licensing.md)를 따른다.
