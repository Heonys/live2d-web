# live2d-web 문서 지도

상태 기준일: **2026-08-26**. 바닐라 우선 headless runtime, React binding,
상호작용 API(hitTest/followPointer/모션 완료 대기), source/driver 립싱크,
선택형 MediaPipe 얼굴 추적과 pixi-v6 비교 어댑터가 구현돼 있다. 공식
Framework 5-r.5 WebGL2 어댑터가 기본 backend다. 발행된 `0.6.0`에는 선택형
MediaPipe Worker, 모델 검사 API·URL/zip 도구, 세 언어 문서 사이트와 빌드
가능한 예제 4종이 포함된다. `develop`은 공개 API 기준선·Canvas 접근성·오류
안내·독립 소비자 검증을 다루는 0.7 안정화 작업 중이다.

1. [로드맵](roadmap.md) — 성장 목표·상시 품질 기준·고도화 축·버전 순서
2. [호환성](compatibility.md) — 지원·검증·미검증 범위와 알려진 제한
3. [릴리스 체크리스트](release-checklist.md) — 자동 게이트 밖에서 사람이 확인하는 것
4. [아키텍처](architecture.md)
5. [API reference](api-design.md)
6. [라이선스와 상표](licensing.md)
7. [벤치마크 가이드](benchmarking.md)
8. [배포물과 개발 저장소 보안 검증](security.md)
9. [공개 문서 사이트](https://live2d-web-playground.vercel.app/docs/en) — 영어·한국어·
   일본어 가이드, TypeDoc API, 검색과 예제 갤러리
10. [모델 검사기](https://live2d-web-playground.vercel.app/inspect) — URL·로컬 zip
    자산/버전/트래킹 호환성 검사
11. [v0.7 안정화 검증](benchmarks/2026-08-26-v0.7-stabilization.md)
   — API 기준선·React 18/19·독립 소비자·접근성·MediaPipe warm 생성 측정
12. [0.6 MediaPipe Worker 추적 측정](benchmarks/2026-08-25-0.6-worker-tracking.md)
   — Hiyori 동시 렌더 main/Worker 3회 비교와 0.6 번들 예산
13. [0.5.0 발행 후보 측정](benchmarks/2026-08-25-0.5.0-candidate.md)
   — 리뷰 반영 뒤 크기·적응형 추론 상한·e2e 결과
14. [v0.3.1 안정화 기준선](benchmarks/2026-08-24-v0.3.1-baseline.md)
   — 공개 패키지·소비자·브라우저·smoke 회귀 기준
15. [볼륨 립싱크 드라이버 패키지 변화](benchmarks/2026-08-24-volume-lipsync.md)
   — root/runtime chunk·tarball의 v0.3.1 기준선 대비 변화
16. [모션 페이드 옵션 패키지 변화](benchmarks/2026-08-24-motion-fade.md)
   — root/runtime/cubism/model chunk·tarball의 v0.3.1 기준선 대비 변화
17. [0.4 모션·표정 후보 패키지 변화](benchmarks/2026-08-24-motion-expression-candidate.md)
   — 상세 상태·시퀀스·가중 Idle·표정 페이드 뒤 chunk·tarball 변화
18. [0.5 MediaPipe 후보 측정](benchmarks/2026-08-24-mediapipe-candidate.md)
   — 선택형 tracking entry·자산 크기·브라우저 추론과 프레임 영향
19. [시작 비용 최적화 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)
   — 최신 backend A/B 판정
20. [시작 비용 단축 검증](benchmarks/2026-08-18-hardware-matrix.md)
   — 실제 GPU에서의 셰이더·ready 비용
21. [diagnostics 통합 뒤 WebGL/Pixi 재측정](benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)
22. [cubism-webgl과 pixi-v6 성능 비교](benchmarks/2026-08-14-cubism-webgl-vs-pixi-v6.md)
23. [WebGL vs Pixi JS heap 비교](benchmarks/2026-08-15-backend-memory.md)
24. [다중 모델 집중 matrix 결과](benchmarks/2026-08-14-multi-model-matrix.md)
25. [다중 모델 startup 결과](benchmarks/2026-08-14-multi-model-startup.md)
26. [다중 모델 memory 결과](benchmarks/2026-08-14-multi-model-memory.md)
27. [하드웨어 스모크](benchmarks/2026-08-15-hardware-smoke.md)

## 확정된 결정

- 제품·npm 패키지, 로컬 디렉터리와 GitHub 저장소 이름은 `live2d-web`이다.
- 현재 발행 버전은 `0.6.0`이고 다음 후보는 API 계약·접근성·iOS 실기기·독립
  소비자 온보딩을 다루는 `0.7` 안정화다. 0.3.x 기반 안정화는 충족됐으며,
  `v*` 태그 푸시가 릴리스
  워크플로를 실행해 npm에 발행한다. 변경 이력은
  [CHANGELOG](../CHANGELOG.md)에 기록한다.
- npm 패키지는 하나이며 `.`, `/react`, `/inspect`, `/devtools`, `/tracking/mediapipe`,
  `/tracking/mediapipe/worker`,
  `/backends/cubism-webgl`로 경계를 나눈다. pixi-v6는 저장소 안의 벤치마크
  비교 대상이며 발행하지 않는다.
- 루트는 React와 `"use client"`가 없는 바닐라 API다. React는 optional
  peer이며 `/react`에만 존재한다.
- 바닐라와 React가 같은 headless controller를 사용한다.
- Cubism 4·5 `model3.json/moc3`, WebGL2, Stage당 모델 하나를 첫 범위로
  고정한다.
- 자동 품질이 기본이며 고정 `resolution`은 명시적 opt-out이다.
- 프레임 순서는 모델 motion/effect/physics → 외부 driver → model update →
  metrics → draw다.
- Core·샘플 모델·립싱크 profile은 항상 비동봉이다. Framework와 셰이더는
  cubism-webgl 전용 chunk/asset에만 포함한다.
- backend 생략 시 cubism-webgl을 동적 로딩한다. pixi-v6는 명시적
  비교·호환용으로 유지한다.
- MediaPipe는 `/tracking/mediapipe` optional peer 경계에서만 동적 로딩하고,
  카메라·WASM·모델과 스케줄러는 앱이 공급·소유한다. Worker는 앱이 factory를
  주고 라이브러리가 task와 함께 정리한다.

### 2026-08-22 라이브러리 성장 방향

- **결정문**: live2d-web은 "브라우저에서 Live2D를 다룰 때의 기본 선택지"를
  목표로 꾸준히 키운다. 방향과 순서는 [로드맵](roadmap.md)이 단일 기준이다.
  기능은 소비자 주도로만 추가하고, 각 버전은 소비자 하나가 실제로 받아쓰는
  것을 완료 조건으로 한다.
- **근거**: 사실상 표준인 `pixi-live2d-display`가 2023-12 이후 멈춰 있어 그
  자리가 비어 있다. Livesona가 1호 소비자로 라이브러리를 단련했고(0.3.x의
  resolveAsset·경로 인코딩이 그 결과), 같은 방식으로 소비자를 늘리는 것이
  기능을 먼저 쌓는 것보다 확실하다.
- **포기와 대체**: 확장 프로그램·위젯 같은 별도 제품을 라이브러리 성장
  수단으로 먼저 만드는 것(또 하나의 제품이 되어 같은 비용이 반복된다).
  대신 라이브러리를 키우고 소비자가 그 위에서 만든다. VS Code 확장은
  Livesona 마무리 뒤의 다음 소비자 후보로 보류.
- **재검토 조건**: 외부 의존 프로젝트가 0.5 시점까지 늘지 않으면 기능
  순서를 멈추고 F(개발자 경험)를 앞당긴다.

### 2026-08-24 기반 안정화와 상시 품질 기준

- **결정문**: 0.4 기능 개발 전에 0.3.x 기반 안정화를 둔다. 현재 자동화된
  lint·typecheck·unit·tarball 소비자 게이트와 아직 수동인 브라우저 e2e를
  구분해 기록하고, e2e를 실제 CI·릴리스 게이트로 승격한다. 이후 모든 기능은
  [로드맵의 상시 품질 기준](roadmap.md#상시-품질-기준)을 함께 만족한다.
- **근거**: 문서가 브라우저 3종 e2e를 현재 릴리스 게이트로 설명하지만 실제
  workflow는 이를 실행하지 않는다. 또한 runtime과 기본 backend의 핵심 파일에
  여러 책임이 모여 있어 0.4 이후 기능을 그대로 쌓으면 공개 계약과 생명주기
  회귀를 추적하기 어려워진다.
- **포기와 대체**: 기능을 먼저 쌓은 뒤 한 번에 내부를 다시 만드는 방식과,
  공개 API를 바꾸는 대규모 선행 리팩터링을 하지 않는다. 대신 기능이 닿는
  책임부터 점진적으로 추출하고 API·번들·성능 기준선을 유지한다.
- **재검토 조건**: 브라우저 3종 e2e가 자동 게이트가 되면 문서의 표현을 현재
  상태로 갱신한다. 다중 모델이 Stage 소유 계약을 바꿔야 할 때는 이 원칙과
  공개 계약을 다시 검토한다.

### 2026-08-24 MediaPipe 입력 경계

- **결정문**: 얼굴 추적은 `live2d-web/tracking/mediapipe` 선택 서브패스로
  제공한다. 라이브러리는 추론·중립 보정·매핑과 driver 정리만 소유하고,
  카메라 권한·video·track·rAF와 WASM·모델 경로는 앱이 소유한다.
- **근거**: 기존 `addParameterDriver()` 프레임 계약을 재사용하면 바닐라와
  React가 같은 추적 결과를 쓰면서 루트 번들과 카메라 생명주기를 격리할 수
  있다. reference Chromium p95는 14.4ms였지만 Firefox headless가 202ms로
  임계값을 넘어 첫 버전 기본 상한을 15fps로 낮췄다.
- **포기와 대체**: 기본 CDN·자산 동봉·라이브러리 소유 `getUserMedia`, 첫
  버전의 Worker를 넣지 않는다. 사용자는 self-host하고 필요한 경우 `maxFps`를
  명시한다.
- **재검토 조건**: Firefox·저성능 장치의 Worker 경계를 다음 성능 작업에서
  검증한다. Worker 뒤에도 추론 비용이 크면 장치별 권장 상한을 문서화한다.

### 2026-08-25 0.4·0.5 통합 발행과 순서 재검토

- **결정문**: 0.4와 0.5 범위를 **0.5.0 하나로 발행**한다. 트래킹 서브패스는
  당시 1.0 전까지 experimental로 표시하기로 했다(종료 시점은 아래
  2026-08-26 0.x 성숙도 결정으로 대체). 발행 전에 0.3.x 완료 조건(브라우저
  3종 e2e의 CI·릴리스 게이트 승격)을 먼저 채운다. 로드맵의 완료 조건은 소비자
  채택 문구를 유지하고, 발행 여부는 별도 상태로 적는다.
- **근거**: Livesona 개발이 멈춰 0.4 단독 소비자 게이트가 닫힐 수 없다.
  트래킹은 optional peer 서브패스라 쓰지 않는 소비자에게 영향이 없다(빌드
  산출물에서 확인: root·react 번들에 MediaPipe 참조 0). 릴리스를 둘로 나누면
  사이에 아무 검증도 끼지 않는다.
- **무엇이 틀렸나**: 08-24 작업은 스스로 "0.4 개발 전에 0.3.x 안정화"를
  적고 같은 브랜치에서 그 조건을 채우지 않은 채 0.4·0.5를 구현했으며, 표의
  완료 조건을 "구현 완료, 검증 대기"라는 상태로 바꿨다. 상태는 실패할 수 없어
  게이트가 아니다. 08-25 리뷰에서 발견해 되돌렸다. 같은 리뷰가 Perfect Sync
  파라미터 집합이 MediaPipe 52개(`_neutral` 포함, `tongueOut` 없음)라 실제
  Perfect Sync 모델(ARKit 이름)을 인식하지 못하는 결함을 찾아 고쳤다. 게이트
  승격 자체도 반만 되어 있었다. `release.yml`에 `browser-e2e`만 넣고
  `tracking-e2e`를 빠뜨린 채 로드맵에는 "릴리스는 같은 게이트를 다시
  적용한다"라고 적어, 간판 기능인 트래킹이 태그 커밋에서 한 번도 검증되지
  않을 뻔했다. 발행 직전 점검에서 찾아 넣었다.
- **포기와 대체**: 0.4.0 단독 발행(닫힐 게이트가 없다). 고정 15fps 기본
  상한(Chromium을 Firefox 때문에 손해 보게 한다) 대신 적응형 상한.
  파싱 결과 LRU 메모(Framework 큐가 `autoDelete`로 삭제 소유권을 가져
  재생 중 축출이 use-after-free가 된다) 대신 버퍼 지연 보관만.
- **재검토 조건**: 발행 후 첫 소비자 채택 시 게이트 닫힘을 기록한다.
  (Firefox tracking e2e는 같은 날 러너에서 적응형 상한으로 통과해 차단
  게이트로 올렸다. 헤드리스 Firefox의 WebGL2 부재는 Xvfb headed로 우회.)

### 2026-08-25 실제 카메라가 정지 초상 CI를 뒤집다

- **결정문**: 0.5.0 발행을 멈추고 트래킹을 실사용 가능한 수준으로 고친 뒤
  내보낸다. 감도·loss 동작·인식 임계값을 옵션으로 열고, 파라미터 드라이버에
  물리 앞 단계를 추가한다.
- **근거**: 발행 직전 웹캠으로 처음 돌려 본 결과가 근거다. 턱을 크게 들어도
  `ParamAngleY`가 6.8에 그치고, 고개를 옆으로 돌리면 `lost`가 되며 세 값이
  0으로 돌아갔다. 조금 움직이다 놓치고 정면으로 복귀하기를 반복해서, 돌린
  자세가 유지된 적이 한 번도 없었다. 트래킹은 0.5의 간판 기능이라 이 상태의
  첫인상이 그대로 굳는다.
- **무엇이 틀렸나**: 세 브라우저 트래킹 e2e가 **정지 초상 한 장**을 쓴다.
  각도의 부호도 크기도, 얼굴을 놓치는 경계도, 자세 유지도 검증하지 않는다.
  네 결함이 전부 그 사각지대에 있었고 CI는 전부 초록이었다. 진단 과정에서도
  같은 실수를 했다. `peak` 30.0을 보고 "값이 너무 커서 잘린다"고 판단했지만
  그것은 유지된 값이 아니라 얼굴을 놓치는 순간 한 프레임 튄 값이었다.
  최대값만 보고 유지값을 확인하지 않은 탓이다.
- **포기와 대체**: 정지 초상만으로 트래킹 품질을 주장하는 것. 부호와 스케일은
  합성 행렬 단위 테스트로 옮겨 잠갔고(`state.test.ts`), 나머지는 릴리스
  체크리스트의 사람 확인 항목으로 남긴다. 감도 기본값은 추측하지 않고 눈높이
  카메라 측정 뒤 정한다.
- **재검토 조건**: 소비자가 실제 카메라로 채택한 뒤, 어떤 기본 감도가
  대다수에게 맞는지 데이터가 모이면 상수를 다시 본다.

### 2026-08-25 순서 재조정: 완성도와 발견성을 새 기능보다 앞에

- **결정문**: 0.5.0 다음을 E(성능·안정, 0.6)와 F(개발자 경험, 0.7)로 당기고
  D(다중 모델, 0.8)와 B MotionSync(0.9)를 뒤로 보낸다. C의 `tween()`은
  삭제하고 물리·포즈 설정은 요청 전 미착수로 낮춘다. 릴리스 체크리스트를
  신설한다.
- **근거**: 08-22 결정의 재검토 조건이 발동됐다. 0.5 시점 목표 외부 의존 3에
  대해 실측 1이고 그마저 중단 중이며, VS Code·히비엔도 보류·미재개다. 활성
  소비자가 없으면 D·MotionSync는 소비자 주도 원칙상 착수할 수 없고, 남는 일은
  있는 것을 단단하게 하고(E) 찾기 쉽게 하는 것(F)뿐이다. 0.5 트래킹 실측은
  동기 추론이 렌더 스레드를 막는 것을 보여줘 Worker가 기능보다 급함을
  증명했다. README 3개 국어의 유지비는 08-24 JA 문장 유실로 이미 드러났다.
- **포기와 대체**: 다중 모델·MotionSync 선행 착수. `tween()`은 소비자가
  `addParameterDriver`로 직접 만든다.
- **재검토 조건**: 히비엔 재개나 합방 데모처럼 D를 요구하는 소비자가 실제로
  나타나면 D를 0.7 앞으로 당긴다. 외부 의존이 0.7 시점에도 1이면 F의 범위를
  다시 본다.

### 2026-08-25 0.6 Worker와 단계형 안정성 게이트

- **결정문**: 기존 MediaPipe main 모드의 동기 API를 기본값으로 유지하고,
  앱이 module Worker factory를 주는 선택형 비동기 경로를 추가한다. tracking
  soak는 main+Worker 합산 릴리스 5분(각 2.5분)·주간 15분(각 7.5분)·수동
  5/15/120분으로 구분한다. 한 모드만 선택하면 설정 시간 전체를 사용한다.
- **근거**: 0.5 실측에서 Firefox main 추론이 렌더 프레임을 직접 막았다.
  한편 120분을 모든 변경에 반복하면 피드백이 지나치게 늦어지므로, 짧은
  생명주기 회귀와 장기 누수 조사를 같은 게이트로 취급하지 않는다.
- **포기와 대체**: Worker 초기화 실패의 조용한 main fallback, 프레임 큐,
  WASM·모델 동봉, 렌더링·물리·모션 Worker 이동은 하지 않는다. busy 프레임은
  `skipped`로 끝내고 실패는 `tracking-error`로 드러낸다. 텍스처 비활성 정책은
  다중 모델 상태가 생기는 0.8에서 다룬다.
- **재검토 조건**: 모바일 두 기기와 tracking benchmark에서 Worker가 33ms
  프레임 목표를 못 맞추면 기본 FPS와 Worker 프로토콜을 다시 본다. 15분 soak가
  반복해서 놓치는 누수가 확인될 때만 주간 시간을 늘린다.

### 2026-08-25 0.7 문서와 모델 검사 경계

- **결정문**: 상세 사용법은 세 언어 문서 사이트의 공통 slug 소스로 옮기고
  README 3종은 빠른 시작·라이선스·문서 링크 중심으로 줄인다. 모델 내용 검사는
  React-free `live2d-web/inspect`, zip 해제와 렌더 UI는 Playground 책임으로
  분리한다. 0.7 구현 완료와 외부 참여 완료 조건은 구분한다.
- **근거**: README 3종의 긴 중복은 번역 유실을 이미 만들었고 검색·내부 링크·
  framework별 시작 경로를 제공하기 어렵다. model3 참조 검사는 다른 소비자도
  재사용할 수 있지만 JSZip을 npm 루트에 넣을 이유는 없다. TypeDoc API와 실제
  build되는 예제를 함께 두면 문서 snippet이 코드와 어긋나는 위험도 줄어든다.
- **포기와 대체**: 별도 문서 호스팅 제품, npm에 JSZip 포함, runtime telemetry,
  소비자 없는 Canvas 접근성 API는 만들지 않는다. 기존 Netlify Playground가
  문서·데모·검사기를 함께 제공하고 optional 책임은 subpath/app에 둔다.
- **재검토 조건**: 처음 보는 사용자의 10분 온보딩 또는 외부 PR에서 막히는
  구간이 확인되면 가이드·예제를 먼저 바꾼다. runtime 진단 snapshot과 접근성
  전달 경로는 실제 이슈가 생길 때 API 설계부터 다시 시작한다.

### 2026-08-26 devtools 경계 결정 보완

- **결정문**: `live2d-web/devtools` 서브패스를 유지한다. 공개 runtime API만
  duck-typing으로 사용하는 Shadow DOM 패널이며, snapshot 복사 외에 parameter
  슬라이더·모션 재생·표정 적용의 쓰기 조작을 포함한다.
- **근거**: 경계 품질은 문제없다. root/react 번들 오염 0(verify-package 단언),
  React·Framework·MediaPipe 의존 0, SSR 평가 안전, 크기 예산 단언, 단위·e2e
  테스트 완비. 소비자가 없어도 디버깅 도구는 라이브러리 저작자 자신이 1호
  소비자라는 점에서 소비자 주도 원칙과 양립한다.
- **무엇이 틀렸나**: 절차가 뒤집혔다. 같은 날 08-25 결정의 포기 목록이
  "runtime telemetry"를 보류하고 재검토 조건이 "실제 이슈가 생길 때 API
  설계부터 다시 시작한다"라고 적은 뒤, 결정 기록 없이 로컬 develop 구현이
  먼저 이뤄졌고 로드맵 문구도 구현된 범위를 서술하도록 뒤따라 수정됐다.
  "저빈도 snapshot 검토"가 쓰기 조작을 포함한 패널로 넓어진 것도 기록되지
  않았다. 이 항목은 미발행 구현의 결정 근거를 보완한다.
- **포기와 대체**: 기능 철회(경계·테스트가 온전해 철회 비용이 더 크다),
  telemetry성 자동 수집(계속 하지 않는다).
- **재검토 조건**: experimental 종료 시점은 아래 2026-08-26 0.x 성숙도 결정으로
  대체한다. 쓰기 조작이 소비자 앱에서 사고를 만들면 읽기 전용 모드를 기본으로
  뒤집는다.

### 2026-08-26 0.6·0.7 리뷰: 완료 조건 회귀 재발과 worker 생명주기

- **결정문**: 미푸시 0.6·0.7 작업 6커밋을 리뷰해 worker 생명주기 결함 군집,
  `/inspect`의 비 HTTP(S) scheme 요청, zip 실측 한도 부재를 고치고, 로드맵
  완료 조건을 검증 가능한 문구로 복원한 뒤 푸시한다. HTTP(S) URL 검사를
  Node에서 실행할 때의 SSRF 경계는 소비자 allow-list와 네트워크 정책으로
  관리하며 공개 문서에 명시한다.
- **근거**: 가짜 worker 재현 테스트로 확인한 실결함 - calibrate 중 비행
  프레임의 busy 플래그 탈취(타임스탬프 역전으로 회전 상한 무력화), 드라이버
  정리 예외 시 worker 스레드 누수, NaN 행렬의 pose가 main에서는 중립화되지만
  worker 직렬화 경로에서는 10.6도 머리 회전이 되는 분기, 응답 없는 worker의
  영구 busy. 유효한 blendshape까지 버리는 프레임 전체 기각은 하지 않는다.
  적응형 상한은 자기 벤치마크가 Firefox 프레임 95.6% 폐기를 기록한 채로
  worker 모드에 적용되고 있었다.
- **무엇이 틀렸나**: 완료 조건을 상태 보고로 바꾸는 실패 양식이 08-25에 잡힌
  지 하루 만에 재발했고, 이번에는 0.5.0 행의 Livesona 소비자 게이트가 통째로
  삭제됐다. 08-25 결정("완료 조건은 소비자 채택 문구를 유지하고 발행 여부는
  별도 상태로 적는다")의 위반이며, 리뷰가 아니라 표를 고치는 쪽이 규칙을
  이겼다. 또 하나: 33c26bd가 README 3종에 넣은 worker 문서를 024c954가
  덮어써 새 공개 서브패스가 사용자 문서 0으로 남았다. README 전면 재작성과
  기능 추가가 같은 브랜치에서 교차하면 동기화 검사(grep)가 커밋 사이에서만
  성립한다.
- **포기와 대체**: 사설 IP 차단(문서 경고와 소비자 allow-list로 대체),
  worker 프레임 큐잉(한 프레임 비행 중 유지).
- **재검토 조건**: 다음 리뷰에서 같은 완료 조건 회귀가 또 나오면 로드맵 표를
  CI가 검사하는 형식(조건 열에 "상태:" 접두 문구 강제)으로 옮긴다.

### 2026-08-26 0.6 통합과 0.x 성숙도 로드맵

- **결정문**: 아직 발행하지 않은 0.6 Worker·품질 작업과 0.7 문서·검사·Devtools를
  다음 `0.6.0` 하나로 발행한다. 당분간 1.0을 목표로 두지 않고 `0.9` 다음도
  `0.10`처럼 0.x minor로 이어간다. 다음 0.7은 API 계약 기준선·모바일 실기기·
  외부 프로젝트 온보딩·접근성/호환성/오류 안내의 안정화 묶음으로 둔다.
- **근거**: 0.6과 0.7 구현은 같은 미발행 develop 위에서 함께 리뷰됐고 문서
  사이트·Inspector·Devtools는 Worker의 사용·진단 경로이기도 하다. 인위적으로
  두 번 배포할 이득보다 한 후보를 함께 검증하는 편이 현재 규모에 맞다. 1.0을
  기준으로 experimental 상태를 미루면 실제 안정화 증거와 무관한 날짜 없는
  유예가 된다.
- **호환성 정책**: patch에서는 breaking을 금지한다. root와 `/react`는 안정
  기준선으로 관리하고, 불가피한 minor 변경은 deprecation과 migration을 먼저
  제공한다. tracking은 모바일·소비자·후속 minor 검증, inspect/devtools는 실제
  소비자·API snapshot·후속 minor 검증을 채우면 0.x에서도 stable로 올린다.
- **수요 기반 후보**: 다중 모델 Stage는 합방·대화 장면에서 다중 Canvas가 실제
  병목일 때, MotionSync는 볼륨 립싱크 한계·`.motionsync3.json`·Core/라이선스·
  비교 이득이 함께 확인될 때만 착수한다. React Native는 web subpath가 아니라
  Cubism Native SDK 기반 별도 패키지/저장소 POC로만 검토한다.
- **측정 원칙**: 외부 프로젝트 수와 10분 온보딩은 방향을 평가하는 지표이지
  특정 릴리스의 인위적인 차단 조건이 아니다. 단, 실제 온보딩에서 찾은 결함과
  호환성 파괴는 수정하지 않고 안정화를 선언할 수 없다.
- **재검토 조건**: 실제 소비자가 다중 모델·MotionSync·RN을 요구하거나 모바일
  측정이 현재 구조의 한계를 보이면 후보 우선순위를 다시 정하고, 그 근거를 새
  날짜 결정으로 남긴다.

### 2026-08-26 0.7 안정화 기준선과 남은 실기기 게이트

- **결정문**: 실제 배포 entry 7개의 API Extractor 보고서, 선택형 Canvas
  접근성, 전체 오류 code의 세 언어 해결 안내, React 18/19와 모노레포 밖
  Vanilla/Next 소비자 검증을 0.7 기준선으로 둔다. MediaPipe는 cold 시작 단계를
  Playground에서 분리 표시하고 warm tracker 생성 중앙값 5초를 회귀 기준으로
  관리한다.
- **근거**: 이번 데스크톱 3회 측정에서 warm 생성은 main/Worker 모두
  270~383ms였다. 따라서 30초 체감 지연을 추론 초기화 하나로 단정하거나 코드를
  추측으로 바꾸지 않고, 카메라·다운로드·tracker·첫 inference·보정을 각각
  관찰할 수 있게 한다. 임시 외부 Vite/Next에서는 실제 Hiyori 로드·모션·정리가
  성공해 패키지 설치 경계도 확인했다.
- **남은 조건**: 실제 iPhone Safari에서 Main/Worker 각 5분과 회전·백그라운드·
  정리를 확인하기 전에는 0.7 안정화를 완료로 표시하지 않는다. Android Chrome은
  미검증을 공개하는 비차단 항목이며, 임시 소비자 검증은 외부 채택 수로 세지
  않는다.
- **재검토 조건**: iOS Worker가 정상 동작하지 않으면 시작 단계에서 명시적
  `tracking-error`와 Main 전환 방법을 제공한다. warm 생성 중앙값이 5초를 넘는
  환경이 재현될 때만 측정된 병목을 최적화한다.
