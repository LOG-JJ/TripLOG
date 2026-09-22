# Pocket Passport 운영 배포 — 2026-09-22

## 후속 배포 · 티켓 절취 가장자리

- 운영 주소는 동일하다. 최신 배포: https://aac01ff5.triplog-5qs.pages.dev (`main` production).
- 빌드: `5862d0d8ad046cafd4f2`.
- 변경: NEXT STOP의 왼쪽 테두리를 생성된 종이 절취 이미지로 교체. 172개 파일 중 변경된 4개 업로드, 168개 재사용.
- 운영 HTML, 서비스 워커, companion CSS, 새 PNG의 HTTP 200 및 로컬 빌드와 SHA-256 일치 확인.
- 로컬 및 운영 origin의 companion 브라우저 회귀 통과. 운영 검사 캡처: `C:/Users/tbdk5/AppData/Local/Temp/TripLOG-Ticket-Edge-Production-20260922/`.

## 최초 2안 배포

- 사용자 요청: 완료한 2안 디자인의 실제 서비스 배포.
- 운영 주소: https://triplog-5qs.pages.dev/Travel?page=overview
- Cloudflare Pages 프로젝트: `triplog`, production branch: `main`.
- 이번 배포 주소: https://f92aa351.triplog-5qs.pages.dev
- 직전 production 배포: `757b110b-641a-4c79-a9cc-94aa2e003e21`.
- 배포 빌드: `81656a701dd6ca26e8af` (내용으로 자동 생성).
- `npm run build`로 생성한 `dist`를 Wrangler 4.136.1로 직접 업로드했다. 171개 파일 중 변경된 9개 업로드, 나머지 162개 재사용. 작업 트리 변경 포함 배포임을 `--commit-dirty=true`로 기록했다.
- 코드 및 자산 배포이며 데이터베이스 마이그레이션이나 Edge Function 배포는 수행하지 않았다.

## 배포 후 검증

1. 운영 주소에서 HTML, 앱 로더, 서비스 워커, companion JS/CSS, 노트 표지/스케치, 이동 정보 JS/CSS를 받아 로컬 빌드와 SHA-256을 비교했다. 모두 HTTP 200이며 바이트 단위로 일치했다.
2. 실제 운영 origin을 `TRIPLOG_TEST_URL`로 지정한 `companion-passport-browser-regression.js`가 통과했다. 새 격리 브라우저의 가상 계정/여행을 사용하고 외부 요청을 차단해 실제 여행 데이터나 Supabase를 변경하지 않았다.
3. 검사 범위: 완료/취소, 날짜/탭 이동, 조정안 비교, 잠금, 시간 적용/되돌리기, 이동 정보 열기, 준비물 저장/재접속/실패 복원, 포켓노트 다운로드와 제외 옵션, ICS 시간대, 예약 탭, 빈 상태/긴 장소명/모바일 화면.
4. 운영 origin 캡처 위치: `C:/Users/tbdk5/AppData/Local/Temp/TripLOG-Passport-Production-20260922/`.
5. Codex in-app browser에서도 운영 로그인 화면의 초기화와 사용 가능한 로그인 버튼, 콘솔 오류 없음(0건)을 확인했다. 운영 사이트 탭을 사용자 확인용으로 남겼다.

배포 상태: 완료. 기존 운영 URL을 그대로 사용한다.
