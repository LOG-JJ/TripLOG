# 오늘의 여행 선택 목업 구현 QA

2026-11-01 · Asia/Seoul  
final result: passed

목록 제목 후속 수정: 완료 목록의 ‘방문 완료’를 ‘완료 일정’으로 변경했다. 다음 일정·취소 일정·완료 일정 제목을 같은 Today 전용 규칙으로 묶어 Pretendard 15px/550, 줄 높이 20.25px, 남색을 동일 적용하고 개수 표시도 12px/500으로 맞췄다. 격리 fixture에서 완료·건너뛰기를 실행해 세 제목이 함께 있는 390/1440px 화면의 computed style 일치를 확인했다. [글꼴 측정](today-section-heading-typography.json), [PC 캡처](today-section-headings-1440.png). 원본은 `artifacts/tmp/20261101-today-completed-heading/heading-typography/`에 생성하고 SHA256 일치를 확인해 보존했다. 소스 검사·Today 브라우저 회귀·빌드 통과.

상세창 크기·위치 후속 수정: 사용자 요청에 따라 `#ttCostInfo`에만 `height:fit-content`, 중앙 자동 여백, 화면 가장자리 16px 제한을 적용했다. 본문 flex 확장을 막아 내용 아래의 큰 빈 공간을 없애고 모바일 하단 시트 규칙 대신 같은 중앙 모달 배치를 사용한다. 긴 내용은 본문에서 스크롤하고 닫기·하단 동작은 창 안에 유지한다. 소스 검사·Today 브라우저 회귀·빌드 통과. 추가 격리 브라우저 측정에서 390×844/320×568/844×390/1440×1024의 세로 중앙 오차 1px 미만, 창·하단 버튼의 화면 내 위치를 확인했다. [측정값](spending-centered-geometry.json), [모바일](spending-centered-390.png), [PC](spending-centered-1440.png). 추가 캡처는 reduced-motion 상태에서 `artifacts/tmp/20261101/expense-dialog-layout/`에 생성 후 SHA256 일치를 확인해 보존했다.

지출 상세 후속 수정: 사용자 요청대로 상세창 제목을 ‘지출 상세’로 변경하고 도넛 중심의 ‘오늘 지출/오늘 순지출’ 보조 라벨을 제거했다. 날짜·건수는 공통 `trip-context-meta`/`trip-context-duration` 스타일을 재사용해 달력 아이콘·13px 날짜·회색 건수 배지로 정리했다. 도넛은 금액과 건수, 환불 설명은 기존 하단 문구로 표시한다. 소스 검사·Today 브라우저 회귀·빌드 통과. [최신 실제 상세창](spending-detail-refined-390.png)은 `artifacts/tmp/20261101-expense-detail-heading/today-refinement/spending-390.png`에서 SHA256 일치를 확인해 보존했다.

카드 간격 후속 수정: 850px 이상에서 기존 `#ttContent>*{margin:0}` 규칙이 여행 정보 박스의 하단 여백을 덮어쓰는 문제를 수정했다. Today의 해당 직계 자식에만 20px 하단 여백을 적용해 4px 그림자 아래에도 16px의 빈 공간을 확보했다. 좁은 모바일의 내부 padding은 유지한다. 소스 검사·Today 브라우저 회귀·빌드 통과, 320/390/759/760/1440px 캡처 확인. [PC 실제 화면](today-spacing-1440.png)은 `artifacts/tmp/20261101-today-card-spacing/today-refinement/today-1440.png`에서 SHA256 일치를 확인해 보존했다.

최신 후속 수정: 사용자가 첨부한 왼쪽으로 되돌아가는 화살표 형태에 맞춰 Undo의 caret-left를 기존 Phosphor `arrow-u-up-left`로 교체했다. 기존 날짜 왼쪽 배치와 동작은 유지한다. 지출 표시 문구도 사용자 요청에 따라 ‘오늘 지출’, 환불 시 ‘오늘 순지출’로 변경했다. 아래 원본 비교는 최초 승인안의 기록이며, 최신 Undo/지출 문구는 [후속 실제 캡처](today-undo-arrow-390.png)에서 확인한다. 소스 검사·Today 브라우저 회귀·빌드 재실행 통과. 캡처는 `artifacts/tmp/20261101-today-undo-arrow/today-refinement/today-completed-390.png`에서 SHA256 일치를 확인해 보존했다.

## 선택 기준과 최종 요청

사용자가 여행 메인 1번·지출 상세 3번을 선택하고 수정 요청을 반영한 [조합 목업](../../design/20261101-today-selected-combination/combined-refinement.png)을 확인한 뒤 `구현ㄱㄱ`로 구현을 요청했다. 구현 중 추가 요청한 “선택된 여행 박스에 그림자·테두리를 넣어 앱 디자인 톤에 맞추기”와 이어진 “박스 색을 디자인 톤에 맞게 바꾸기”도 반영했다. 남색 테두리와 짧은 오프셋 그림자, 흰 카드 바탕은 최신 사용자 요청에 따른 의도한 변경이다.

소스는 1471×1069px 이미지에 담긴 3개 화면이다. 원본과 SHA256은 [생성 기록](../../design/20261101-today-selected-combination/generation.json)에 보존했다. 초기/방문 완료 후/지출 상세를 각각 잘라 390×844 CSS px의 실제 화면과 비교했다. 실제 캡처는 deviceScaleFactor 1이다. 바깥 보드 여백과 패널 테두리를 제외한 crop 좌표·보존 캡처의 SHA256은 [capture-provenance.json](capture-provenance.json)에 기록했다. 생성 이미지의 픽셀 글자 크기를 그대로 CSS 크기로 오인하지 않고 사용자와 확정한 글자 크기·굵기 기준을 적용했다.

## 비교 자료

| 상태 | 원본과 실제 화면 | 실제 캡처 |
| --- | --- | --- |
| 초기 화면, 0/5, Undo 비활성 | [initial-comparison.png](initial-comparison.png) | [390px](today-initial-390.png), [320px](today-320.png), [1440px](today-1440.png) |
| 방문 완료 후, 1/5, Undo 활성 | [completed-comparison.png](completed-comparison.png) | [today-completed-390.png](today-completed-390.png) |
| 이날 지출 상세 | [spending-comparison.png](spending-comparison.png) | [390px](spending-390.png), [320px](spending-320.png), [1440px](spending-1440.png) |
| 상단·진행 표시·Start here | [controls-comparison.png](controls-comparison.png) | 실제 CSS 측정 [typography.json](typography.json) |
| 긴 여행명/주소, 빈 지출 | 기존 컴포넌트의 정상 데이터 경계 검증 | [긴 이름 320px](today-long-320.png), [빈 지출 320px](spending-empty-320.png) |

## 확인한 표면과 수정 이력

| 표면 | 최종 결과 |
| --- | --- |
| 글꼴·굵기 | 프로젝트의 로컬 Pretendard 사용. 390px에서 제목 18px/600, 여행명 14px/550, 장소명 17px/550, Undo/Start here 12px/500. 일반 정보는 400–500, 큰 금액은 최대 600. 다른 화면의 공통 타이포 토큰은 변경하지 않았다. |
| 간격·배치 | Undo를 날짜 선택 왼쪽에 유지. 공통 여행 정보 오른쪽에 5분절 진행률과 작은 분수. 320px에서는 기간을 자연스럽게 다음 줄로 표시하며 버튼과 겹치지 않음. 모바일 한 열·기존 PC 두 패널 구조를 유지. |
| 색·테두리·그림자 | 최신 색상 피드백에 따라 다음 장소의 연한 하늘색 바탕을 흰색으로 변경. 여행 정보는 남색 1.5px 테두리·3×4px 남색 그림자, 다음 장소는 같은 테두리와 3×4px 브랜드 노란 그림자. 진행률과 기간 표시는 중성 회색으로 정리하고 Start here도 흰색·회색으로 맞춤. 노란 주요 버튼과 기존 분류 아이콘 색은 유지. |
| 이미지·아이콘 | 실제 `ui.tripContext.render()`와 기존 여행 아이콘을 재사용. 사진/장소별 새 그림 없이 기존 Noto 컬러 SVG와 Phosphor 사용. 실제 프로젝트 로고 유지. Undo에는 caret-left를 사용하며 회전/새로고침 아이콘을 사용하지 않음. |
| 문구·데이터 | 중복 여행명·도시·지난 일정·완료 문장을 제거. 버튼은 Undo/Start here. 완료 수·일정 시각·날짜·금액은 실제 상태에서 계산. 목업 예시를 앱 데이터로 고정하지 않음. |

| 첫 비교에서 발견한 항목 | 조치와 재확인 |
| --- | --- |
| P2: 전역 h1 `!important` 규칙 때문에 로컬 font-size 18px 선언에도 실제 제목이 22px | Today/지출 상세에만 제목 토큰을 지정하고 실제 computed style 18px/600을 캡처·자동 검사로 확인 |
| P2: 지출 차트가 작아 하단 정보와 버튼 사이 여백이 지나치게 커짐 | 도넛을 224px로 조정. 도넛 중심 금액은 22px/600을 유지해 사용자가 원한 가벼운 타이포를 지킴. 최종 원본/실제 비교와 320px 캡처 재확인 |
| 사용자의 후속 요청: 여행 정보 박스가 단조로움 | 기존 앱의 남색 테두리·짧은 오프셋 그림자 적용. 320/390/759/760/1440px 재검사 후 가로 넘침과 버튼 겹침 없음 |
| 사용자의 후속 요청: 박스 색상이 앱과 어울리지 않음 | 반복되는 하늘색 면을 흰색·중성 회색으로 교체하고 남색 윤곽과 작은 노란 그림자로 색 역할 정리. 동일 격리 fixture 캡처를 갱신하고 IAB의 실제 적용·콘솔 오류 없음 확인 |

최종 비교에 남은 P0/P1/P2는 없다. 다음은 의도한 차이다. 기존 빠른 지출·예약번호·숙소·다중 이동 기능은 해당 데이터가 있을 때 계속 노출한다. 생성 목업이 생략한 기능을 삭제하지 않았다. 완료한 항목은 ‘방문 완료’ 접힌 목록에 두고 이후 일정에 다시 넣지 않는다. 원본의 가상 아이콘과 달라도 사용자가 요청한 현재 프로젝트의 분류 SVG를 사용한다. 생성 이미지보다 글자 크기와 굵기가 작고 가벼운 것은 사용자의 명시적 요청에 따른다.

## 동작 검증

아래 검사는 이번 변경 후 실제 실행했다. 전체 48개 브라우저 suite를 재실행했다고 주장하지 않는다.

- `node bin/triplog.js dev test --suite source --json`: 종료 코드 0, `ok: true`. 앱 모듈 115개·스타일 31개·브라우저 suite 48개·CLI 모듈 28개 확인.
- `node scripts/today-refinement-browser-regression.js`: 통과. 공통 여행 정보, 0/5→1/5→Undo 복구, 시작 위치 선택/Undo, 시각·원본 지출 불변, 실제 캔버스·분류 금액/비중, 전체/사전구매 합계, 지출 목록 이동, 부분 환불·환불만 있는 날·0원·긴 이름·빈 일정, 320/390/759/760/1440px 검증.
- `node scripts/companion-passport-browser-regression.js`: 통과. 기존 빠른 지출·개인 건너뛰기·재열기·완료/Undo·HTML/ICS·도구 동작 및 반응형 보존.
- `node scripts/report-refund-browser-regression.js`: 통과. 공통 도넛의 기본 리포트 동작, 지출/환불, 정렬·날짜·편집 복귀 및 모바일/PC 보존.
- `node scripts/travel-costs-browser-regression.js`: 통과. 개요/지출/리포트/오늘의 합계 일치, 추가·수정·삭제·사전구매·환불·재열기, 분류와 기간, 여러 화면 크기 확인.
- `node scripts/travel-companion-regression.js`, `node scripts/travel-costs-regression.js`: 모두 통과. 기존 날짜·진행·원자적 수정/되돌리기·환불/합계·공통 결제 구성 계산 보존.
- IAB에서도 일정 메뉴→오늘의 여행→방문 완료→Undo를 실제 눌러 상태 변경과 복원을 확인했다. 자동 브라우저 검사는 사용자 AGENTS 지침에 따라 저장소의 격리 Edge/Playwright fixture를 사용했다.
- `node bin/triplog.js dev build --json`: 종료 코드 0, `ok: true`. 최종 앱/공유 자산과 Travel.html/sw.js 생성.
- `node bin/triplog.js dev artifacts --json`, `git diff --check`: 통과.

지출은 기존 `travelCosts.summarize`와 `categoryShares`를 사용한다. 도넛은 환불 전 결제 구성, 중심은 환불을 차감한 이날 순지출이며 환불이 있을 때 이를 명시한다. 지출/일정 데이터의 저장 계약이나 서버 권한은 바꾸지 않았다.

## 범위와 제한

새 이미지·외부 라이브러리·유료 API는 추가하지 않았다. 현재 체크아웃에 있던 다른 기능 수정은 보존했다. 운영 여행 데이터·사용자 원래 브라우저 저장소를 초기화하거나 수정하지 않았다. 별도 포트의 가상 데이터로 검사했다. 네이티브 iOS/Android 기기는 연결하지 않았으며 모바일 크기의 Edge/IAB 검증과 구분한다.

Git 커밋·푸시·운영 배포는 실행하지 않았다. 로컬 변경을 운영 반영으로 보고하지 않는다.

## 확인 주소

[격리 예시 미리보기](http://127.0.0.1:18132/Travel?page=itinerary&trip=today-refinement-fixture). `node scripts/preview-today-refinement.js`로 다시 켤 수 있다. 일정 메뉴에서 오늘의 여행을 연다. 인증/동기화는 가짜 응답으로 고정하고 외부 연결을 CSP로 차단한다.
