# 여행 메뉴 통합 구현 QA

2026-11-01 · Asia/Seoul  
final result: passed

## 승인 범위

사용자가 [선택 목업](../../design/20261101-travel-navigation/travel-navigation-three-tabs.png)을 확인하고 ‘일단 이렇게 구현해보자’로 요청했다. 구현 범위는 하단 5개 메뉴, 여행 안의 3개 탭, 일정 직접 진입, 상단 설정 이동이다. 생성 목업에 그려진 각 기능의 새 본문을 다시 구현하는 작업이 아니다. 직전 합의대로 기존 오늘의 여행·예약 지갑·여행 도구의 동작과 후속 디자인 수정을 새 탐색 구조에 연결했다.

원본은 1482×1062px이며 3개 패널을 잘라 390×844 CSS px로 정규화했다. 실제 캡처는 deviceScaleFactor 1이다. crop 좌표, 원본·보존 캡처 경로와 SHA256은 [capture-provenance.json](capture-provenance.json)에 보존했다.

## 원본과 실제 화면 비교

| 상태 | 전체 비교 | 탐색 부분 확대 | 실제 모바일 |
| --- | --- | --- | --- |
| 오늘의 여행 | [today-comparison.png](today-comparison.png) | [today-navigation-comparison.png](today-navigation-comparison.png) | [390px](today-390.png), [320px](today-320.png) |
| 예약 지갑 | [wallet-comparison.png](wallet-comparison.png) | [wallet-navigation-comparison.png](wallet-navigation-comparison.png) | [390px](wallet-390.png), [320px](wallet-320.png) |
| 여행 도구 | [tools-comparison.png](tools-comparison.png) | [tools-navigation-comparison.png](tools-navigation-comparison.png) | [390px](tools-390.png), [320px](tools-320.png) |

PC는 [today-1440.png](today-1440.png)에 보존했다. 같은 이미지 안에 원본과 실제 화면을 함께 놓고 비교했다. 본문은 보존한 기존 기능이라는 범위를 명시하고, 이번 변경의 핵심인 헤더·탭·하단바를 별도로 확대해 검토했다.

| 표면 | 최종 결과 |
| --- | --- |
| 글꼴·타이포 | 기존 Pretendard 사용. 상단 탭은 13px/500, 오늘의 여행에서 직전 조정한 제목·본문 크기와 굵기 유지. 하단 레이블은 기존 공통 탐색 스타일 사용. |
| 배치·간격 | 설정은 상단 톱니바퀴, 여행의 세 기능은 상단 3개 탭, 하단은 개요/일정/여행/지출/리포트. 중복 내부 하단바를 숨겨 실제 보이는 공통 하단바는 하나. 320/390/760/1440px의 세 상태에서 가로 넘침 없음. |
| 색상·표면 | 흰 바탕·남색 윤곽·노란 활성 탭과 여행 아이콘 강조를 적용. 기존 카드와 짧은 그림자 유지. |
| 이미지·아이콘 | 실제 프로젝트의 분홍 TripLOG 워드마크·Noto SVG·Phosphor 재사용. 생성 목업의 노란 워드마크로 브랜드 자산을 교체하지 않음. 기존 저장 상태 아이콘도 유지. 새 래스터 자산·외부 라이브러리 없음. |
| 문구·상태 | 오늘의 여행/예약 지갑/여행 도구의 정확한 탭 이름, 일정의 직접 이동, 설정 상단 진입 확인. 샘플 지명·시각·금액은 앱 데이터에서 표시하며 생성 목업 수치를 고정하지 않음. |

현재 비교에서 남은 범위 내 P0/P1/P2는 없다. 도구의 ICS/HTML 저장 방식, 예약 지갑의 기존 카드, 영문 Undo·Start here, 진행률 등 직전 합의한 본문은 의도적으로 유지했다. 일반 목록 페이지에서는 브라우저 페이지 스크롤을 사용하며, 지출 상세·예약 편집 등 실제 팝업만 배경 스크롤을 잠근다.

## 발견한 문제와 조치

- 초기 구현에서 기존 native dialog를 일반 페이지로 사용하면 공통 스크롤 잠금·팝업 판별에 포함될 수 있었다. 메인 여행 화면을 일반 section으로 전환하고 상세창만 기존 native dialog로 유지했다. 실제 터치·휠 스크롤 회귀 검사를 다시 통과했다.
- 화면을 표시하기 전에 스크롤을 초기화하면 최초 예약 지갑 진입에서 헤더가 약간 잘릴 수 있었다. 본문을 표시한 뒤 초기화하도록 수정했다. 최종 12개 상태에서 scrollY=0, 헤더 top=0, 보이는 공통 하단바 1개를 확인했다. [layout.json](layout.json)에 결과를 보존했다.
- 브라우저 회귀는 새 메뉴 구조에 맞춰 일정 메뉴 선택 대신 직접 진입, 설정 대신 상단 톱니바퀴, 닫기 대신 하단 이동을 사용하도록 수정했다. 메뉴 애니메이션 검사의 가짜 달력 날짜는 유지하되 실제 경과 시간은 고정하지 않아 재로드 후 Motion 검사가 실제로 진행되도록 했다.

## 동작과 검증

- `page=travel&travelTab=today|wallet|tools` 직접 진입·새로고침·설정 뒤로가기에서 선택 탭 복원. 탭은 ARIA tablist/tabpanel과 선택 상태·키보드 좌우/Home/End 전환을 제공.
- 일정 직접 이동, 선택 날짜 규칙, 지출/리포트의 기존 펼침 메뉴, 정산·PDF 진입, 빠른 메뉴 전환·외부 close·Back/Forward·미저장 일정 입력 보존 확인.
- 완료·취소·Undo, 진행 위치, 빠른 지출 저장 후 복귀, 예약번호·예약 편집·결제 연결, 준비물·HTML/ICS 저장의 기존 동작 확인.
- source 검사 통과: 115개 앱 모듈, 31개 스타일, 등록 브라우저 suite 48개, CLI 모듈 28개. 전체 48개 브라우저 suite를 실행했다는 뜻은 아니다.
- 통과한 브라우저 검사: trip-navigation, today-refinement, companion-passport, wallet-passbook, scroll-lock, itinerary-default-date, travel-costs, transport-reservations, reservation-expense-editor, stay-copy, sync-browser.
- `sync-navigation-regression.js`, `redesign-regression.js` 통과.
- 추가 격리 캡처: 320/390/760/1440px × 3개 탭, 총 12상태. 경과 시간을 고정하지 않은 별도 fixture에서도 탭 전환 후 일정 직접 이동과 지출 메뉴 애니메이션이 종료됨을 확인.
- `dev build --json`: 종료 코드 0, ok true. 최종 빌드 지문 `0ead78ebf24d568df2e7`.
- `dev artifacts --json`, `git diff --check` 통과. 산출물은 artifacts 하위에 보존.

IAB 도구는 탭 목록 조회는 가능했으나 탭 연결·기존 탭 조작에 `browser.user is unavailable`을 반환했다. 저장소 AGENTS.md에서 허용한 기존 격리 Edge/Playwright fixture와 브라우저 스크린샷으로 확인했다. 사용자 원래 브라우저 저장소·운영 여행은 초기화하거나 수정하지 않았다. 실제 모바일 기기 검증과 구분한다.

## 로컬 확인

[현재 실행 중인 미리보기](http://127.0.0.1:18132/Travel?page=travel&trip=today-refinement-fixture&travelTab=today). 서버 재실행은 `node scripts/preview-today-refinement.js`다. 예약 데이터가 있는 확장 fixture는 `node scripts/preview-companion-experience.js`로 확인할 수 있다.

이번 작업은 로컬 코드 수정·검증·빌드까지다. Git 커밋·푸시·운영 배포·DB/Edge Function 배포는 실행하지 않았다. 기존 작업 트리의 무관한 수정은 보존했다.
