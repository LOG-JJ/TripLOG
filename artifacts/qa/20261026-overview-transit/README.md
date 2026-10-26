# 모바일 지출 구성·이동 저장 오류 수정

## 사용자 요청

- 모바일 개요의 지출 구성에서 `교통`, `식비` 등이 한 글자씩 세로로 줄바꿈되는 현상을 수정한다.
- 이동 정보 직접 기록에서 기차로 저장할 때 실제 변경 없이 `일정이 다른 곳에서 변경됐어요…` 경고가 나타나는 오류를 수정한다.

## 수정과 재현

지출 구성의 항목명은 줄바꿈하지 않는다. 600px 이하에서는 기존 3열 구성과 44px 터치 영역을 유지하면서 항목명 아래에 비율을 배치해 서로 폭을 빼앗지 않도록 했다. 긴 가져오기 분류명은 말줄임하되 원문은 기존 title·접근성 이름에 유지한다. 6개 분류, `1% 미만`, 320·390·430px, 16px/14px로 확대한 글자에서 한 줄 표시·겹침·잘림을 검사했다. 수정 전에는 320px 확대 글자의 `기타`가 두 줄이 되어 새 회귀 검사가 실패했고, 수정 후 모두 통과했다. 사용자가 첨부한 실제 iPhone 화면은 `reported-mobile.png`에 보존했다.

이동 저장은 일정을 그대로 동기화 모델의 encode/decode로 왕복시킨 뒤 저장하는 테스트에서 기존 경고를 재현했다. 실제 항목 값은 같지만 객체 키 순서와 내부 `_syncPosition`이 달라지면 원래 문자열 비교가 실패했다. 기존 동기화 모델의 값 비교를 사용하고 일정·이전 장소·연결 지출의 내부 위치값만 비교에서 제외했다. 실제 이전 장소·목적지·여행 확인과 다른 모든 내용 비교는 유지한다. 지도 앱에서 돌아올 때의 임시 기록 검사도 같은 비교를 사용하며 기존 sessionStorage 기록 형식은 바꾸지 않았다.

수정 후 기차/31분으로 저장하고 새로고침해 값이 유지되는 것을 확인했다. 실제 목적지 시간, 이동 내용, 출발지, 중간 경유 일정 추가, 연결 지출 금액이 변경된 다섯 경우에는 계속 경고하고 최신 데이터를 덮어쓰지 않는 것을 각각 확인했다.

## 검증

Browser 플러그인을 사용할 수 없어 프로젝트의 Playwright/Edge 격리 fixture를 사용했다. 여행·일정·지출은 가상 데이터이며 실제 사용자 계정이나 운영 여행을 수정하지 않았다. 지도 요청은 테스트용 응답 또는 차단된 외부 요청으로 처리한다.

| 검사 | 실제 결과 |
| --- | --- |
| `node scripts/travel-costs-browser-regression.js` | 통과: 6개 분류 가로 표시, 확대 글자, 비율·색상·합계, 기존 카드 높이·PC 배열, 키보드 내역 이동, 추가·수정·삭제·환불·저장·새로고침, 320~1440px |
| `node scripts/transit-journey-browser-regression.js` | 통과: 내용이 같은 동기화 후 기차 저장/새로고침, 실제 충돌 다섯 종류 차단·현재 값 보존, 기존 색상·구간·시간·입력 검사, 지도 왕복 임시 기록, 320~1536px |
| `node scripts/domestic-route-browser-regression.js` | PC·모바일 통과: 국내 지도, 캐시·위치 조회·변경·실패·닫힌 창 보호, 네이버지도 왕복 임시 기록 |
| `node scripts/map-provider-browser-regression.js` | PC·모바일 통과: 국내/해외 지도·이동 수단·좌표 없음·전일 구간·오늘·예약·임시 기록 |
| `node scripts/travel-costs-regression.js` | 통과: 합계·외화 환산·선구매·환불·공통 집계·작은 비율 |
| `node bin/triplog.js dev test --suite sync --json` | 종료 0, `ok: true`; 실제 충돌·재시도·오프라인·다중 탭·연결 지출 원자성·정규화 검사 포함 |
| `node bin/triplog.js dev test --suite source --json` | 종료 0, `ok: true` |
| `node bin/triplog.js dev build --json` | 종료 0, `ok: true`; Travel.html·sw.js 빌드 지문 갱신 |
| `node bin/triplog.js dev artifacts --json` | 종료 0, `ok: true` |

관련 브라우저 검사에서 앱 런타임 오류는 없었다. 실제 iPhone/Safari 엔진은 이 Windows 환경에서 실행하지 못했으며 모바일 너비와 확대 글자로 검증했다. 실제 서버에서 사용자 여행을 편집한 결과로 해석하지 않는다.

대표 캡처·복사 원본의 SHA256과 빌드 지문은 `verification.json`에 있다. 전체 출력은 `artifacts/tmp/20261026-overview-transit/`, 수정 전 재현 자료는 `artifacts/tmp/20261026-overview-transit-before/`다. 로컬 수정·검증·빌드 완료. 이번 변경의 Git 커밋·푸시·운영 배포는 실행하지 않았다.
