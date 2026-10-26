# 시간 선택창 크기 조정 검증

사용자 요청: 기존 시간 입력칸에 비해 큰 시간 선택창의 가로·세로를 줄인다.

## 변경

- 공통 시간 선택기를 유지하고, 고정 304px 대신 입력칸 폭에 맞춘다. 좁은 화면의 버튼 가독성을 위해 최소 152px, 넓은 입력칸에서는 최대 224px로 제한한다.
- 시간·분 휠은 5줄에서 3줄로 줄이고 여백·숫자·하단 버튼도 함께 축소했다. 마우스에서는 28px, 터치에서는 32px 행을 사용한다.
- 휠 중앙 클릭 계산은 실제 CSS 패딩을 읽어 3줄에서도 정확히 동작한다. 입력칸 폭 변경 시 열린 선택창 폭도 다시 계산한다.
- 일정·예약의 같은 컴포넌트에 적용되며, 데이터 계약이나 저장 방식은 바꾸지 않았다.

## 실제 크기

| 환경 | 입력칸 폭 | 변경 전 선택창 | 변경 후 선택창 |
| --- | ---: | ---: | ---: |
| PC 1440×1100 | 168.5px | 304×306px | 169×166px |
| 터치 390×844 | 170px | 304×348px | 170×180px |
| 터치 320×844 | 138px | 296×348px | 152×180px |
| 터치 가로 640×360 | 295px | 304×336px | 224×180px |

변경 전 가로 화면의 높이는 기존 뷰포트 제한값이다. 모든 변경 후 화면에서 가로 넘침이 없고, 시간 없음·확인 글자가 잘리지 않는다. `after-metrics.json`은 독립된 컨텍스트별 측정, `size-checks.json`은 선택창이 열린 채 화면 크기를 바꾼 결과다.

## 검증

검증 경로: 격리된 로컬 `/Travel?page=itinerary` → 일정 추가 → 시간 선택창 → 스크롤·입력·확인 → 저장·새로고침. 예약 화면에서도 같은 컴포넌트를 확인했다. Browser 플러그인을 사용할 수 없어 기존 Playwright/Edge 도우미를 사용했다. 실제 계정·여행은 수정하지 않았다.

| 검사 | 결과 |
| --- | --- |
| `node scripts/time-wheel-browser-regression.js` | 통과: 3줄, 중간 애니메이션, 연속 키 입력, 마우스 드래그·관성, 실제 CDP 터치 스크롤·중앙 편집, 23/00·59/00 경계, 직접 입력·범위 보정, 확인·취소·시간 없음, 동작 줄이기, 저장 후 재열기, 열린 창 반응형 크기 |
| `node scripts/reservation-time-browser-regression.js` | 1440·390·320px 통과: 일정/예약 동일한 휠, 출발·도착 독립성, 입력·휠·취소·확인·시간 없음, 익일 도착 저장·재조회 |
| `node scripts/itinerary-controls-browser-regression.js` | 입력칸·선택창, 클릭·키보드 열기/닫기, 기존 일정 테마·스크롤 통과 |
| `node scripts/controls-browser-regression.js` | 320·390·768·1440px 통과: 시간·달력·목록 공통 컨트롤, 경계·취소·저장·새로고침 |
| `node bin/triplog.js dev test --suite source --json` | 종료 0, `ok: true` |
| `node bin/triplog.js dev build --json` | 종료 0, `ok: true`; Travel.html·sw.js는 빌드 지문만 갱신 |
| `node bin/triplog.js dev artifacts --json` | 종료 0, `ok: true` |

화면 제목·초기화·실제 편집창 표시·오류 오버레이 부재를 확인했고 앱 런타임 오류는 없다. 콘솔의 `net::ERR_FAILED`와 서비스 워커 차단 경고는 외부 요청·서비스 워커를 차단한 테스트 환경에서 발생했다. 전체 수집 내용은 `after-metrics.json`에 있다. Safari·실제 휴대전화의 OS 키보드는 별도 검증하지 않았다.

대표 캡처는 `before-mobile-390.png`, `after-mobile-390.png`, `after-mobile-320.png`, `after-desktop-1440.png`이며 SHA256은 `verification.json`에 기록했다. 임시 측정 스크립트와 전체 테스트 출력은 `artifacts/tmp/20261026-compact-time/`에 둔다.

로컬 수정·검증·빌드 완료. 이 크기 조정 변경은 Git 커밋·푸시·운영 배포를 수행하지 않았다. 빌드 지문: `25524ceefae0f2961b9e`.
