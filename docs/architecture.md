# 아키텍처

상태 기준일: **2026-07-30**. v0.1 코어와 pixi-v6 어댑터에 이어 v0.2
립싱크 API가 구현돼 있으며 npm 공개 전 alpha 검증 단계다.

## 계층과 경계

```text
사용자 JSX
  └─ React 코어
       ├─ Stage/Model Context와 생명주기
       ├─ 품질·프레이밍·에러 계약
       └─ Live2DBackend
            └─ adapters/pixi-v6
                 ├─ PIXI v6
                 └─ pixi-live2d-display 0.4
```

- 루트 진입점에는 PIXI import가 없다.
- PIXI 의존성은 adapter subpath의 optional peer dependency다.
- 계약은 좌표·크기·파라미터·모션 같은 백엔드 중립 용어만 사용한다.
- v0.x는 일반 React 컴포넌트와 Context를 사용하며 custom reconciler를
  만들지 않는다.
- v0.1은 Stage당 모델 하나만 지원한다.

## 프레임 계약 결정 (2026-07-30)

프레임 순서는 다음으로 고정한다.

```text
PIXI app ticker
  HIGH    model.update()
          └─ internalModel.afterMotionUpdate
               ├─ LipSync mouth controller
               └─ useParameterDriver callbacks
  NORMAL  Stage onFrame callbacks / 품질 측정
  LOW     guarded app.render()
```

AIZUCHI에서는 `motionManager.update` 패치를 사용했지만,
`pixi-live2d-display@0.4`가 공개한 `afterMotionUpdate` 이벤트가 같은 위치를
제공한다는 것을 실제 Hiyori로 확인했다. 따라서 v0.1 어댑터는 몽키패치를
사용하지 않는다. 이 이벤트가 사라지는 하부 버전은 같은 어댑터 범위로
업그레이드하지 않고 별도 어댑터로 다룬다.

모델은 `autoUpdate:false`이며 `Ticker.shared`나 별도 상시 rAF를 사용하지
않는다. Ticker 클래스 등록은 하부 라이브러리의 전역 `window.PIXI` 감지를
막기 위한 것이고 자동 업데이트를 켜지 않는다.

## React 생명주기 결정 (2026-07-30)

- StageStore와 ModelStore는 `useSyncExternalStore`로 저빈도 상태만 전달한다.
- per-frame 값은 getter로 직접 읽으며 React state로 올리지 않는다.
- 모델 기능은 `LifecycleScope`에 등록되고 LIFO로 정리된다.
- Stage는 현재 모델 리소스를 직접 보유해 React effect 정리 순서와 무관하게
  `기능 → 모델 → Stage`를 보장한다.
- 모든 정리 함수는 idempotent다.
- 모든 모델 로드는 AbortSignal과 generation 검사를 거친다.
- 렌더 오류와 context loss는 티커를 정지하고 전체 Stage retry로 복구한다.

React StrictMode의 effect 재실행, 로딩 중 unmount, 빠른 세대 교체는 jsdom
테스트와 실제 브라우저 반복 마운트로 검증한다.

## 립싱크 결정 (2026-07-30)

`<LipSync>`는 source와 driver 두 입력 경계를 제공하지만 같은 순수 mouth
controller를 사용한다.

```text
source: 사용자 AudioNode → 동적 로드한 wLipSync AudioWorklet → mouth getter
driver: 사용자 분석기 → mouth getter
                           ↓
             afterMotionUpdate → ParamMouthOpenY
```

- 말하는 동안 0–1 입 값을 모션 이후에 덮어쓴다.
- 종료 후 200ms 동안 마지막 값에서 해당 프레임 모션 값으로 smoothstep
  crossfade하고, 500ms 동안 0을 유지한 뒤 쓰기를 멈춘다.
- source 모드는 모음 가중치·볼륨으로 입 값을 계산하고 50ms 간격으로
  갱신·스무딩한다.
- `active`는 발화 경계일 뿐 분석 노드의 연결 여부가 아니다.
- AudioNode와 AudioContext의 소유권은 사용자에게 있다. 기능 정리에서는
  `source.disconnect(lipsyncNode)`, 분석 노드 disconnect와 port close만 한다.
- source/profile 변경은 세대를 교체하며 늦게 끝난 분석 노드를 즉시
  정리한다.
- wLipSync는 브라우저 effect에서 메인 export를 동적 import한다. profile,
  WASM과 AudioWorklet 파일을 프로젝트가 별도로 동봉하지 않는다.
- 초기화 또는 getter 실패는 `lipsync-error`로 한 번 보고하고 립싱크만
  중단한다. 모델과 Stage는 ready 상태를 유지한다.

## 렌더 품질 결정 (2026-07-30)

`quality="auto"`가 기본이다.

- 모바일: 해상도 상한 1.5, 버퍼 예산 150만 픽셀
- 데스크톱: 해상도 상한 2, 버퍼 예산 400만 픽셀
- 최저 해상도 1
- 3초 창에서 33ms 초과 프레임 비율이 5%를 넘으면 0.25 하향
- 같은 Stage 수명에서는 다시 높이지 않음
- `preserveDrawingBuffer:false`
- ResizeObserver는 rAF당 한 번, 0.5px 미만 변화는 무시
- hidden 시 ticker 정지, 복귀 시 resize 후 재개

`resolution`을 직접 주면 자동 품질을 끈다.

## 장기 WebGL 백엔드 결정 (2026-07-30)

장기 “native”는 모바일 네이티브 앱이 아니라 공식 Cubism Web Framework의
`CubismRenderer_WebGL`을 직접 감싸는 브라우저 백엔드를 뜻한다.

- React API와 conformance 요구사항은 그대로 유지한다.
- Core 위에 렌더러를 새로 작성하지 않는다.
- 공식 Framework를 포함한 범용 모델 로더의 배포 조건을 Live2D에 서면
  확인하기 전에는 구현물을 npm에 공개하지 않는다.
- v0.x 수요가 확인되기 전에는 착수하지 않는다.
