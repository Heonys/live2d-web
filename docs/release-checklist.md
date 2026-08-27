# 릴리스 체크리스트

자동 게이트가 잡지 못하는 것을 사람이 확인하는 목록이다. 발행마다 이 문서를
위에서 아래로 따라간다. 항목을 빼려면 이유를 docs/README.md에 결정으로 남긴다.

## 1. 자동 게이트가 초록인지

`release.yml`이 태그 커밋에 다시 적용하지만, 태그를 올리기 전에 develop·main의
마지막 push 결과를 본다. **WebKit 트래킹은 릴리스 잡이 재현할 수 없으므로 이
확인이 유일한 게이트다.** 릴리스 잡은 Linux 하나라 Chromium·Firefox만 다시
돌린다.

- lint · typecheck · unit
- `verify:package` (경계·크기·`.task`/`.wasm` 부재) · `verify:packed-consumers` (tarball 소비자 4종)
- `browser-e2e` 3엔진 (Cubism Core·Hiyori, push에서만)
- `tracking-e2e` 3엔진 (Chromium·Firefox는 Linux, **WebKit은 macOS**. Firefox는
  Xvfb headed, 적응형 상한으로 10fps)
- `tracking:soak` Chromium main+Worker 총 5분, 모드당 2.5분 (릴리스 workflow 전용)

## 2. 사람이 확인하는 것

- **실제 카메라 10분.** Playground 웹캠 데모를 Hiyori(표준 매핑)로 연다.
  고개를 위·아래·좌·우로 돌렸을 때 모델이 같은 방향으로 따라오는지, 눈을
  감으면 감기는지, 입을 벌리면 벌어지는지. CI는 정지 초상뿐이라 부호가
  뒤집혀도 잡지 못한다. Perfect Sync 모델이 있으면 같은 확인을 한 번 더.
- **soak.** 트래킹은 main과 Worker를 합쳐 릴리스 총 5분(각 2.5분), 주간
  총 15분(각 7.5분)을 자동 실행한다. `LIVE2D_TRACKING_SOAK_MODES`로 한 모드만
  선택하면 설정한 전체 시간을 그 모드가 사용한다. 문제 조사 때
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
   특히 `tracking-e2e (webkit, macos-latest)`는 릴리스 잡이 다시 돌리지 않으니
   여기서 반드시 확인한다.
4. **공개 사이트 배포가 main을 따라잡은 것을 확인한 뒤에만 태그를 올린다.**
   (2026-08-27부터 Vercel이 `apps/playground`를
   <https://live2d-web.heonys.dev>에 배포한다. **소유한 도메인이므로 배포
   업체를 옮겨도 이 주소는 유지된다.** 앞선 배포 업체 이전 때
   업체 도메인을 쓴 탓에 이미 발행된 npm 0.6.0 페이지에 404 링크 넷이
   영구히 남았고, 그것을 되풀이하지 않으려고 도메인을 샀다. 발행된 README는
   고칠 수 없으므로 **주소를 바꾸려면 반드시 npm 발행 전에** 한다.
   `live2d-web-playground.vercel.app`은 살려 두어 0.6.0의 링크가 계속
   동작하게 한다. 주소가 바뀌면 여기와 README 3종·npm README·
   `docs/README.md`·`docs/roadmap.md`·`apps/playground/src/lib/siteOrigin.ts`를
   함께 고친다.)
   README 3종·npm README·docs/README.md가 `/docs/*`·`/playground` 같은 배포
   경로를 링크하는데, npm 발행이 배포보다 앞서면 패키지 페이지의 링크가
   404인 채 공개된다. `content/docs/*/examples.mdx`의 `tree/main/examples`
   링크도 main 병합 전에는 404다.
5. `git tag vx.y.z && git push origin vx.y.z`. 태그 푸시가 발행이다. 게이트가
   `npm publish`보다 앞에 있으므로 여기서 실패하면 발행은 일어나지 않는다.
   고친 뒤 `git push --delete origin vx.y.z`로 태그를 지우고 다시 올린다.
6. Actions `Release` 잡이 끝나면 npm 페이지에서 버전과 provenance 배지를
   확인한다.

## 4. 발행 뒤

- GitHub Release 노트가 CHANGELOG 절과 같은지.
- `docs/roadmap.md` 성장 지표에 측정일과 함께 수치를 적는다(외부 의존, 주간
  다운로드).
- 소비자(Livesona 등)에 버전 범프 이슈를 남긴다. 소비자 채택이 로드맵의
  완료 조건이다.
- `## Unreleased` 절을 새로 연다.
