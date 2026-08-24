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

## 오류와 정리

- 초기 바닐라 생성 실패는 `Live2DError` reject다.
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
