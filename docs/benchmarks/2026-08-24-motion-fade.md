# 모션 페이드 옵션 패키지 변화 — 2026-08-24

`develop`의 기준 커밋 `782b110`과 모션 페이드 작업 트리를 각각
`pnpm verify:package` 결과로 비교했다. 기준 커밋의 값은 같은 커밋에서 기록한
[볼륨 립싱크 측정](2026-08-24-volume-lipsync.md)이며, 현재 값은 문서 작성 직전
다시 빌드해 측정했다.

| 항목 | 작업 전 (`782b110`) | 모션 페이드 추가 | 변화 |
| --- | ---: | ---: | ---: |
| root entry raw / gzip | 2.61 / 1.10 kB | 2.61 / 1.10 kB | 0 / 0 kB |
| runtime chunk raw / gzip | 32.02 / 8.65 kB | 32.02 / 8.65 kB | 0 / 0 kB |
| cubism-webgl entry raw / gzip | 20.52 / 3.16 kB | 20.52 / 3.16 kB | 0 / 0 kB |
| Framework/model chunk raw / gzip | 515.98 / 89.62 kB | 518.15 / 90.17 kB | +2.17 / +0.55 kB |
| tarball 압축 크기 | 125.7 kB | 126.4 kB | +0.7 kB |
| tarball 해제 크기 | 667.4 kB | 670.1 kB | +2.7 kB |
| tarball 파일 수 | 31 | 31 | 0 |

React entry(21.26/5.49 kB), WebGL stage chunk(15.45/4.48 kB)도 raw/gzip이
변하지 않았다. 증가분은 기본 backend의 모션 버퍼 캐시, 재생별 파싱 객체와
소유권 처리에만 들어갔다. root의 정적 그래프는 기존 100 kB 예산 안에 있고
React, Cubism Framework, Pixi, wLipSync runtime을 새로 정적 포함하지 않는다.

합성 motion3 브라우저 검증에서는 `fadeInMs: 0`과 긴 페이드의 초기 파라미터
궤적이 달랐고, 파라미터별 페이드는 전체 옵션보다 우선했다. 같은 캐시에서
옵션 재생 뒤 기본 재생을 시작해도 앞선 설정은 남지 않았다. 실제 Hiyori에서의
체감 비교만 ignored private 체크리스트로 남겼다. 버전은 `0.3.1`로 유지하며
로드맵 0.4는 완료 처리하지 않는다.
