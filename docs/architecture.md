# 아키텍처

상태 기준일: **2026-08-24**. headless runtime과 React binding이 같은
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
                                  ├─ backends/cubism-webgl (기본)
                                  └─ backends/pixi-v6 (비교·호환)
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
- Stage 생성, ResizeObserver, visibility/뷰포트 pause/resume
  (pause 사유를 user/hidden/offscreen 집합으로 관리하며, 집합이 빌 때만
  재개한다. `pauseWhenOffscreen`은 기본 true)
- 자동 resolution 선택과 한 방향 품질 강등
- AbortSignal, 모델 retry와 stale load 폐기
- fit 재계산, parameter driver와 립싱크 연결
- client 좌표 → stage 좌표 변환(focusAt/hitTest)과 followPointer 배선
- 기능 → model → Stage의 idempotent dispose
- 저빈도 상태 구독과 전체 Stage retry

React `Live2DCanvas`는 컨테이너와 설정을 제공하고,
`Live2DModel`은 headless runtime을 생성·구독·정리한다. 내부 `ModelHandle`은
renderer 생명주기에만 사용하며 React의 `onLoad`와 hook에는 motion,
expression, focus, parameter만 제공하는 frozen controller를 연결한다.
per-frame 데이터는 React state로 올리지 않는다.

## Backend 계약

`Live2DBackend`는 `createStage()`와 `loadModel()`만 제공한다.

- `StageHandle`: resize, resolution, 좌표 변환, pause/resume, frame/error
  구독과 dispose
- `ModelHandle`: intrinsic size, transform, parameter, focus, hitTest,
  모델 메타데이터(getModelInfo), motion(재생 완료 시 resolve, 우선순위),
  optional 상세 motion capability, expression, after-motion 구독과 dispose

이 경계 덕분에 vanilla/React API와 테스트는 renderer를 몰라도 된다.

## 모션 재생과 페이드 소유권

기본 cubism-webgl backend는 각 모션의 원본 `ArrayBuffer`와 model3 설정까지
반영한 기본 파싱 객체를 함께 캐시한다. 페이드 옵션이 없는 호출은 기본 객체를
재사용한다. `fadeInMs`나 `fadeOutMs`가 있는 호출만 캐시된 버퍼에서 재생 전용
객체를 새로 파싱하고, 전체 모션 페이드만 덮어쓴다. motion3의 파라미터별
페이드는 파싱 결과에 남아 해당 파라미터에서 계속 우선한다.

재생 전용 객체가 큐에 들어가면 Framework의 `autoDelete`가 소유하고 완료·중단
뒤 해제한다. 로드 중 오래된 요청이 되거나 dispose·시작 실패가 발생해 큐에
들어가지 못한 객체만 backend가 직접 한 번 해제한다. 이 분리로 서로 다른
옵션을 연속 호출해도 기본 캐시와 이미 재생 중인 모션을 변경하지 않는다.
pixi-v6 비교 backend는 페이드 옵션을 지원하지 않으며 조용히 무시하지 않고
`invalid-props`를 반환한다.

상세 모션 상태는 Framework queue entry handle별 순수 tracker가 관리한다. 큐에
들어가기 전 priority 거부·stale 요청은 `skipped`, 자연 종료는 `completed`, 새
모션이 기존 entry를 교체하면 fade-out이 실제로 끝난 프레임에 `interrupted`,
모델 정리는 `disposed`로 한 번만 정착한다. 렌더 오류는 기존 계약대로 reject한다.
`motion()`은 이 결과를 버려 종전 `Promise<void>`를 유지하고, 공용 sequence
헬퍼가 모든 step을 먼저 검증한 뒤 상세 capability를 순차 호출한다.

자동 Idle 선택은 renderer와 분리된 순수 선택기가 맡는다. 문자열 그룹은 기존
균등 난수를 사용하고, weights 객체는 모델을 읽은 뒤 모션 개수와 길이를 맞춘
다음 누적 가중치로 인덱스를 고른다. React binding은 group과 weights 값으로
설정을 안정화하므로 같은 inline 객체를 다시 렌더해도 모델을 다시 로드하지
않는다.

표정도 원본 `ArrayBuffer`와 exp3 기본 파싱 객체를 함께 캐시한다. 옵션 없는
호출은 기본 객체를 재사용하고, 페이드 덮어쓰기가 있는 호출만 재생 전용 객체를
파싱해 Framework queue의 `autoDelete`로 소유권을 넘긴다. stale·dispose·시작
실패처럼 queue에 들어가지 못한 객체는 backend가 한 번만 해제한다.

## 프레임 순서

고정 계약은 다음과 같다.

```text
motion
→ scheduler (실행 순서 숫자로 정렬)
   ├─ expression (200) · eye-blink (300) · look (400) · breath (500)
   ├─ onBeforePhysicsUpdate (550) ─ phase: 'before-physics' driver
   ├─ physics (600)
   └─ pose (800)
→ 수동 setParameter override 재적용
→ onAfterMotionUpdate
   ├─ LipSync
   └─ phase: 'after-motion' driver (기본)
→ model update
→ Stage metrics callbacks
→ draw
```

cubism-webgl은 Stage당 단일 rAF로 이 순서를 실행한다. 효과들의 순서는
Framework의 `CubismUpdateOrder` 숫자가 정한다.

파라미터 driver는 두 지점 중 하나에 쓴다. 기본인 `'after-motion'`은 모든
효과와 수동 override보다 뒤라 최종값을 쥐지만, 물리에는 닿지 못한다.
머리 자세처럼 **물리가 반응해야 하는 값**은 `'before-physics'`를 쓴다.
대가로 같은 파라미터의 수동 `setParameter()`가 driver를 이긴다. 트래킹은
pose 채널만 이 단계를 쓰고 나머지는 기본을 유지한다.

pixi-v6는 프레임 루프를 소유하지 않아 `onBeforePhysicsUpdate`를 구현하지
않는다. 그 백엔드에서 `'before-physics'`는 조용히 `'after-motion'`으로
내려간다.

WebGL frame cap은 refresh 간격의 작은 나머지만 보존한다. 초기 shader 준비
같은 긴 main-thread 정지 시간은 다음 프레임 예산으로 이월하지 않아,
복귀 뒤 `maxFps`를 넘는 catch-up burst를 만들지 않는다.

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
- `createVolumeLipSync()`는 호출자가 프레임마다 계산한 RMS를 받아 노이즈 기준
  보정·attack/release 평활화·발화 히스테리시스를 수행하는 순수 driver다.
  WebAudio, 마이크 권한, 타이머를 소유하거나 브라우저 전역을 참조하지 않는다.
- source 모드는 사용자 AudioNode를 wLipSync 분석 node에 연결한다.
- 사용자 AudioNode/AudioContext 소유권을 가져오지 않는다.
- 말이 끝나면 200ms crossfade, 500ms closed hold 뒤 파라미터 쓰기를
  모션에 돌려준다.
- 립싱크·driver의 프레임 쓰기는 transient다(쓰고 즉시 clear). 영구
  override는 사용자 `setParameter()`뿐이며 `clearParameter()`로 해제한다.
- 실패는 `lipsync-error`로 기능만 중단한다.

## MediaPipe 얼굴 추적

`live2d-web/tracking/mediapipe`는 root·React·backend와 분리된 선택 계층이다.
서브패스 자체는 SSR 평가가 가능하고, `createMediaPipeFaceTracker()`가 호출된
브라우저에서만 `@mediapipe/tasks-vision`을 동적으로 불러온다. WASM과
Face Landmarker 모델은 사용자 경로나 버퍼로 받으며 dist에 포함하지 않는다.

앱은 `getUserMedia`·video·track·rAF를 소유한다. 트래커는 `detectForVideo()`의
결과를 좌우 미러 정규화 → **자세 변화율 상한** → 중립 보정 → 시간 기반
평활화 → **채널 감도** → 모델 범위 변환 순서로 처리하고, 결과를 기존
`addParameterDriver()` 집합으로 붙인다. React controller는 같은 driver 등록
기능만 위임하며 추적 전용 상태를 소유하지 않는다.

변화율 상한은 초당 360도다. 얼굴이 화면을 벗어나는 경계에서 자세 추정이
무너지며 한 프레임 만에 파라미터 끝까지 튀는 것을 막는다. 넘는 프레임은
버리지 않고 상한만큼만 이동시켜 빠른 회전 자체는 통과시킨다. 보정 구간에는
적용하지 않는다. 기준점이 아직 없기 때문이다.

pose 채널은 `'before-physics'` 단계에 쓴다. 물리가 트래킹된 고개에 반응해야
머리카락과 몸이 따라오기 때문이다. 나머지 채널은 기본 단계를 유지하는데,
그래야 추적된 눈 깜빡임이 자동 eye-blink를 이긴다.

얼굴을 놓쳤을 때 기본 동작은 마지막 자세 **유지**다. 잠깐 시선을 돌렸다고
캐릭터가 정면으로 튕기면 방송에서 쓸 수 없다. `onFaceLost: 'neutral'`을
고르면 1초 유지 뒤 0.8초에 걸쳐 모델 기본값으로 돌아간다.

내장 backend는 `ModelInfo.parameters`에 ID·최소·최대·기본값을 제공한다.
필드는 optional이라 기존 custom backend는 깨지지 않는다. 메타데이터가 없으면
표준 Cubism 범위를 사용하며, Perfect Sync 자동 매핑은 ARKit 52개 이름 중 45개
이상이 있을 때 켜고 모델이 가진 것만 바인딩한다(`_neutral`은 파라미터가
아니고 `ParamTongueOut`은 MediaPipe 출력이 없어 기본값 유지). 트래커 하나는 여러 모델에 붙을 수 있고, 각 detach와 전체
dispose는 driver를 먼저 제거한 뒤 MediaPipe task를 한 번만 닫는다.

MediaPipe의 동기 추론이 메인 스레드를 막을 수 있다. 2026-08-24 reference
Chromium은 inference p95 14.4ms와 33ms 초과 프레임 0.16%였지만 Firefox
headless는 p95 202ms로 임계값을 넘었다. 고정 상한 하나로는 둘을 함께 만족할
수 없어 상한을 **적응형**으로 둔다: 30fps로 시작하고, 추론 시간 EMA가 간격의
60%를 넘으면 절반으로(최저 10fps), 25% 아래로 내려오면 다시 두 배로 올린다.
`update()`가 `effectiveFps`로 현재 상한을 알린다. Worker는 Firefox·저성능
장치의 렌더 스레드를 보호하는 다음 성능 작업으로 남긴다.

## 오류와 정리

- 초기 바닐라 생성 실패는 `Live2DError` reject다.
- MediaPipe 초기화·추론 실패는 `tracking-error`이며 Live2D Stage는 유지한다.
- 준비 후 backend 오류는 상태 구독과 `onError`에 전달된다.
- `Live2DError.details`는 자산 종류, backend, 최종 URL과 가능한 HTTP 상태를
  보존한다. 원래 예외는 `cause`에 유지한다.
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

로드 경로 최적화(2026-08-18): 텍스처 fetch/decode는 동기 셰이더 컴파일 시작
전에 병렬로 킥오프해 컴파일 시간과 겹치고, GL 업로드만 셰이더 완료 후 순차로
한다. blend 모드를 쓰지 않는 모델은 blend 셰이더 프로그램 237개 생성을
생략한다(요청 시 증분 등록). ready 후 Idle 모션 그룹을 백그라운드에서
프리페치해 로드 직후 무모션 구간을 없앤다. 렌더 루프에서는 정적 인덱스/UV
버퍼 캐시, 프로그램 리바인드 중복 제거, 마스크 setup의 프레임당 동기
FBO 조회 제거를 적용했다. vendor 수정 목록은 패키지 THIRD_PARTY_NOTICES.md에
기록한다.

Framework 5-r.5의 단일 소스는
`packages/live2d-web/vendor/cubism-web-framework-5-r.5`이고 백엔드는
`packages/live2d-web/src/backends/cubism-webgl`에 있다. Framework는 백엔드
전용 동적 chunk에, 13개 셰이더는 embedded source와 배포 asset에 포함된다.
Core와 Hiyori는 ignored 개발 자산으로만 둔다. 포함 형태에 대한 Live2D 확인
결과는 [라이선스 문서](licensing.md)에 있다.
