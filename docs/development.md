# TripLOG 개발 구조

현재 앱의 브라우저 전역 구조와 CLI·서버의 공용 모델을 유지합니다. 화면 변경은 승인된 목업 범위에서 진행하고, 여행 데이터 변경은 도메인 CLI로 실행합니다.

## 파일을 추가할 위치

| 작업 | 위치와 책임 |
| --- | --- |
| 웹 진입·접속 복구 | `src/entry/`. 앱 로더, 복구 페이지, 설치 매니페스트를 관리합니다. HTML의 인라인 스크립트를 추가하지 않습니다. |
| 기본·기능별 스타일 | `src/styles/`. `base.css`가 기본 스타일을 담당합니다. |
| 브라우저·설치 아이콘 | `icons/` |
| 화면·상호작용 | `src/app/features/<기능>/`. 해당 workspace가 화면을 소유합니다. |
| 공통 UI·포맷·계산 | `src/app/ui/`, `shared/`. 화면 파일에서 공통 규칙을 복제하지 않습니다. |
| 브라우저·CLI 공통 변경 | `src/app/domain/commands.js`. 저장은 각 adapter/controller가 담당합니다. |
| 인증·파일·통신·명령 | `cli/lib/`, `cli/adapters/`, `cli/commands/` |
| 터미널 입력·화면 | `cli/tui/`. 도메인 쓰기는 adapter를 통합니다. |
| DB·Edge Function | `supabase/migrations/`, `supabase/functions/`. 이전 마이그레이션 이력은 보존합니다. |
| 회귀 검사 | `tests/*-regression.js`. 브라우저 검사는 `tests/browser-suites.js`에 등록합니다. |
| 합성 입력·격리 도구 | `tests/fixtures/`, `tests/helpers/`. 운영 세션과 여행을 사용하지 않습니다. |
| 빌드·미리보기·저장소 검사 | `scripts/`. 공통 도구는 `scripts/helpers/`에 둡니다. |
| Windows 더블클릭 실행 | `scripts/windows/`. 로컬 미리보기와 터미널 실행 파일을 둡니다. |
| 제작·검증·작업 결과 | `artifacts/design/`, `artifacts/qa/`, `artifacts/tmp/`. [보관 기준](../artifacts/README.md)을 따릅니다. |

`src/app` → 공통 모델을 CLI와 Edge가 재사용하며, 브라우저 실행 코드는 `tests/`나 `scripts/`를 참조하지 않습니다. CLI의 PDF 출력은 테스트 fixture 대신 `scripts/helpers/browser-launcher.js`를 사용합니다. 정식 미리보기는 `scripts/serve-test.js`, 합성 시나리오 미리보기는 `scripts/preview-*.js`입니다.

루트에는 진입 HTML(`index.html`, `Travel.html`), 사이트 전체를 담당하는 서비스 워커(`sw.js`), 호스트 설정(`_headers`, `_redirects`), npm·Git 설정, `README.md`와 `AGENTS.md`를 둡니다. 배포와 미리보기는 `scripts/app-assets.js`의 목록으로 저장소 위치를 공개 URL에 연결합니다. 예를 들어 `src/styles/base.css`는 `/styles.css`로, `src/entry/site.webmanifest`는 `/site.webmanifest`로 제공됩니다. 공개 URL이 필요한 새 파일을 추가할 때는 이 목록과 오프라인 캐시 포함 여부를 함께 확인합니다.

## 검증 선택

작업 체크아웃에서 `node bin/triplog.js`를 실행합니다. JSON 결과의 종료 코드와 `ok`를 함께 확인합니다.

| 변경 | 검증 |
| --- | --- |
| 소스·모듈·파일 배치·보안 규칙 | `node bin/triplog.js dev test --suite source --json` |
| CLI·공유 도메인 | `node bin/triplog.js dev test --suite cli --json` |
| 동기화·저장·권한 | `node bin/triplog.js dev test --suite sync --json`와 관련 브라우저 검사 |
| 터미널 | `node bin/triplog.js dev test --suite terminal --json`; 렌더 변경에는 `npm run test:terminal:visual` |
| 화면 동작 | `node tests/<기능>-browser-regression.js`; 전체는 `dev test --suite browser --json` |
| Edge 요청 처리 | `node bin/triplog.js dev test --suite edge --json` (CI와 같은 Deno 필요) |
| 공통 계약·저장소 재구성 | `node bin/triplog.js dev test --suite all --json` 후 전체 브라우저 검사 |
| 빌드·실행 자산 | `node bin/triplog.js dev build --json`. 생성된 `Travel.html`·`sw.js`·공용 모델도 검토합니다. |

```powershell
$env:TRIPLOG_ARTIFACT_RUN = '20261104-topic'
node bin/triplog.js dev test --suite source --json
Remove-Item Env:TRIPLOG_ARTIFACT_RUN
```

패키지 명령은 테스트 이동 뒤에도 유지됩니다. 테스트 원본의 경로는 `scripts/`에서 `tests/`로 변경됐습니다. 이전 경로는 [이동 목록](../artifacts/relocations-20261104.json)에서 찾을 수 있습니다. 작업 로그와 전체 캡처는 Git에서 제외하고, 완료된 근거만 QA에 남깁니다.

배포는 요청이 있을 때 `origin/main` 커밋·푸시와 연결된 자동 배포로 진행합니다. 빌드 지문을 계산할 때 텍스트 줄바꿈을 통일해 Windows 체크아웃과 배포 호스트에서 같은 지문을 얻습니다. 바이너리와 체크섬을 고정한 OCR 파일은 원본 바이트를 사용합니다. 로컬 빌드와 운영 반영은 각각 확인합니다.
