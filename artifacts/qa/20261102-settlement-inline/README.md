# 기존 지출 표에서 분담만 편집

2026-11-02. 사용자가 [선택한 표 기반 목업](../../design/20261102-settlement-shared-table/settlement-table-inline.png)을 승인한 뒤 구현했다. 로컬 소스·빌드만 변경했고 운영 여행 데이터, 서버 스키마 및 배포는 변경하지 않았다.

## 구현

- `ui.expenseLedger.table/row`: 지출 기록과 정산에서 동일한 표 헤더·날짜·내용·메모·카테고리·결제 수단·금액 및 반응형 행을 렌더링한다. 정산은 분담 토글과 읽기 전용 결제자 표시를 추가한다. 모바일 행 관리 버튼도 기존 순서 이동에서 사용하는 공통 배치 규칙을 재사용한다.
- `ui.expenseAllocationEditor.create`: 기존 지출 수정창과 정산 행에서 같은 균등/금액/비율 UI, 정확한 원 단위 계산, 합계 검사, 초안, 동행/계정/여행/다른 곳의 변경 검사, 저장·실패 복원 코드를 사용한다. 기존 expense allocation API와 DOM ID는 얇은 어댑터로 유지한다.
- 정산의 항목별 분담 버튼은 해당 행 바로 아래를 펼친다. 지출 전체 편집창을 열지 않는다. 이름은 아바타 안에 한 번 표시하며 접근성 이름과 툴팁을 보존한다.
- 분담 저장은 `settlement.itemSplits[current:<entryId>]`만 변경한다. 원래 `entries` 배열과 각 지출의 금액/결제자/날짜/외화/메모는 보존한다. 저장 성공 시 행을 접고 정산 요약을 갱신하며 기존 지출 수정창에서도 같은 분담을 읽는다.
- 입력 중에는 공유 상태를 바꾸지 않는다. 취소하면 초안을 버린다. false/throw 저장 실패는 적용한 분담만 원래 값으로 복원하고 입력은 유지한다. 다른 변경이 들어온 경우 그 새 값을 덮어쓰지 않는 공통 복원 규칙을 사용한다.
- 저장 중 재제출과 다른 행 열기를 막는다. 배경 렌더가 발생해도 초안 및 입력 포커스/선택 범위를 보존한다. 동행·금액·권한이 바뀌면 저장을 보류한다.
- 기존 환불 기록은 음수 합계와 분담에 반영하며, 현재 양수 분담 입력기로 수정하지 않고 읽기 전용으로 표시한다.

## 검증

Browser 플러그인이 제공되지 않아 AGENTS.md에서 허용한 격리 Edge/Playwright fixture를 사용했다. 외부 서비스 및 실제 여행을 쓰지 않았다.

통과한 검사:

- `tests/settlement-ledger-browser-regression.js`: 공유 표의 필드 일치, 기존 지출 데이터 불변, 행 안 금액·비율 수정/불완전 합계/취소, false/throw 복원, 중복 제출 방지, 배경 렌더 초안·포커스, 금액·동행·viewer 권한 변경, 기존 편집창과 저장값 일치, 예전 추가 지출 전환 및 새로고침.
- 정산 화면 폭 320/390/760/851/1440px. 인라인 입력 폭·16px 폰트·모바일/PC 배치 확인.
- `tests/expense-allocation-browser-regression.js`: 기존 수정창 균등/금액/비율, 정확한 원화 및 외화 분담, 저장·실패·취소, 낡은 분담/동행 방어, 320/390/760/1440px.
- `tests/expense-order-browser-regression.js`: 공통 표 추출 후 순서 이동·정렬·취소·권한·실패 회귀.
- `tests/expense-filter-browser-regression.js`: 검색·필터·정렬·예약/일반 지출 편집 유지.
- `tests/expense-ui-browser-regression.js`: 환산·환율 검증·저장/수정/새로고침·숙소 분할·계속 입력·검색·필터·빈 화면·320px. 예전 ‘여행 대표’ 고정 기대값은 이미 구현된 실제 소유자 프로필 이름 계약에 맞춰 fixture의 표시 이름을 사용하도록 갱신했다.
- `tests/settlement-name-browser-regression.js`, `tests/trip-navigation-browser-regression.js`.
- `tests/expense-allocation-regression.js`, `tests/settlement-ledger-regression.js`.
- CLI `dev test --suite source --json`: 종료 코드 0, `ok: true`, 119개 앱 모듈/32개 스타일/50개 브라우저 스위트 검사.
- CLI `dev artifacts --json`, `dev build --json`: 종료 코드 0, `ok: true`. 공통 UI 두 모듈이 dist 및 앱 셸에 포함됨. 빌드 지문 `cb166931dea75018af96`.

## 화면 근거

- [승인 목업과 구현 비교](mockup-comparison.png) · [비교 HTML](../../tmp/20261102-settlement-inline/relocated-20261104/comparison.html)
- [모바일 금액](amount-mobile.png) · [모바일 비율](percent-mobile.png) · [공통 표 모바일](shared-table-mobile.png) · [PC 금액](amount-desktop.png)

실제 공통 로고·여행 컨텍스트·경비 요약·메뉴를 유지했다. 목업의 임의 헤더나 경비 요약 그림을 별도로 만들지 않았다. 최종 캡처는 합성 데이터의 저녁 식사 120,000원, 택시 40,000원(30,000/10,000원), 카페 20,000원을 사용한다. 전체 테스트 캡처·임시 작업 자료는 `artifacts/tmp/20261102-settlement-inline/`에 있다.
