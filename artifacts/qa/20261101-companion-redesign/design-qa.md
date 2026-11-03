# TripLOG 통합 여행 화면 구현 QA

검토일: 2026-11-01 · Asia/Seoul  
final result: passed

선택 목업과 최종 브라우저 캡처를 다시 비교했으며 남은 P0/P1/P2 항목은 없다. 실기기·운영 서버 범위는 아래 제한과 구분한다.

## 구현 및 검토 범위

사용자의 `구현해줘` 요청에 따라 [통합 구현 계획](../../design/20261101-companion-implementation-plan/implementation-plan.md)의 네 화면을 로컬 소스에 구현했다. 기존 일정 요약·이동 편집 WIP는 보존했다. 운영 여행 데이터·사용자 브라우저 저장소는 초기화하거나 수정하지 않았다. Git 커밋·푸시·서버 마이그레이션·Edge Function 배포는 실행하지 않았다.

| 화면 | 실제 구현 동작 | 주요 근거 |
| --- | --- | --- |
| 오늘의 여행 | 다음 장소, 이름/주소/예약번호 복사, 방문 완료/취소, 개인 건너뛰기·시작 위치·되돌리기, 빠른 지출, 숙소 길찾기, 다중 이동, 이후 일정 | `companion-passport-browser-regression.js`, `companion-experience-regression.js` |
| 예약 지갑 | 현지 당일의 숙소 외 예약, 종류/검색/정렬, 지난 예약 접기, 왕복 회차, 상세/출처 편집, 기존 일정 선택, 예약 금액과 실제 결제의 구분 | `wallet-passbook-browser-regression.js`, 예약/교통/숙소/시간 회귀 |
| 여행 도구 | 준비물 즉시 체크·추가·이름 수정·삭제, 전체/남은 보기, 기존 준비물 편집기와 같은 원본, HTML 포함 옵션, ICS, 시간대 | 오늘/도구 브라우저 검사, 모델/도메인 회귀 |
| 일정 분석 | 계획 기준 체류/이동/미입력, 날짜별 공통 축 비교, 전체/날짜 필터, 장소 정렬, 시간·이동 편집과 복귀 | `itinerary-analysis-browser-regression.js`, 모델 회귀 |

완료는 기존 공유 상태를 사용한다. 건너뛰기와 시작 위치는 계정·기기·여행·날짜별 IndexedDB meta에 저장한다. 예약 금액만 기록하면 지출은 생기지 않으며, 사용자가 명시적으로 새 결제를 기록하거나 기존 지출을 선택했을 때 연결한다. 연결 해제·예약 삭제는 기존 지출을 지우지 않는다.

## 목업과 실제 화면 비교

선택 원본 12장의 경로·SHA256은 [mockup-index.json](../../design/20261101-companion-implementation-plan/mockup-index.json)에 유지했다. 새 이미지를 생성하거나 기존 목업을 이미지 입력으로 다시 사용하지 않았다. 기존 컬러 Noto SVG·Phosphor·TripLOG 로고·공통 날짜/시간/select/dialog/지출/이동 컴포넌트를 재사용했다. 신규 외부 런타임 의존성은 추가하지 않았다.

실제 화면은 별도 origin의 가상 여행으로 캡처했다. 모바일 비교는 390 CSS px, 같은 화면 상태(오늘/지갑/준비물 기본/분석 전체)를 맞췄다. 선택 원본의 OS 상태바·하단 홈 인디케이터는 앱 기능으로 구현하지 않았다. 예시 날짜·금액·장소 개수는 fixture에 따라 달라지므로 정보 계층·글자 크기·줄바꿈·카드 높이·화면에 보이는 내용량을 비교했다. 도구/분석 원본은 여러 상태를 나란히 담은 보드의 첫 화면을 잘라 비교했다. 앱 캡처 자체는 수정하지 않았다.

| 비교 화면 | 원본과 나란히 본 자료 | 실제 화면 |
| --- | --- | --- |
| 오늘 | [today-comparison.png](today-comparison.png) | [390px](today-390.png), [1440px](today-1440.png) |
| 지갑 | [wallet-comparison.png](wallet-comparison.png) | [390px](wallet-390.png), [1440px](wallet-1440.png) |
| 도구 | [tools-comparison.png](tools-comparison.png) | [390px](tools-390.png), [1440px](tools-1440.png) |
| 분석 | [analysis-comparison.png](analysis-comparison.png) | [390px 전체](analysis-all-390.png), [1440px 날짜 상세](analysis-1440.png) |

| 발견 및 조치 | 심각도 | 결과 |
| --- | --- | --- |
| 이전 companion PC grid가 새 두 패널을 다시 나누어 화면을 압축 | P1 | 외부 콘텐츠는 block, 새 화면별 grid만 적용 |
| 준비물 라벨이 옛 스타일의 flex/폭 제한으로 세로 줄바꿈 | P1 | 현재 화면에 범위를 둔 가로 행·유동 폭으로 수정 |
| 전역 버튼/입력 스타일로 글자가 지나치게 작거나 카드 높이가 커짐 | P2 | 제목/본문/보조 정보 크기 및 내부 간격을 화면별 조정 |
| 지갑의 검색·분류·추가가 여러 줄을 차지 | P2 | 상단 한 줄 도구와 작은 정렬 행으로 압축 |
| 미래 예약이 당일 대표 예약과 같은 큰 버튼을 사용 | P2 | 미래/숙소는 작은 행과 우측 열기 버튼으로 구분 |
| 준비물 편집 기능이 처음부터 큰 영역을 차지 | P2 | 기본은 남은 항목, 항목 추가·수정에서 전체 편집 |
| 분석 기간 선택과 기존 PDF 푸터가 주요 결과를 밀어냄 | P2 | 기간 선택은 제목 행, PDF는 기존 리포트 메뉴에서 접근 |
| 짧은 그래프 값이 ‘분’만 다음 줄로 고립 | P2 | 값과 단위를 명시적인 줄로 배치하고 오른쪽 정렬 |
| 오늘의 이후 일정과 완료 목록 때문에 지출 요약이 지나치게 아래로 밀림 | P2 | 이후 일정 제목을 카드 안에 넣고 완료 목록은 지출 요약 다음에 접기 |
| 최종 비교에서 오늘 지출·캘린더/시간대·분석 순위가 첫 화면 아래로 밀림 | P2 | 모바일 오늘 카드 간격 축소, 도구 저장 영역 통합, 분석 제목/범례/순위 압축. 390px fixture의 지출 요약과 첫 장소 순위가 하단 탐색 위에 보이는지 자동 검사 추가 후 통과 |
| 기존 custom-select가 분석 정렬 폭을 늘려 PC 제목이 두 줄로 줄바꿈 | P2 | 실제 wrapper 폭을 PC 135px·모바일 110px로 제한하고 최종 캡처에서 한 줄 확인 |
| 지갑 검색 입력에 전역 입력 테두리가 겹쳐 이중 박스로 표시 | P2 | 검색 영역 내부 input의 테두리·그림자를 해당 화면에서 제거하고 모바일/PC 재검사 |

320/390/768/1440px에서 가로 넘침·dialog 범위·하단 탐색을 자동 검사했다. IAB에서도 오늘의 여행을 열어 실제 표시를 확인했고 오류 수준 콘솔 로그는 0건이었다. 캡처를 원본 그대로 보존본에 복사하고 SHA256으로 대조한 기록은 [capture-provenance.json](capture-provenance.json)에 둔다. 전체 실행 캡처와 작업용 합성 스크립트는 Git 제외 경로인 `artifacts/tmp/20261101-companion-redesign/`에 둔다.

## 동작 및 데이터 검증

| 검사 | 실제 결과 |
| --- | --- |
| `node bin/triplog.js dev test --suite all --json` | 종료 코드 0, `ok: true`. source·도메인·CLI·터미널·SQL·동기화 회귀 통과; CLI 프로세스 검증 222개 |
| `node bin/triplog.js dev test --suite source --json` | 종료 코드 0, `ok: true`. 앱 모듈 115개, 스타일 31개, 브라우저 suite 47개, CLI 모듈 28개 |
| 신규 companion 모델/SQL | 날짜 경계·진행 위치·왕복·숙소 제외·다중 이동·금액/결제 구분·원본 ID·연결 해제·중복 재시도·SQL 원자성·비공개 금액 통과 |
| 신규 오늘/도구 브라우저 | 저장 후 재열기, 실패 롤백, 외화 지출, 개인 건너뛰기 유지, 실제 HTML/ICS 파일, 현지 자정 자동 갱신과 직접 선택한 날짜 보존 통과 |
| 전체 브라우저 47개 | 최종 집계 47/47 통과. 최초 전체 명령은 개편 전 셀렉터에서 중단됐으며 해당 검사를 실제 새 메뉴·왕복 회차·상세 버튼·읽기 전용 기존 첨부·편집 후 복귀 계약에 맞춰 갱신한 뒤 실패한 suite부터 이어서 실행했다. 일정·지출·준비물 원본 보존과 실제 저장/삭제/환불/동기화 검사는 유지했다. [suite별 결과](browser-results.json) |
| 마지막 CSS 조정 후 집중 검사 | today-tools / wallet / analysis 및 report-refund 재실행 통과. 최종 캡처로 재비교 완료 |
| Edge Function | CI와 같은 Deno 2.9.6으로 `supabase/functions/triplog-sync/handler_test.ts` 실행, 4 passed. 비공개 예약 금액의 변경 이력 노출 차단 포함 |
| 빌드 | `node bin/triplog.js dev build --json` 종료 코드 0, `ok: true`. Travel.html·sw.js·공유 sync 모델 생성. 최종 지문 `0e196158b6dc1d4dfc1d` |
| 산출물/최종 차이 | `dev artifacts --json`: 종료 코드 0, `ok: true`. `git diff --check`: 종료 코드 0. 목업 원본 12장과 캡처 보존본 13장의 SHA256 대조 일치 |

SQL 검증은 격리 PGlite에서 실제 migration 함수·trigger를 실행했다. 새 예약과 지출을 한 operation으로 반영하고 잘못된 금액에서 전체 롤백하는지, 같은 operation 재시도가 중복을 만들지 않는지 확인했다. 지출 비공개일 때 예약의 견적 금액·통화·연결 지출 ID와 field version, Edge Function 변경 이력까지 비소유자에게 숨겼다. 서버에서 새로운 reservation `g:money` 그룹을 만들지 않고 기존 서버 계약이 허용하는 flat 필드를 사용했다.

## 남은 환경 제약과 운영 반영

- 실제 iPhone/iPad Safari·Android 기기는 연결되어 있지 않아 네이티브 키보드, OS 파일 저장창, 외부 지도 앱 복귀는 실기기 검증하지 않았다. Edge의 모바일 크기 검증과 실제 기기 결과를 구분한다. 간편 지출은 visualViewport를 사용해 키보드가 올라올 때 입력·저장 영역을 조정한다.
- 생성 목업의 가상 랜드마크 그림 대신 현재 프로젝트의 소분류 컬러 SVG를 사용한다. 기존 TripLOG 로고를 유지한다.
- 이 QA는 격리 로컬 상태를 검증한다. 운영 서버 호환성·운영 데이터 동기화·자동 배포 완료를 확인한 결과가 아니다.
- 운영 반영 시 `supabase/migrations/20261031153950_companion_reservation_money_privacy.sql`과 변경된 `triplog-sync` Edge Function을 프런트엔드와 함께 반영해야 한다. 이번 요청에서는 적용하거나 배포하지 않았다.

## 직접 확인

`node scripts/preview-companion-experience.js` → [가상 여행 미리보기](http://127.0.0.1:18131/Travel?page=itinerary&trip=companion-experience-fixture). 일정 메뉴에서 오늘의 여행·예약 지갑·여행 도구, 리포트 메뉴에서 일정 분석을 연다. 이 서버는 인증/동기화 응답을 가짜 응답으로 고정하고 CSP로 외부 연결을 막으며, 실제 여행/로그인 데이터와 분리된 별도 포트를 사용한다. 테스트 시각은 2026-11-03 18:05(도쿄), `Date.now()`는 애니메이션이 멈추지 않도록 실제 시계를 유지한다.
