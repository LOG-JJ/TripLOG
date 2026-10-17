# TripLOG CLI 구현 검증

2026-10-18, Windows / Node.js 24.11.0 / 설치된 Edge에서 검증했습니다. 실제 계정, 운영 여행 데이터, Git 푸시, 운영 배포는 사용하지 않았습니다.

## 구현 범위

- 여행, 일정, 지출, 준비물, 동행인, 예약, 정산, 공동 메모, 댓글, 첨부파일, 멤버, 초대, 공유 설정, 백업, 변경 이력.
- cloud 모드의 기존 `triplog-sync` 프로토콜과 file 모드의 앱 JSON 백업.
- 필드 버전 충돌, 명시적 삭제, 요청 기록과 동일 요청 재시도, 계정·프로젝트 경계, 원자적 파일 교체와 잠금.
- `dev serve/test/build/doctor/artifacts`, 범위를 지정한 `dev deploy plan/run/status`.
- JSON, CSV, HTML, PDF, ICS 내보내기. PDF는 기존 포켓노트와 전체 지출 표를 사용합니다.

## 결과

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| `npm test` | 통과 | 기존 단위·PostgreSQL·IndexedDB·동기화·기능 회귀 및 CLI 검사 |
| `npm run test:cli` 최종 실행 | 통과 | 204개 프로세스 단위 assertion 및 직접 SQL·파일·배포 플로우 assertion |
| `npm run test:browser` | 통과 | CLI 연동을 포함한 40개 등록 스위트 전체 |
| 도시 삽화 렌더 | 통과 | 635개 목적지 × 320/390/599/1440px = 2,540개 조합 |
| `node bin/triplog.js dev build --json` | 통과 | 실제 `npm run build`, 생성 지문·서비스 워커·dist 생성 |
| `npm run test:source` | 통과 | 앱 110개 모듈, CSS 29개, CLI 19개 모듈 문법·배포 제외 검사 |
| `npm run artifacts:check` | 통과 | 산출물 위치와 배포 제외 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| 기존 작업 보존 | 통과 | README·빌드 생성 파일을 제외한 기존 수정 14개와 시작 시점 diff 일치 |
| PDF 육안 검증 | 통과 | A4 2쪽을 PNG로 렌더해 한글·표·줄바꿈·페이지 경계 확인 |

CLI 테스트는 실제 `supabase/migrations`의 PostgreSQL 함수를 PGlite로 실행하는 격리 HTTP 서버를 사용합니다. 응답 유실 후 재시도해도 지출이 중복되지 않는지, 같은 필드 동시 수정이 충돌하는지, 조회 전용 멤버의 쓰기가 차단되는지 확인했습니다. 댓글·Yjs 공동 메모·첨부파일의 백업/복원, 정산 확정, 서버 이력 복원, 멤버 프로필·소유권 이전·탈퇴도 검증했습니다. 종료된 프로세스의 잠금 복구와 살아 있는 프로세스의 잠금 보존을 검사했습니다.

배포는 모의 Git 실행으로 선택하지 않은 파일·기존 상태의 보호, 검증→빌드→생성 파일 포함→커밋→푸시 순서, 푸시 완료와 운영 반영 확인의 분리를 검증했습니다. 실제 커밋·푸시는 하지 않았습니다.

## 브라우저 경로

Browser 전용 플러그인/스킬이 제공되지 않아 저장소의 Playwright·Edge 경로를 사용했습니다. 테스트 흐름은 CLI 여행 생성 → 웹 일정 표시 → 웹에서 메모 저장 → CLI 조회 → CLI 장소·교통비 수정 → 웹 반영입니다. 1440×1000과 390×844에서 앱 내용·화면 식별·가로 넘침·편집 동작·콘솔을 확인했습니다.

애플리케이션 예외와 관련 콘솔 오류는 없습니다. 외부 Google Fonts·Pretendard CDN·OpenStreetMap 요청은 격리를 위해 차단했으며 그에 따른 네트워크 오류를 [브라우저 결과](browser-result.json)에 구분해 기록했습니다. 실제 지도 검색 품질이나 운영 인증 서버의 가용성을 검사한 결과는 아닙니다.

## 대표 자료

- [CLI 결과](cli-result.json)
- [브라우저 결과](browser-result.json)
- [PC 웹 반영](cli-web-desktop.png)
- [모바일 웹 반영](cli-web-mobile.png)
- [PDF 첫 페이지](pdf-page-1.png)
- [PDF 지출 표 페이지](pdf-page-2.png)
- [사용법](../../../docs/cli.md)

보존한 JSON 2개와 PNG 4개는 임시 원본과 SHA256이 일치합니다. 임시 폴더 일괄 삭제는 자동 승인 검토에서 정책상 차단되어 실행하지 않았습니다. 전체 테스트 캡처·작업 파일은 Git과 배포에서 제외되는 `artifacts/tmp/20261018-cli/` 및 초기 실행의 `artifacts/tmp/20261017/cli/`, `artifacts/tmp/20261017/cli-browser/`에 남아 있습니다.

## 적용 범위

Windows 저장형 로그인은 DPAPI를 사용하며 다른 OS에서는 환경변수 사용자 토큰을 사용합니다. 서버 모드는 브라우저의 미전송·비공개 데이터를 직접 읽지 않습니다. 신규 음수 지출과 음수 지출의 정산 확정은 기존 서버 규약에 따라 제한되며, 기존 환불 데이터는 조회·리포트·파일 백업에서 보존합니다. Supabase DB·Edge Function 코드는 변경하거나 운영 배포하지 않았습니다. Deno는 이 환경에 설치되지 않았으며 별도의 `test:edge` 실행은 이번 CLI 변경의 검증에 포함하지 않았습니다.
