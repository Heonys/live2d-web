# 어댑터 적합성 검증

v0.1은 다음 세 층을 함께 적합성 게이트로 사용한다.

1. `src/core/*.test.ts`: backend-neutral 품질·프레이밍·정리 계약
2. `src/react/Live2DStage.test.tsx`: fake backend를 통한 Stage/Model 핸들,
   StrictMode 20회, abort, invalid tree, retry와 dispose 순서
3. `e2e/playground.spec.ts`: 실제 pixi-v6 + Core + Hiyori를 사용한
   Chromium/WebKit 렌더링, 반복 mount, 모바일 정책과 context loss

미래 어댑터는 1·2를 변경 없이 통과하고, 3과 같은 실제 모델 브라우저
테스트를 자신의 subpath로 추가해야 한다.
