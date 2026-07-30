# live2d-jsx 문서 지도

상태 기준일: **2026-07-30**. v0.1 alpha 구현은 완료됐고 npm 공개 전이다.

1. [생태계 조사](ecosystem-survey.md)
2. [제품 비전](product-vision.md)
3. [아키텍처](architecture.md)
4. [API reference](api-design.md)
5. [AIZUCHI 추출 지도](extraction-map.md)
6. [라이선스와 상표](licensing.md)
7. [로드맵](roadmap.md)

## 확정된 결정

- 일반 React 컴포넌트·Context·hooks를 사용하며 custom reconciler는 만들지 않는다.
- 단일 npm 패키지와 `adapters/pixi-v6` subpath를 사용한다.
- v0.1은 Stage당 모델 하나다.
- 자동 품질이 기본이며 고정 `resolution`은 명시적 opt-out이다.
- 프레임 순서는 모델 update → after-motion driver → frame callback → render다.
- root import에는 PIXI가 없고 adapter의 Live2D 런타임 import도 SSR-safe하게 지연한다.
- Core·Framework·샘플 모델은 동봉하지 않는다.
- 장기 native 목표는 브라우저 직접 WebGL 백엔드다.
- 첫 도그푸딩은 v0.2 AIZUCHI 전환이다.
