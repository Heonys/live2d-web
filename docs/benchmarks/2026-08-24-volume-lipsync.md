# 볼륨 립싱크 드라이버 패키지 변화 — 2026-08-24

`develop`의 기준 커밋 `04ca1304`에 `createVolumeLipSync()`와 공개 문서·패키지
검증을 더한 작업 트리를 `pnpm verify:package`로 측정했다. 비교 대상은 같은 날
기록한 [v0.3.1 안정화 기준선](2026-08-24-v0.3.1-baseline.md)이다.

| 항목 | v0.3.1 기준선 | 볼륨 드라이버 추가 | 변화 |
| --- | ---: | ---: | ---: |
| root entry raw | 0.68 kB | 2.61 kB | +1.93 kB |
| root entry gzip | 0.34 kB | 1.10 kB | +0.76 kB |
| runtime chunk raw | 32.02 kB | 32.02 kB | 0 kB |
| runtime chunk gzip | 8.65 kB | 8.65 kB | 0 kB |
| tarball 압축 크기 | 124.8 kB | 125.7 kB | +0.9 kB |
| tarball 해제 크기 | 664.8 kB | 667.4 kB | +2.6 kB |
| tarball 파일 수 | 31 | 31 | 0 |

React entry(21.26/5.49 kB), cubism-webgl entry(20.52/3.16 kB), Framework/model
chunk(515.98/89.62 kB)는 raw/gzip 모두 변하지 않았다. root의 정적 의존 그래프는
100 kB 예산 안에 있고 React, Cubism Framework, Pixi, wLipSync runtime을 새로
정적 포함하지 않았다. wLipSync는 기존처럼 브라우저 시점 동적 import다.

이 기록은 패키지 경계와 배포 크기 회귀만 다룬다. 버전은 `0.3.1`로 유지하며,
Livesona가 이 헬퍼로 전환하기 전에는 로드맵 0.4의 소비자 완료 조건을 충족한
것으로 보지 않는다.
