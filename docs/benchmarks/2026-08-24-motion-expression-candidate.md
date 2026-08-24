# 0.4 모션·표정 후보 패키지 변화 — 2026-08-24

`develop`의 모션 페이드 기준 커밋 `cd11cd0` 다음에 상세 모션 상태·시퀀스,
Idle 가중 랜덤과 표정 페이드를 추가한 0.4 후보를 `pnpm verify:package`로
측정한다. v0.3.1 값은 [안정화 기준선](2026-08-24-v0.3.1-baseline.md),
`cd11cd0` 값은 [모션 페이드 측정](2026-08-24-motion-fade.md)에서 가져왔다.

| 항목 | v0.3.1 기준선 | `cd11cd0` | 0.4 후보 | `cd11cd0` 대비 |
| --- | ---: | ---: | ---: | ---: |
| root entry raw / gzip | 0.68 / 0.34 kB | 2.61 / 1.10 kB | 2.61 / 1.11 kB | 0 / +0.01 kB |
| runtime chunk raw / gzip | 32.02 / 8.65 kB | 32.02 / 8.65 kB | 34.15 / 9.13 kB | +2.13 / +0.48 kB |
| cubism-webgl entry raw / gzip | 20.52 / 3.16 kB | 20.52 / 3.16 kB | 20.52 / 3.16 kB | 0 / 0 kB |
| Framework/model chunk raw / gzip | 515.98 / 89.62 kB | 518.15 / 90.17 kB | 520.64 / 90.64 kB | +2.49 / +0.47 kB |
| tarball 압축 / 해제 크기 | 124.8 / 664.8 kB | 126.4 / 670.1 kB | 129.3 / 683.1 kB | +2.9 / +13.0 kB |
| tarball 파일 수 | 31 | 31 | 32 | +1 |

React entry는 22.44/5.76 kB로 `cd11cd0`보다 raw/gzip +1.18/+0.27 kB,
WebGL stage chunk는 15.45/4.48 kB로 변화가 없다. 공용 검증·시퀀스·Idle 코드가
들어간 shared chunk는 4.00/1.22 kB다. root의 정적 의존 그래프는 React, Cubism
Framework, Pixi와 wLipSync runtime을 포함하지 않으며 100 kB 예산을 유지한다.

검증은 상태 tracker와 sequence·Idle·표정 옵션의 순수 단위 테스트, 합성
motion3/exp3를 사용한 Playwright 궤적 비교, Playground 프리셋과 Canvas 정리를
포함한다. 실제 Hiyori에서의 전환 감각·장시간 분포처럼 자동 판정하기 어려운
항목만 ignored private 체크리스트에 남긴다. 0.4 상태는 라이브러리 구현 완료,
소비자 검증 대기이며 버전은 `0.3.1`로 유지한다.
