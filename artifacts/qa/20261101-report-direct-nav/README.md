# 리포트 직접 진입·여행 선택 표시 정렬

2026-11-01 · Asia/Seoul

사용자는 화면에 이미 있는 지출 분석·일정 분석·PDF 버튼을 이용하도록 하단 리포트 메뉴의 펼침 애니메이션을 제거하고, 여행의 정렬을 다른 하단 메뉴와 맞추도록 요청했다. 새 화면·버튼 디자인을 추가하지 않고 기존 공통 탐색 동작과 정렬 규칙으로 맞췄다.

- 리포트의 하단 메뉴 정의를 제거해 즉시 리포트 페이지로 이동한다. 펼침 화살표·ARIA popup 속성·메뉴 히스토리가 생성되지 않는다. 모든 하단 항목이 직접 진입한다.
- 여행에만 적용됐던 `::before`의 top 1px / height 34px 및 `::after` 숨김 예외를 제거했다. 공통 top 0 / height 56px 선택 배경과 공통 밑줄을 사용한다. 아이콘 24px, 레이블 16px 높이와 중앙 위치는 원래 공통 규칙을 따르고 있었다.
- [수정 전/후 비교](alignment-comparison.png), [수정 전 측정](../../tmp/20261101-report-direct-nav/relocated-20261104/before-layout.json), [수정 후 측정](../../tmp/20261101-report-direct-nav/relocated-20261104/after-layout.json)을 보존했다. 같은 390×844 CSS px / DPR 1의 동일 fixture·선택 상태에서 비교했다.
- 실제 [여행 390px](travel-390.png), [리포트 390px](report-390.png), [리포트 320px](report-320.png). 원본·보존본 SHA256은 [capture-provenance.json](capture-provenance.json)에 기록했다.

## 검증

- 탐색 회귀 테스트를 현재 직접 진입 구조로 갱신했다. 320×568 / 320×740 / 390×844 / 844×390 / 1280×900에서 5개 항목·아이콘/글자 Y 좌표·가로 중앙·선택 배경 높이·여행 밑줄을 확인했다.
- 리포트 진입이 페이지 히스토리 하나만 추가하는지, Back/Forward·빠른 연속 탭·스크롤 잠금 해제·과거 메뉴 마커가 있는 상태의 재로드가 정상인지 확인했다.
- 리포트의 지출 분석·일정 분석·PDF, 일정 편집창에서 리포트 직접 이동 시 미저장 데이터 보존, 여행 3개 탭·새로고침·키보드 전환, 설정/뒤로가기, 지출 추가·영수증·정산 진입을 확인했다. [실행 기록](verification.json).
- `trip-navigation-browser-regression.js`, `report-refund-browser-regression.js`, `travel-costs-browser-regression.js`, `itinerary-analysis-browser-regression.js` 통과. 검증 스크립트의 설정 진입 대상은 숨겨진 편집창 전용 버튼 대신 실제 메인 헤더의 `rdMenuButton`으로 바로잡았다.
- `dev test --suite source --json`, `dev build --json`, `git diff --check` 통과. 빌드 지문은 `6f7b888f309aecf343aa`다. 앱 모듈 117개·스타일 31개·등록 브라우저 suite 49개이며 전체 49개 suite 실행을 의미하지 않는다.

실제 Edge/Playwright의 격리된 예시 계정·여행으로 검증했다. 이전 인앱 브라우저 접근의 `browser.user is unavailable` 문제로 프로젝트에서 허용하는 독립 fixture를 사용했다. uncaught page error와 예상하지 못한 console warning/error는 없었다. 사용자 저장소·운영 여행·서버 데이터는 변경하지 않았다. 로컬 소스와 빌드에 반영했으며 Git 푸시·운영 배포는 하지 않았다.
