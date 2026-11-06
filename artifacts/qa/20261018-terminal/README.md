# TripLOG 터미널 구현·검증

2026-10-18 KST. 기존 명령형 CLI에 실제 문자 셀 기반 대화형 터미널 화면을 추가했다. 실행은 `npm run terminal`, 독립 예시는 `npm run terminal:demo`, Windows 더블클릭 실행은 프로젝트 루트의 `TripLOG.cmd`다.

## 화면과 디자인

[T2I 원안](../../design/20261018-terminal/triplog-terminal-concept.png)의 색상과 정보 구조를 바탕으로 구현했다. 아래 이미지는 **제품 코드가 출력한 ANSI를 xterm에서 렌더링한 검증 캡처**다. 브라우저용 앱 화면을 별도로 만든 것이 아니며, Windows Terminal 자체의 OS 스크린샷도 아니다. 실제 PowerShell PTY 동작은 별도 확인했다.

| 확인 대상 | 대표 캡처 |
| --- | --- |
| 120열 × 38행 전체 화면, 왼쪽 메뉴 선택 | [home-wide-120x38.png](home-wide-120x38.png) |
| 80열 × 24행 압축 화면 | [home-compact-80x24.png](home-compact-80x24.png) |
| 60열 × 20행 최소 화면 | [home-minimum-60x20.png](home-minimum-60x20.png) |
| 한글 일정 입력 | [itinerary-form-120x38.png](itinerary-form-120x38.png) |
| 변경 내용과 실행 전 확인 | [save-confirmation-120x38.png](save-confirmation-120x38.png) |
| 개발 도구 | [development-120x38.png](development-120x38.png) |
| 가상 비밀번호 마스킹 | [login-masked-120x38.png](login-masked-120x38.png) |

각 캡처는 임시 출력 원본과 SHA256을 비교했다. [capture-hashes.json](capture-hashes.json)에 원본 경로와 해시를 기록했다. 13개 전체 검증 화면·ANSI·문자 출력은 `artifacts/tmp/20261018-terminal/terminal-visual/`에 있다. 터미널의 글꼴·줄 높이·색상 지원에 따라 실제 표시 모양은 달라질 수 있다.

## 동작 검증

- `npm test`: 전체 통과. 기존 CLI의 **204개 프로세스 검증**과 SQL·권한·재시도·백업·배포 계획 회귀 검사를 포함한다. 마지막 입력 복구·도움말·미리보기 문구 수정 뒤 해당 터미널·소스 검사를 다시 통과했다.
- `npm run test:terminal`: 통과. [terminal-result.json](terminal-result.json)에 시나리오 목록을 기록했다. 4개 창 크기의 메뉴·본문, 미리보기·취소·저장, 한글·이모지 편집, 비밀번호의 정확한 문자 보존, 붙여넣기 격리, 파일·서버 충돌, 공유 설정의 동시 변경, 취소된 연결 결과 무시, 새 여행 파일, 숙소 날짜별 일정, 외화 수정, 준비물·동행인, 메모·댓글, 백업·정산, 보관·복원, 번호 메뉴, TTY 복구와 하위 작업 종료를 검사했다.
- `npm run test:terminal:visual`: **13개 화면 통과**. 실제 ANSI 출력과 xterm 문자 셀을 전부 비교했으며 화면 밖 스크롤·페이지 오류가 없었다. [visual-result.json](visual-result.json).
- PowerShell PTY: `S` → 한글 `검증 산책` 입력 → `Ctrl+S` 확인 화면 → `Esc`로 입력 보존 확인. `Q` 종료에서 원래 화면·커서 복구를 확인했다. 별도 계측에서 Node의 정상 종료 코드 0을 확인했다. [native-exit.txt](../../tmp/20261018-terminal/native-exit.txt). 실행 도구의 PTY 래퍼는 1을 보고했지만 Node 자체의 종료 로그는 0이었다.
- `npm run test:source`, `npm run artifacts:check`, `npm run build`: 통과. 빌드 산출물에 CLI·테스트 목업을 포함하지 않는다. `Travel.html`과 `sw.js`의 생성 변경을 유지했다.
- 기존 작업 14개는 작업 전 diff와 비교해 보존을 확인했다.

전체 테스트 로그와 빌드 로그는 `artifacts/tmp/20261018-terminal/`에 보관했다. 클라우드 데이터 검사는 저장소의 실제 SQL 함수를 사용하는 격리 HTTP/DB fixture에서 수행했다. 실제 사용자 계정 로그인·운영 데이터 쓰기·Git 커밋/푸시·자동 배포는 실행하지 않았다.

## 사용 범위

기본 화면은 Node 내장 입력·출력 모듈로 실행한다. xterm 패키지는 검증 전용 개발 의존성이다. 서버 모드는 기존 로그인·권한·동기화 API를 사용하며 브라우저의 미전송·비공개 데이터를 읽지 않는다. 파일 모드는 확인 후 선택한 JSON 원본에 저장하며, 체험 모드는 매번 별도의 예시 JSON을 사용한다. 긴 확인 내용은 PgUp/PgDn으로 끝까지 볼 수 있고 기본 선택은 취소다.

상세 키와 메뉴는 [CLI 사용법](../../../docs/cli.md#대화형-터미널)을 참고한다. 인증 방식은 기존 이메일·비밀번호 흐름을 유지했으며 [Supabase 공식 문서](https://supabase.com/docs/guides/auth/passwords)와 [2026-10 TLS 변경 안내](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)를 확인했다. 새 Supabase 기능·스키마·정책·서버 배포는 추가하지 않았다.
