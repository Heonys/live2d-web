# live2d-web 로드맵

상태 기준일: **2026-08-26**. 현재 발행 버전은 `0.6.0`이다. Worker,
문서·검사·Devtools와 리뷰 보완은 한 릴리스로 발행됐고, `develop`은 다음 0.7
안정화 범위를 진행한다. 지나온 마일스톤은 `private/docs/roadmap.md`에 이력으로
남아 있고, 이 문서는 앞으로의 방향만 다룬다.

## 목표

**브라우저에서 Live2D를 다룰 때의 기본 선택지가 된다.** 지금의 사실상 표준인
`pixi-live2d-display`는 2023-12 이후 갱신이 없는데도 주간 1.2만 다운로드를
유지하고(2026-08-19 측정, `private/docs/ecosystem-survey.md`), 그 자리를
물려받을 라이브러리가 없다. 한 사람이 쓰는 도구가 아니라
많은 사람이 의존하는 기반이 되는 것이 목표다.

그 목표는 기능 수로 달성되지 않는다. 다음 세 가지를 동시에 만족해야 한다.

1. **깨지지 않는다.** 공개 계약이 안정적이고, 릴리스마다 실제 tarball로
   검증된다.
2. **실전에서 단련됐다.** 모든 기능이 실제 소비자의 요구에서 나왔고 그
   소비자 안에서 굴러간 흔적이 있다.
3. **설명할 수 있다.** 처음 보는 사람이 10분 안에 캐릭터를 띄우고, 문서만으로
   다음 기능을 찾는다.

## 변하지 않는 것

로드맵이 어디로 가든 아래는 유지한다. 바꾸려면 docs/README.md의 확정 결정을
날짜 섹션으로 갱신해야 한다.

- Cubism Core·샘플 모델·립싱크 프로파일은 비동봉. 사용자가 공급한다
- 루트 엔트리는 React·렌더러·Framework 없음. 무거운 것은 서브패스와 optional
  peer로 격리한다
- 기능은 소비자 주도로 추가한다. 이 문서의 항목은 **후보**이며, 실제 소비자가
  필요로 하거나 측정된 결함이 있을 때만 착수한다
- 릴리스마다 lint·typecheck·unit·tarball 소비자 4종·브라우저 3종 e2e를
  통과한다(2026-08-25부터 push·릴리스 자동 게이트). 게이트를 줄이지 않는다
- AI·TTS·아카이브 해제·OAuth·서버는 라이브러리 밖이다

## 현재 위치 (0.6.0 발행, 0.7 안정화 진행)

**하는 것**: 바닐라·React, Cubism 4·5 모델 로드, 상세 모션 상태·시퀀스·
모션/표정 페이드·가중 Idle, 립싱크 3모드와 볼륨 helper, 자동 품질, 자산
resolver, 선택형 MediaPipe 얼굴 추적과 Worker, `/inspect` 공개 API·URL/zip
검사기, 세 언어 문서 사이트, 빌드 가능한 예제 4종과 선택형 Devtools.
`develop`에는 실제 배포 entry API 기준선, 선택형 Canvas 접근성, 전체 오류 code
안내, React 18/19와 독립 소비자 검증, MediaPipe 시작 단계 진단이 추가됐다.

**못 하는 것**: 손·전신 센서 입력, 표정 가중 블렌드, Stage당 모델 둘 이상,
iOS·Android 모바일 실기기 검증, 공식 MotionSync 립싱크, 외부 사용자가 확인한
온보딩과 첫 외부 기여.

**소비자**: Livesona(OBS 아바타)가 1호이며 0.3.1을 통합한 채 M1 마무리
단계에서 잠시 멈춰 있다(2026-08-25). VS Code 확장은 보류, 히비엔(AI 캐릭터)은
재개 시 렌더링 층을 이 라이브러리로 바꾼다. **지금 활성 소비자가 없다.** 이
사실이 아래 순서 재조정의 출발점이다.

## 0.3.x 기반 안정화 (충족 2026-08-25)

0.4 기능 개발 전에 현재의 품질 약속과 실제 저장소 상태를 맞춘다. 이 단계는
새 기능을 위한 별도 제품 마일스톤이 아니라, 이후 기능이 기존 계약을 약하게
만들지 않도록 기준선을 고정하는 작업이다.

- 브라우저 3종 e2e에 사용할 수 있는 자산·라이선스 경로를 정하고, 현재 수동
  명령인 e2e를 CI와 릴리스의 실제 게이트로 승격한다. 완료 전까지는 이를 현재
  자동 게이트라고 부르지 않는다
- `packages/live2d-web/src/core/runtime.ts`와
  `packages/live2d-web/src/backends/cubism-webgl/model.ts`에 새 책임을 계속
  쌓지 않는다. 0.4 기능이 닿는 영역부터 generation·observer·feature와 model
  load·frame·motion 책임을 점진적으로 추출한다. 공개 API를 바꾸는 일괄
  리팩터링은 하지 않는다
- `0.3.1`의 공개 export·타입·tarball 파일·번들 크기와 주요 성능 수치를
  이후 회귀를 판단할 기준선으로 기록한다
- Cubism 4·5 모델, Core 5.3 + Framework 5-r.5, React 18.2·19와 현재 검증하는
  브라우저·번들러 조합을 최소 호환성 표로 만든다. "지원"과 "미검증"을
  구분한다

완료 조건은 문서의 게이트 설명과 실제 workflow가 일치하고, 위 기준선이 날짜와
환경을 포함해 재현 가능하게 기록되는 것이다.

**충족 (2026-08-25).** `ci.yml`의 `browser-e2e`(push)와 `release.yml`이
Cubism Core·Hiyori를 받아 브라우저 3종 e2e를 돌린다. 기준선은
`docs/benchmarks/2026-08-24-v0.3.1-baseline.md`, 호환성 표는
`docs/compatibility.md`. 08-24 작업은 이 조건을 채우기 전에 0.4·0.5를
구현했고, 그 순서 위반은 docs/README.md의 08-25 결정에 기록했다.

## 상시 품질 기준

다음은 특정 기능 버전과 별개로 계속 적용한다.

### 유지보수성과 공개 계약

- 새 기능이 기존 대형 모듈에 새로운 책임을 만들면 그 책임부터 내부 모듈로
  추출한다. 기능 → model → Stage dispose와 고정 프레임 순서는 분리 뒤에도
  유지한다
- `0.x`에서도 이미 공개한 API는 가능한 한 호환성을 유지한다. 이름·동작을
  바꿔야 하면 한 버전 이상 deprecation 기간을 두고 CHANGELOG에 이전 방법을
  기록한다
- 새 기능의 구체적인 시그니처는 착수 시 `docs/api-design.md`에서 결정한다.
  로드맵의 이름은 후보이며 그 자체로 API 확정이 아니다

### 검증 단계

- PR과 main은 lint·typecheck·unit·package boundary·실제 tarball 소비자 4종을
  자동 검증한다
- 브라우저 3종 e2e는 develop·main push와 릴리스의 차단 게이트다. 라이선스
  자산을 받을 수 없는 외부 PR에는 강제하지 않고, 병합 뒤 main 결과로
  확인한다. MediaPipe tracking e2e도 세 엔진 모두 차단이다. Firefox는 두 잡
  모두 Xvfb 위 headed로 돈다(헤드리스에 WebGL2가 없다, `docs/compatibility.md`)
- 릴리스는 태그의 정확한 커밋에 같은 게이트를 다시 적용한다. 단일 Linux
  러너로 재현할 수 없는 WebKit 트래킹만 예외이며, 같은 커밋의 macOS CI 잡이
  그 게이트다(`docs/compatibility.md`)
- 120분 soak와 실제 하드웨어·모바일 측정은 비용이 큰 주기 작업으로 분리한다.
  tracking soak는 릴리스 5분·주간 15분·수동 5/15/120분으로 단계화했다
- 번들 크기는 문서에 적는 것으로 끝내지 않고 `verify-package`가 root·React·
  tracking·inspect·devtools entry별 예산을 단언한다

### 패키지와 성능 예산

- React·Framework·MediaPipe·MotionSync 같은 선택 기능은 subpath와 동적
  로딩으로 격리하며 루트 정적 그래프에 넣지 않는다
- 각 기능은 도입 전에 ready 시간, frame p95·33ms 초과 비율, 소유 자원 정리,
  배포 번들 크기의 기준선을 남긴다. 기존 벤치마크 합격선을 벗어나는 회귀는
  원인을 제거하거나 소비자 근거와 함께 문서화하기 전까지 릴리스를 막는다
- 측정 수치는 장치·브라우저·모델·resolution·반복 횟수를 함께 기록한다

## 성장 지표

기능 완성이 아니라 아래 수치로 진행을 판단한다. 수치는 릴리스마다 측정일과
함께 갱신한다.

| 지표 | 현재 (2026-08-26) | 다음 확인 신호 | 장기 건강 신호 |
| --- | --- | --- | --- |
| 외부 의존 프로젝트 | 1 (Livesona, 중단 중) | 활성 프로젝트 2 | 10 |
| 주간 다운로드 | 릴리스마다 측정 | 100 | 1,000 |
| 첫 이슈 응답 | 해당 없음 | 3일 이내 | 2일 이내 |
| 깨진 공개 계약 | 0 | 0 | 0 |
| 릴리스 운영 | 수동·불규칙 | 체크리스트로 반복 가능 | 필요할 때 예측 가능하게 발행 |

외부 의존 프로젝트는 이 저장소 밖에서 실제 릴리스 후보나 발행 버전을 통합해
계속 사용하는 프로젝트다. 작성자의 다른 프로젝트도 이 조건을 만족하면 세지만,
일회성 데모와 중단된 실험은 제외한다. 주간 다운로드는 npm의 같은 7일 기준으로
기록한다. 깨진 공개 계약은 지원 대상으로 문서화한 타입·동작이 deprecation과
이전 경로 없이 기존 소비자를 중단시킨 경우다.

주간 다운로드는 후행 지표다. 외부 의존 프로젝트 수가 선행 지표이며, 그것이
늘지 않으면 기능을 더 쌓아도 의미가 없다. 다만 외부 프로젝트 수는 **버전
발행을 막는 조건이 아니라 방향이 맞는지 보는 제품 지표**다. 특정 숫자를 채우기
위해 기능을 넣거나 릴리스를 미루지 않는다.

**0.5.0 발행 시점 실측 (2026-08-25).** 외부 의존 1(Livesona, 중단 중), 주간
다운로드 0. "0.5 시점 3"에 미달이다. 08-22 결정의 재검토 조건("0.5 시점까지
늘지 않으면 기능 순서를 멈추고 F를 앞당긴다")이 발동됐고, 아래 순서 표가 그
결과다.

## 고도화 축

각 항목은 **왜 / 무엇 / 범위 밖 / 검증 / 의존과 리스크** 순서로 적는다.

### A. 입력: 웹캠 페이스 트래킹

**왜.** 가장 큰 미개척지다. VTube Studio가 하는 일을 브라우저에서 하게 되며,
Livesona는 선택 기능을 얻고 VS Code 확장과 히비엔도 같은 입력을 쓴다.
외부 조건이 무르익었다: MediaPipe Face Landmarker가 브라우저에서 478개
랜드마크와 블렌드셰이프 52개를 출력하고, Live2D의 Perfect Sync 모델은 ARKit
이름의 파라미터 52개를 갖는다. **두 52개는 같지 않다.** MediaPipe는
`_neutral`이 있고 `tongueOut`이 없어 51개만 겹친다(08-25 리뷰가 이 오해로
생긴 차단 버그를 고쳤다).

**무엇.**

- 새 서브패스 `live2d-web/tracking/mediapipe`. MediaPipe는 optional peer로
  두고 루트에는 들어가지 않는다
- 출력은 새 개념이 아니라 기존 `ParameterDriver`의 집합이다. 트래커는
  파라미터 값을 만들고, 모델에 붙이는 것은 이미 있는 `addParameterDriver`가
  한다
- 매핑 두 단계: Perfect Sync 파라미터가 있는 모델은 블렌드셰이프를 직접
  연결하고, 없는 모델은 표준 파라미터(`ParamAngleX/Y/Z`, `ParamEyeLOpen`,
  `ParamMouthOpenY`, `ParamMouthForm`, `ParamBrowLY`, `ParamBodyAngleX`)로
  축약한다
- 평활화·캘리브레이션(정면 기준 잡기)·신뢰도 낮을 때의 복귀는 라이브러리
  책임이다. 카메라 권한 UI는 소비자 책임이다

**범위 밖.** 전신·손 추적, iPhone 앱 연동, 모델 편집.

**검증.** 실제 웹캠으로 Chromium·WebKit에서 고개 회전·눈 깜빡임·입 열림이
모델에 반영되는 것, 30분 연속 실행에서 드리프트 없음, Perfect Sync 모델과
일반 모델 각 1종. 이 중 **자동화된 것은 정지 초상으로 추론 경로만 검증하는
CI**(모델 없이 Face Landmarker 초기화·52개 출력·loss·dispose)와 선택적인
5분 Chromium smoke(`test:tracking:soak`, 생명주기·급격한 힙 증가만 잡는다)이고,
실제 카메라·모델 반영·30분 드리프트·Perfect Sync 체감은 발행 후 소비자
검증으로 남긴다.

**의존과 리스크.** MediaPipe WASM 번들이 크다(수 MB). 동적 로드와 캐시
전략이 먼저 정해져야 한다. AIRI의 `model-driver-mediapipe`가 참조
구현(MIT)이며 매핑 표를 배울 수 있다.

**0.5 구현 상태 (2026-08-25).** `develop`에 선택 서브패스, 표준·Perfect Sync
자동 매핑(ARKit 52개 기준, 45개 이상이면 Perfect Sync), 1초 벽시계 중립
보정·평활화·loss 복귀, React/vanilla attach, Playground 웹캠 생명주기와
세 브라우저 Face Landmarker CI(모델 없이 추론 경로만)를 구현했다. root에는
MediaPipe와 자산이 들어가지 않는다. 실제 Perfect Sync 모델과 물리 카메라의
최종 체감, Livesona/VS Code 소비자 채택이 남았으므로 **0.5.0으로 발행하되
소비자 게이트는 열린 상태**다. 트래킹 API는 모바일 실기기와 외부 소비자 검증을
마치고, 후속 minor에서 예고 없는 호환성 파괴가 없었음을 확인할 때까지
experimental이다.

**첫 실제 카메라 검증 (2026-08-25).** 발행 직전 웹캠으로 처음 돌려 보니 쓸 수
있는 상태가 아니었다. 얼굴을 조금만 돌려도 놓치고(임계값이 MediaPipe 기본
0.5), 놓치면 0.55초 만에 정면으로 튕기고, 놓치는 경계에서 자세가 파라미터
끝까지 튀고, 트래킹된 고개가 물리보다 뒤에 적용되어 머리카락과 몸이 따라오지
않았다. 넷 다 고쳤고 감도 옵션을 열었다. 정지 초상 CI가 이 넷을 하나도 잡지
못했다는 것이 이번 릴리스의 가장 큰 교훈이다.

성능 측정(모델 없는 페이지, 2026-08-24)에서 Chromium은 추론 p95 14ms,
WebKit 17ms(기준 16.7ms 초과), Firefox headless 202ms였다. 08-25 재측정은
[0.5.0 후보 측정](benchmarks/2026-08-25-0.5.0-candidate.md). 고정 상한 하나로는
셋을 만족할 수 없어 상한을 **적응형**(시작 30fps, 추론 시간이 간격의 60%를
넘으면 절반, 최저 10fps)으로 두었고, Worker 추론 경계가 0.5 이후 첫 성능
후속 작업이다.

### B. 립싱크 품질

**왜.** 지금 세 모드 중 실사용에서 쓰이는 것은 볼륨 기반 driver뿐이다.
wLipSync는 캘리브레이션 프로파일을 요구해서 일반 사용자가 쓸 수 없고,
Livesona는 그래서 RMS를 다듬어 썼다. 입 움직임의 자연스러움이 이 라이브러리
체감 품질의 절반이다.

**무엇.**

- **볼륨 driver 헬퍼 업스트림.** Livesona가 만든 노이즈 캘리브레이션·
  히스테리시스·평활화(`createMicEnvelope`)를 `createVolumeLipSync()`류로
  라이브러리에 올린다. 두 번째 소비자가 같은 것을 다시 만들기 전에
- **공식 MotionSync 통합 후보.** Live2D의 Cubism SDK MotionSync Plugin for
  Web을 `/lipsync/motionsync` 같은 선택형 경계로 감싸는 방안을 검토한다. 정확한
  이름과 API는 착수 시 정한다. MotionSync Core는 Cubism Core처럼 비동봉이며
  사용자가 공급한다. **실제 소비자가 볼륨 기반 입력의 한계를 재현하고,
  `.motionsync3.json`을 준비하며, 라이선스·Core 공급 경계와 비교 측정의 이득이
  확인될 때만 착수한다.** 현재 예정 버전은 없다
- wLipSync 모드는 유지하되, 프로파일 없는 사용자를 위한 기본 프로파일 생성
  도구는 만들지 않는다. MotionSync가 실제로 필요하다는 증거가 생기기 전에는
  볼륨 helper가 기본 경로다

**범위 밖.** TTS, 음성 인식, 오디오 재생 파이프라인.

**검증.** MotionSync에 착수한다면 같은 음성 파일로 볼륨·wLipSync·MotionSync의
입 파라미터 궤적과 번들·CPU 비용을 비교한다. 장시간 마이크 입력에서는
AudioContext suspend 복구와 장치 변경을 확인한다.

**의존과 리스크.** MotionSync Core의 라이선스와 배포 조건을 docs/licensing.md에
먼저 기록한다. Cubism Core와 같은 "비동봉·사용자 공급" 구조가 성립하는지
확인 전에는 착수하지 않는다.

### C. 모션·표정 품질

**왜.** Framework에는 있지만 우리가 노출하지 않은 것이 많다. 모션 페이드,
표정 페이드와 동시 적용, 우선순위 큐, 파라미터 보간. 지금은 모션이 딱딱
끊기고 표정은 하나만 적용된다. 히비엔처럼 감정을 표현해야 하는 소비자에게
첫 번째 벽이 된다.

**무엇.**

- `motion()`에 `fadeIn`/`fadeOut` 옵션과 완료·중단 이벤트 세분화
- 모션 시퀀스 헬퍼(`sequence([...])`)와 idle 그룹 내 가중 랜덤
- 표정 여러 개의 가중 블렌드(`expression(id, { weight })`)와 페이드
- 물리·포즈 설정 노출(중력 방향, 바람). 우선순위 낮음, 요청 전 미착수
- ~~파라미터 보간 유틸 `tween()`~~ 삭제(2026-08-25). 소비자가
  `addParameterDriver`로 직접 할 수 있는 편의 기능이고, 라이브러리가 시간
  기반 애니메이션 API를 하나 더 소유할 이유가 없다

**범위 밖.** 모션 편집기, 타임라인 UI.

**검증.** 페이드 구간의 파라미터 궤적 단위 테스트, 표정 블렌드 결과의 결정성
테스트, Playground에 시퀀스 데모.

**의존과 리스크.** Framework의 `CubismExpressionMotionManager`와 페이드
로직이 어디까지 쓸 만한지 먼저 읽는다. 우리 mouth controller의 "SDK update
이후 쓰기" 순서와 충돌하지 않게 프레임 순서 계약을 유지한다.

**0.4 구현 상태 (2026-08-25).** `develop`에서 모션별 페이드, 상세 종료 상태,
사전 검증 시퀀스, Idle 가중 랜덤과 표정 전환 페이드를 구현했다. 기존
`motion(): Promise<void>`와 문자열 Idle 계약은 유지한다(명시한 idle 그룹이
없으면 이제 가중 idle과 같이 `invalid-props`; 기본 `'Idle'`은 그대로 관대).
합성 motion3/exp3와 실제 Hiyori로 세 브라우저 검증이 CI에 있다. 여러 표정의
가중 블렌드, tween, 물리·포즈 설정은 후속 C 범위다. 0.4 범위는 0.5.0에 함께
발행하며, Livesona 전환 전에는 완료로 표시하지 않는다.

### D. 다중 모델과 장면

**왜.** "Stage당 모델 하나"는 첫 범위의 의도적 제한이었다. 합방, 대화 장면,
캐릭터 교체 전환은 둘 이상을 요구하고, 지금은 캔버스를 여러 개 만드는
우회밖에 없다. 브라우저의 WebGL 컨텍스트 상한(8~16)이 그 우회의 천장이다.

**무엇.**

- Stage 하나에 모델 N개. 레이어 순서, 개별 변환(위치·크기), 개별
  히트테스트
- 컨텍스트·셰이더·Framework 인스턴스 공유
- React는 `<Live2DCanvas>` 안에 `<Live2DModel>` 여러 개를 허용하는 형태로
  자연스럽게 확장

**범위 밖.** 모델 간 물리 상호작용, 3D 배치.

**검증.** 모델 5종 동시 로드의 프레임 시간과 메모리(기존 다중 모델 벤치마크
확장), 개별 dispose 후 나머지 모델 무영향.

**의존과 리스크.** docs/README.md의 "Stage당 모델 하나" 확정 결정을 날짜
섹션으로 갱신해야 한다. 프레임 순서 계약(모션 → driver → update → draw)을
모델별로 유지하면서 draw만 합치는 구조가 필요하다.

### E. 성능과 안정성

**왜.** 지금 수치는 데스크톱 기준이고 모바일 GPU는 실측하지 않았다. 장시간
방송(Livesona)과 에디터 상주(VS Code)는 메모리 누수에 가장 민감한 사용처다.
0.5의 트래킹 실측이 동기 추론이 렌더 스레드를 막는 것(Firefox 프레임 100%
초과)을 보여줬다. "완성도"의 실체는 이 축에 있어서, 0.5.0 바로 다음(0.6)에
둔다. 품질 관리는 0.3.x부터 상시 진행한다.

**무엇.**

- **추론 Worker**: MediaPipe 추론을 선택형 Worker로 옮겨 렌더 스레드에서
  떼어낸다. main 동기 계약은 호환을 위해 유지한다. **구현·브라우저 기능 검증**
- 모바일 실기기 smoke: iOS Safari·Android Chrome 각 1회, startup·frame·
  트래킹 추론을 기록하고 결과를 `docs/compatibility.md`에 승격. 정기
  게이트화는 그 결과를 보고 결정
- soak 정기화: main+Worker 합산 릴리스 5분(각 2.5분), 주간 15분(각
  7.5분), 수동 dispatch 총 5/15/120분. 한 모드만 선택하면 전체 시간을 그
  모드가 사용한다. 로컬 Chromium Worker-only 15분은 2026-08-25 통과했다.
  일반 120분 Hiyori soak는 결함 조사 때만 실행
- 번들 예산 단언: react·tracking entry의 raw/gzip 상한을 `verify-package`에
  적용. **구현·실측 통과**
- MediaPipe 고도화: 모바일 실측 뒤 adaptive input resolution/FPS, Worker
  round-trip·skip 비율, 백그라운드 복귀, 발열·배터리를 함께 조정한다. GPU
  delegate와 프로토콜 변경은 CPU/Worker보다 나아진다는 측정이 있을 때만 한다
- Worker 오프로드 검토(물리·모션·`OffscreenCanvas`): 추론 Worker 뒤에
  측정으로 이득이 확인될 때만
- 텍스처 메모리 정책은 다중 모델의 비활성 상태가 실제로 생길 때 다룬다

**범위 밖.** WebGL1 폴백(WebGL2 점유율을 측정해 필요성이 증명되기 전에는
하지 않는다), WebGPU(안정화 전).

**검증.** 기존 벤치마크 스위트에 모바일 열 추가, soak에서 힙 증가 0.

### F. 개발자 경험과 생태계

**왜.** 많은 사람이 쓰려면 찾을 수 있고, 시작할 수 있고, 기여할 수 있어야
한다. 지금 문서는 README 3종과 API 레퍼런스뿐이고 검색에도 약하다. 외부
의존 프로젝트는 기능이 아니라 이 축에서 생긴다. 원래 별도 0.7로 잡았지만
미발행 상태에서 구현됐으므로 다음 0.6.0에 함께 넣는다. README 3개 국어
400줄은 이미 유지비다: 08-24 편집에서 JA만 문장이 유실됐고 08-25 리뷰가
복원했다. 문서 사이트가 그 중복을 흡수해야 한다.

**무엇.**

- 문서 사이트: 타입에서 자동 생성한 레퍼런스 + 가이드 + 라이브 예제. 데모
  사이트(`live2d-web-playground.vercel.app`)를 흡수한다
- 예제 갤러리: Vite 바닐라, Next, Vue(바인딩 없이 루트 API로), OBS
  오버레이(Livesona 축약판)
- **모델 호환성 검사기**: Playground의 `/inspect`를 독립 도구로. zip을 넣으면
  누락 자산·외부 URL·Cubism 버전·모션 목록을 보고한다. Livesona의 importer를
  재사용하며, 리거와 개발자 모두에게 쓸모가 있다
- opt-in 진단 정보: 선택형 `live2d-web/devtools`가 공개 runtime/model 상태와
  현재 parameter를 복사 가능한 snapshot으로 제공하고, 같은 패널에서 parameter
  슬라이더·모션 재생·표정 적용 같은 쓰기 조작도 노출한다. 원래 계획(저빈도
  snapshot 검토)보다 넓게 나갔으며 그 경위와 근거는 docs/README.md의
  2026-08-26 결정에 있다. URL·자산·카메라·얼굴 데이터와 기본 telemetry는
  포함하지 않는다
- Canvas를 장식 또는 설명 가능한 이미지로 표시하는 접근성 전달 경로와
  fallback을 제공한다. 키보드 대체 조작과 `prefers-reduced-motion` 대응은
  일반 DOM controls를 사용하는 가이드와 예제로 고정한다
- 릴리스 체크리스트(`docs/release-checklist.md`, 2026-08-25 신설): 자동
  게이트 밖에서 사람이 확인하는 것을 고정한다
- 기여 가이드, 이슈 템플릿, "좋은 첫 이슈" 라벨
- 프레임워크 바인딩은 요구가 생길 때만(`/vue`, `/svelte`). 루트 API가 이미
  프레임워크 중립이므로 급하지 않다

**범위 밖.** 범용 UI 위젯 배포(마스코트 위젯은 `l2d-widget`이 잘 하고
있다), 호스팅 서비스.

**검증.** 처음 보는 개발자가 문서만으로 10분 안에 캐릭터를 띄우는 테스트를
분기마다 1명 이상에게 실시.

**0.6 통합 후보 구현 상태 (2026-08-26).** Netlify 사이트에 영어·한국어·일본어 MDX
가이드 15개와 TypeDoc API, Shiki code highlight, 정적 검색,
canonical/hreflang, sitemap, `llms.txt`를 추가했다. 루트 landing과 고정 Canvas
`/playground`를 분리했고, React-free `live2d-web/devtools`와 `/inspect` 공개 검사
API를 제공한다. Vite Vanilla·Next React·Vue Vite·OBS overlay 예제는 실제
production build되며 세 브라우저 문서·검사 e2e와 기여 템플릿도 갖췄다.
구현됐다. 외부 PR·의존 프로젝트와 10분 온보딩은 이 작업의 효과를 판단하는
후속 지표이며 0.6.0 발행 차단 조건은 아니다. Canvas 접근성 전달 경로는 0.7
안정화 후보로 옮긴다.

### G. 신뢰와 호환성

**왜.** 기반 라이브러리의 신뢰는 "내 모델이 되나"와 "다음 버전에서 깨지나"
두 질문에 대한 답이다.

**무엇.**

- 지원 매트릭스: Cubism 3·4·5, Pro/Free 에디터 출력, VTube Studio 내보내기,
  주요 리거 도구의 실물 모델과 브라우저·React·Vite·Next SSR 조합을 수집해
  CI에 고정하고 지원·미검증·비지원 상태를 구분한다
- Core 버전 정책 문서화: 어느 Core와 어느 Framework가 짝인지, 업그레이드
  시 무엇이 깨지는지
- Firefox 워클렛 문제 추적(현재 wLipSync만 제외), 브라우저별 알려진 제한 표
- 공개 계약 변경 규칙: patch에서는 breaking을 만들지 않는다. 안정 API인
  root·React entry의 minor breaking은 불가피할 때만 이전 minor에서
  deprecation과 이전 경로를 제공한다. experimental subpath는 minor에서 변경할
  수 있지만 CHANGELOG와 migration을 반드시 제공한다
- 신뢰하지 않는 모델이 선언한 절대 URL, 과도하게 큰 자산, CORS·CSP와 오류에
  노출되는 경로의 경계를 모델 검사기·보안 문서와 함께 정한다. 아카이브 해제와
  저장소 보안은 계속 소비자 책임으로 둔다

**범위 밖.** Cubism 2.1(`.moc`) 지원. 별도 Core가 필요하고 수요가 없다.

## 배포 순서와 0.x 정책

당분간 `1.0`을 목표로 두지 않는다. `0.9` 다음은 필요하면 `0.10`, `0.11`로
이어간다. 버전 번호는 완성도 점수가 아니라 **호환되는 변경 묶음의 경계**다.

| 버전·단계 | 내용 | 완료 판단 |
| --- | --- | --- |
| 0.3.x | 기반 안정화·검증 계약·호환성 기준선 | 브라우저 3종 e2e와 공개 API·번들·성능 기준선 기록. **충족 2026-08-25** |
| 0.5.0 | 모션·표정 품질, 볼륨 helper, MediaPipe main 추적 | **2026-08-25 발행.** 실제 소비자·Perfect Sync·모바일 검증은 후속 증거로 유지 |
| 0.6.0 | MediaPipe Worker와 안정성 게이트, 모델 검사, Devtools, 다국어 MDX 문서·예제, 사이트 개편과 리뷰 보완 | **2026-08-26 발행.** 원격 CI, 릴리스 5분 soak, 실제 카메라 smoke와 배포 사이트를 확인했고 모바일은 미검증으로 공개 |
| 0.6.x | 0.6에서 발견된 회귀·문서·호환성 수정 | patch에서 공개 계약을 깨지 않고 관련 회귀 테스트 통과 |
| **0.7 안정화 후보** | API 계약 기준선, iOS Safari 실기기 검증, 독립 프로젝트 온보딩, 접근성·호환성·오류 안내, 측정 기반 MediaPipe 초기화 조정 | 공개 export·Canvas·오류·lifecycle snapshot, **iOS 결과표**, out-of-tree 소비자 온보딩 기록과 **발견된 결함 수정**. Android와 외부 프로젝트 수 자체는 발행 차단 조건이 아님. <br>_상태(2026-08-27): 자동화·데스크톱 구현 완료, iOS 실기기 대기._ |
| 0.8 이후 | 아래 수요 기반 후보 중 증거가 가장 강한 한 묶음 | 착수 조건과 소비자·측정 결과를 결정 기록에 남긴 뒤 범위 확정 |

### 0.7 안정화 후보의 실제 범위

- **API 계약 기준선**: root·React·선택 subpath의 export, 타입, 오류 code를
  snapshot으로 고정한다. 기능을 동결하는 것이 아니라 변경 시 무엇을 보호하고
  어떻게 이전할지 명확히 하는 작업이다.
  _상태: API Extractor 보고서와 CI `api:check` 구현 완료._
  _잔여: Promise 정착 순서와 `dispose()` 멱등성은 **snapshot이 덮지 못한다.**
  `.d.mts`는 `dispose: () => void`만 기록하므로 "dispose 시 resolve"를
  "reject"로 바꿔도 보고서가 바이트 단위로 같다. 현재는 기존 lifecycle 단위
  테스트가 그 동작을 덮고 있고, 별도 계약 테스트는 만들지 않았다._
- **외부 프로젝트 온보딩**: 이 저장소 밖의 작은 Vanilla/React 프로젝트에서
  실제 tarball 또는 npm 버전을 설치해 문서만으로 모델을 띄우고 정리한다. 설치·
  Core/CORS·SSR·번들·오류 안내에서 막힌 지점을 제품 결함으로 되돌린다.
  _상태: npm 0.6.0 Vite Vanilla와 현재 packed Next React 설치 경계 검증 완료._
- **접근성·호환성·오류 안내**: Canvas의 이름·fallback·키보드/모션 정책을 앱이
  전달할 수 있게 하고, 브라우저·Core·번들러 지원표와 Core 미로드·404·CORS·
  모델 손상 오류에 바로 실행할 수 있는 해결책을 연결한다.
  _상태: 선택형 Canvas semantics, 세 언어 오류 anchor와 Chromium axe smoke
  구현 완료._
- **모바일·MediaPipe**: iOS Safari에서 카메라 중지/재시작, 백그라운드 복귀,
  Worker, 초기화·frame·추론을 먼저 측정한다. warm tracker 생성 중앙값 5초를
  넘으면 다운로드·WASM/task 생성·직렬 초기화 중 측정된 병목만 고친다. Android
  Chrome은 0.7의 비차단 미검증 항목으로 남긴다.
  _상태: 데스크톱 warm 생성은 270~383ms로 통과했고 단계별 진단을 구현했다.
  iOS 실기기만 차단 상태로 남음._

### API 상태와 experimental 종료

- root와 `/react`는 안정 기준선이다. patch breaking은 금지하고, minor 변경도
  deprecation과 migration을 우선한다
- `/tracking/mediapipe`는 모바일 iOS·Android 검증, 실제 소비자 1곳과 후속 minor
  호환성 확인 뒤 experimental 표기를 제거한다
- `/inspect`와 `/devtools`는 외부 또는 별도 소비자 프로젝트의 실제 사용,
  공개 API snapshot과 한 번의 후속 minor 호환성 확인 뒤 안정화한다
- experimental은 "1.0 전까지"라는 날짜 없는 유예가 아니다. 종료 기준을 채우면
  0.x에서도 stable로 올리고, 변경이 필요하면 minor CHANGELOG와 migration을 쓴다

### 수요 기반 후보

- **표정 가중 블렌드·물리/포즈 제어**: 감정 표현 소비자가 현재 API로 구현하기
  어렵다는 사례가 생기면 C를 확장한다
- **다중 모델 Stage**: 합방·대화·캐릭터 전환에서 Canvas 여러 개가 실제 병목이
  될 때 시작한다. 공유 WebGL context와 render/lifecycle 재설계가 필요해 단일
  모델 사용이 대부분인 현재는 우선하지 않는다
- **MotionSync**: 볼륨 helper의 한계를 재현한 소비자, `.motionsync3.json`,
  MotionSync Core·라이선스 공급 경로, 품질/비용 비교가 모두 준비될 때 시작한다
- **Vue·Svelte binding**: root API 연결만으로 부족하다는 반복 요구가 있을 때
  별도 optional entry를 검토한다

### 장기 실험: React Native

React Native 지원은 `live2d-web`의 서브패스로 만들지 않는다. WebGL2·DOM 기반
backend를 억지로 공유하지 않고 Cubism Native SDK를 쓰는 별도 패키지 또는
저장소(가칭 `live2d-react-native`)로 실험한다. API 개념과 타입은 가능한 범위에서
공유하되 렌더러와 생명주기는 네이티브로 구현한다. 실제 RN 소비자, iOS·Android
양쪽 POC, Core·라이선스 공급 경로와 유지보수 여력이 함께 확보되기 전에는
착수하지 않는다.

순서를 바꾸는 기준은 **어떤 소비자가 지금 그것을 필요로 하는가**와 **어떤
위험이 이미 측정됐는가**다. 요구가 없는 후보는 버전 번호가 와도 착수하지 않는다.
공개 계약·보안·회귀처럼 측정된 위험을 줄이는 상시 품질 작업은 소비자 요청을
기다리지 않는다.

## 하지 않는 것

- AI 대화·TTS·음성 인식. 히비엔 같은 다운스트림의 몫이다
- 아카이브 해제·파일명 복구·브라우저 저장. 앱 층이다(Livesona가 보유)
- OAuth·플랫폼 연동·서버. 앱 층이다
- WebGL1 폴백, Cubism 2.1, WebGPU(안정화 전)
- 범용 마스코트 위젯 배포, 모델 호스팅, 유료 기능
- DOM·WebGL2 backend 안에 iOS·Android 네이티브 렌더러를 섞는 것. React Native는
  장기적으로 별도 패키지에서만 검토한다

## 소비자와의 관계

| 소비자 | 상태 | 이 로드맵에서 받는 것 | 돌려주는 것 |
| --- | --- | --- | --- |
| Livesona | 중단(M1 마무리 단계, 2026-08-25) | B 헬퍼, A 트래킹(선택), C 모션 품질 | 재개 시 OBS 실측, 장시간 안정성, 립싱크 튜닝 |
| VS Code 확장 | 보류(다음 후보) | A 트래킹, E 상주 안정성 | 에디터 환경 제약, 장시간 실측 |
| 히비엔 | 재개 시 | C 표정 블렌드, 필요가 확인될 때 D 다중 모델·B MotionSync | 감정 표현 요구, TTS 오디오 연결 사례 |
| 외부 | 0 | 전부 | 호환성 이슈, 기여 |

라이브러리 기능은 이 표의 "받는 것" 열에서만 나온다. 표에 없는 기능 요청은
먼저 소비자를 찾는다.
