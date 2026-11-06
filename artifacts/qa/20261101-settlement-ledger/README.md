# 경비 정산 — 지출 내역 통합

선택된 정산 요약 / 항목별 분담 목업을 구현했다. 작업은 2026-11-01 시작, 2026-11-02 검증 완료. 운영 여행 데이터 및 서버 스키마는 변경하지 않았다. 배포하지 않았다.

- 기준 목업: [정산 요약](../../design/20261101-settlement-ledger-redesign/settlement-overview.png), [항목별 분담 → 기존 편집창](../../design/20261101-settlement-ledger-redesign/settlement-item-flow.png)
- [목업과 실제 화면 비교](mockup-comparison.png), [원본 크기 비교 HTML](../../tmp/20261101-settlement-ledger/relocated-20261104/comparison.html)
- 실제 공통 로고·여행 컨텍스트·경비 요약·하단 메뉴를 재사용했다. 목업의 임의로 그려진 상단 메뉴/여행 그림/새 편집창은 별도로 만들지 않았다.
- 모바일은 요약/멤버 카드를 세로로, PC는 두 열로 표시한다. 320px에서 금액을 읽기 좋게 재배치하고 긴 이름·큰 금액도 줄바꿈으로 보존한다.

## 데이터와 저장

- 합계·결제자·정산 분담은 현재 여행의 `entries`와 `settlement.itemSplits[current:<id>]`를 기준으로 한다. 예전 저장 기록을 선택한 값이 남아 있어도 다른 여행을 섞지 않는다.
- 항목 연필은 기존 지출 편집창 및 균등/금액/비율 입력을 사용한다. 저장 후 같은 항목별 분담 탭과 스크롤로 복귀하며 취소/저장 실패는 원래 값과 분담을 유지한다.
- 미완성 분담, 삭제된 멤버 분담액, 없는 결제자, 안전 범위를 넘는 합계가 있으면 송금 안내를 보류한다. 환불은 음수로 반영하며 기존 양수 지출 편집 폼으로 열지 않고 읽기 전용으로 표시한다.
- 예전 `companion.individualSpent`는 사용자가 확인하기 전까지 그대로 보존한다. 확인창에서 멤버별 금액·여행 시작일/결제일·기타 분류·초기 균등 분담을 보여주고, 승인하면 지출 추가와 예전 금액 초기화를 한 번의 로컬 저장으로 처리한다. 실패하면 원래 값을 복원한다. 실제 날짜와 분담은 기존 지출 편집창에서 수정할 수 있다.
- 예전 추가 지출 또는 현재 결제/직접 분담액이 남은 멤버는 먼저 지출 내역을 정리한 뒤 삭제한다.

## 검증 결과

모든 아래 검사가 통과했다. Browser 플러그인이 제공되지 않아 AGENTS.md에서 허용한 격리 Edge/Playwright fixture를 사용했다. 외부 서비스 및 운영 여행을 수정하지 않았다.

- `node tests/settlement-ledger-regression.js`: 180,000원 목업 수치, 멤버별 140,000/40,000원 결제, 95,000/85,000원 분담, 윤디→JH 45,000원 송금 안내. 읽기 순수성, 음수 환불, 원 단위 나머지, 불완전/낡은 분담, 합계 초과, 빈 목록.
- `node tests/settlement-ledger-browser-regression.js`: 공통 헤더/합계, 항목 탭, 편집 취소/저장 실패/비율 저장, 지출로 이동, 추가 지출 전환 취소/변경 충돌/false/throw/재시도/중복/새로고침, 환불 전용 표시, 빈 목록/긴 이름/큰 금액.
- 화면 폭: 320/390/760/851/1440px. 추가 긴 이름·큰 금액: 320/390/850/1440px.
- `node tests/settlement-name-browser-regression.js`: JH 이름, 대표/동행, 저장·취소·실패·권한·낡은 편집·여행 구분.
- `node tests/expense-allocation-browser-regression.js`: 기존 균등/금액/비율, 정확한 원화, 외화, 원자적 저장/실패/취소, 다른 곳의 변경.
- `node tests/trip-navigation-browser-regression.js`: 기존 지출/여행/리포트 이동과 뒤로/앞으로.
- `node tests/travel-costs-browser-regression.js`: 공통 경비 요약 및 지출·리포트·오늘 화면 회귀.
- `node tests/delete-dialogs-browser-regression.js`: 멤버 삭제의 추가 지출 보호 및 기존 삭제 확인 흐름.
- `node tests/redesign-regression.js`
- `node bin/triplog.js dev test --suite source --json`: 종료 코드 0, `ok: true`.
- `node bin/triplog.js dev artifacts --json`: 종료 코드 0, `ok: true`.
- `node bin/triplog.js dev build --json`: 종료 코드 0, `ok: true`. 새 정산 CSS가 dist에 포함됨.

전체 로그/캡처/작업용 스크립트는 `artifacts/tmp/20261101-settlement-ledger/`에 보관했다. 대표 캡처만 이 폴더에 보존한다.

합성 데이터 미리보기: `node scripts/preview-settlement-ledger.js` → `http://127.0.0.1:18136/Travel?page=settlement&trip=settlement-ledger-fixture`.
