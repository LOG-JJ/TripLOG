# 일정 테마 세부 분류 검증 — 2026-10-26

기존 6개 테마 아래에 PDF와 공유하는 50개 유형을 선택하도록 구현했다. 일정에는 선택 사항인 `themeSubtype`을 저장한다. 직접 선택한 유형은 일정표 라벨·아이콘, 개요 아이콘, PDF 일정 아이콘·그림에 우선 반영한다. 미선택 시 기존 테마 표시와 PDF 자동 그림 판별을 사용한다.

## 동작

- 테마와 세부 분류를 두 열로 배치하고 세부 분류의 기본값을 `자동`으로 제공한다.
- 테마를 변경하면 이전 세부 분류를 초기화한다. 직접 선택한 유형은 해당 테마에 속해야 한다.
- 기존 일정은 세부 분류를 추가하지 않은 채로 저장할 수 있다. 수정·복사·새로고침·일반 초안 및 외부 지도 복귀 초안에서 선택값을 보존한다.
- CLI의 `--theme-subtype` 및 JSON `themeSubtype`을 지원한다. `schema itinerary --json`에 전체 유형 ID·이름·소속 테마를 제공한다.
- 기존 동기화의 일반 필드 직렬화를 사용한다. 스키마 마이그레이션이나 서버 설정 변경을 수행하지 않았다.

## 환경과 시각 확인

Browser plugin not available: 저장소의 Playwright / 설치된 Edge로 로컬 fixture를 검증했다. 외부 요청을 차단하고 격리된 예시 여행만 사용했다. 임시 HTTP 주소는 [result.json](result.json)에 기록되어 있으며 검증 후 서버와 브라우저를 종료했다.

320 / 390 / 768 / 1440px에서 두 열, 44px 이상 메뉴 행, 화면 안 메뉴 배치, 긴 명소 목록의 내부 스크롤, 선택 상태, 키보드 선택과 Escape 포커스 복귀를 확인했다. 초기 페이지의 제목·URL·일정 본문을 확인했고 런타임 오류는 0개였다. 프레임워크 오류 화면이나 빈 화면은 없었다.

[T2I 목업 기록](../../design/20261026-itinerary-subthemes/generation.md)의 두 열 분류와 기존 흰색·노란색 컨트롤을 구현했다. 기존 폼의 시간 입력·저장 버튼을 유지했다. 세부 분류는 선택 사항으로 표시하고, 실제 뷰포트의 남은 공간에 맞춰 메뉴를 필드 위·아래로 배치한다.

## 통과한 검사

| 검사 | 결과 |
| --- | --- |
| `node bin/triplog.js dev test --suite all --json` | 종료 코드 0, `ok: true`: 소스·SQL/동기화·복구/백업·지도 모델·일정 순서·PDF 모델·CLI·터미널 |
| `node bin/triplog.js dev test --suite cli --json` | 종료 코드 0, `ok: true`: 로컬 파일 및 cloud fixture의 세부 분류 저장·조회, 테마 전환, 잘못된 조합 거부 포함 |
| `node tests/itinerary-art-regression.js` | 50개 유형·그림·실제 아이콘, 수동 우선순위, 잘못된 유형의 자동 대체, 50개 동기화 직렬화 왕복 |
| `node tests/itinerary-subtypes-browser-regression.js` | 선택 → 저장 → 새로고침 → 메모 수정 → 독립 복사 → PDF → 자동 전환 → 테마 변경 → 기존 항목 보존 → 초안 복원 |
| `node tests/itinerary-controls-browser-regression.js` | 테마 팝업·시간·키보드·이동 편집 |
| `node tests/controls-browser-regression.js` | 공통 선택창·시간·통화·날짜·숙소 저장/복원, 모바일·PC |
| `node tests/map-provider-browser-regression.js` | 모바일 외부 지도 복귀 후 카페 세부 분류 복원, 국내/해외 지도 흐름 |
| `node tests/stay-copy-browser-regression.js` | 숙소 예약 자동 일정·수정·복사·저장 실패 복구 |
| `node tests/print-export-browser-regression.js` | PDF 전체 회귀, 50종 그림·실패 시 대체, 겹침·긴 일정·금액·모바일/PC |
| `node bin/triplog.js dev build --json` | 종료 코드 0, `ok: true`, HTML·서비스 워커·dist 생성 |
| `node bin/triplog.js dev artifacts --json` | 종료 코드 0, `ok: true`, artifacts 보관 규칙 통과 |

빌드 지문: `845de889a26c0eb9c422`. Git 푸시·배포는 실행하지 않았다. 실제 iOS Safari 기기의 터치·화면 읽기 프로그램 검증은 수행하지 않았다.

## 대표 캡처

- [카페 선택 폼 390px](cafe-form-390.png)
- [카페 분류 메뉴 390px](cafe-menu-390.png)
- [긴 명소 메뉴 320px](sightseeing-menu-320.png)
- [카페 그림이 반영된 PDF 미리보기](pdf-subtype-preview.png)

대표 파일은 `artifacts/tmp/20261026-itinerary-subthemes/itinerary-subtypes/`의 동일 이름 원본을 복사하고 각각 SHA256 일치를 확인했다. 전체 캡처·작업용 PDF는 해당 tmp 폴더에 두었다.
