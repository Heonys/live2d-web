# 릴리스 체크리스트

자동 게이트가 잡지 못하는 것을 사람이 확인하는 목록이다. 발행마다 이 문서를
위에서 아래로 따라간다. 항목을 빼려면 이유를 docs/README.md에 결정으로 남긴다.

## 1. 자동 게이트가 초록인지

`release.yml`이 태그 커밋에 다시 적용하지만, 태그를 올리기 전에 develop·main의
마지막 push 결과를 본다.

- lint · typecheck · unit
- `verify:package` (경계·크기·`.task`/`.wasm` 부재) · `verify:packed-consumers` (tarball 소비자 4종)
- `browser-e2e` 3엔진 (Cubism Core·Hiyori, push에서만)
- `tracking-e2e` 3엔진 (Firefox는 Xvfb headed, 적응형 상한으로 10fps)
- `tracking:soak` Chromium Worker 5분 (릴리스 workflow 전용)

## 2. 사람이 확인하는 것

- **실제 카메라 10분.** Playground 웹캠 데모를 Hiyori(표준 매핑)로 연다.
  고개를 위·아래·좌·우로 돌렸을 때 모델이 같은 방향으로 따라오는지, 눈을
  감으면 감기는지, 입을 벌리면 벌어지는지. CI는 정지 초상뿐이라 부호가
  뒤집혀도 잡지 못한다. Perfect Sync 모델이 있으면 같은 확인을 한 번 더.
- **soak.** 트래킹은 릴리스 5분, 주간 15분을 자동 실행한다. 문제 조사 때
  `LIVE2D_TRACKING_SOAK_MINUTES=120 pnpm test:tracking:soak`를 수동 실행한다.
  일반 Hiyori 120분 soak는 렌더 루프·정리·캐시 결함을 조사할 때만 실행하며,
  짧은 tracking soak를 장기 누수 부재의 증명으로 해석하지 않는다.
- **README 3종 동기화.** 새 공개 이름이 `README.md`·`README.ko.md`·
  `README.ja.md`에 모두 있는지 `grep`으로 확인한다. 08-24에 JA만 문장이
  유실된 적이 있다.
- **문서 기준일.** `docs/roadmap.md` 버전 표의 상태, `docs/compatibility.md`와
  `docs/api-design.md`의 기준일·버전 문구.

## 3. 발행

1. `CHANGELOG.md`의 `## Unreleased`를 `## x.y.z - YYYY-MM-DD`로 바꾼다.
   `release.yml`은 첫 `## ` 절을 릴리스 노트로 쓴다.
2. `packages/live2d-web/package.json`의 `version`을 같은 값으로. 태그와 다르면
   워크플로가 실패한다.
3. develop → main 병합. main의 `browser-e2e`·`tracking-e2e`가 초록인지 본다.
4. `git tag vx.y.z && git push origin vx.y.z`. 태그 푸시가 발행이다. 게이트가
   `npm publish`보다 앞에 있으므로 여기서 실패하면 발행은 일어나지 않는다.
   고친 뒤 `git push --delete origin vx.y.z`로 태그를 지우고 다시 올린다.
5. Actions `Release` 잡이 끝나면 npm 페이지에서 버전과 provenance 배지를
   확인한다.

## 4. 발행 뒤

- GitHub Release 노트가 CHANGELOG 절과 같은지.
- `docs/roadmap.md` 성장 지표에 측정일과 함께 수치를 적는다(외부 의존, 주간
  다운로드).
- 소비자(Livesona 등)에 버전 범프 이슈를 남긴다. 소비자 채택이 로드맵의
  완료 조건이다.
- `## Unreleased` 절을 새로 연다.
