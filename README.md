# TripLOG

TripLOG는 여행 일정, 지출, 정산, 저장 기록, 리포트를 한 화면 흐름으로 관리하는 한국어 정적 웹 앱입니다. 별도 빌드 도구나 패키지 매니저 없이 `Travel.html`, `styles.css`, `app.js`, `src/app/`의 브라우저 전역 스크립트로 동작합니다.

## 실행

```powershell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000/` 또는 `http://localhost:8000/Travel.html`을 엽니다. `index.html`은 `Travel.html`로 이동합니다. 특정 화면으로 바로 열 때는 `Travel.html?page=itinerary`, `Travel.html?page=budget`처럼 `page` 쿼리를 사용할 수 있습니다.

## 주요 기능

- **다중 여행 관리**: 여러 여행을 만들고 전환하며, 국내/해외 모드와 국가/도시/기간을 여행별로 저장합니다.
- **여행 개요**: 여행명, 기간, 목적지, 총예산, 예산 사용률, 패킹/지출 요약을 보여줍니다.
- **일정 관리**: 일차별/전체 일정 보기, 시작/종료 시간, 장소 검색, 수동 주소, 메모, 티켓/바우처 이름/코드/첨부 파일을 관리합니다.
- **지도와 동선**: Leaflet 지도, 네이버/구글 지도 링크, Google Places/Geocoding 선택 연동, Photon/Nominatim 보조 지오코딩, OSRM 경로 조회를 사용합니다.
- **지출 가계부**: 일차별 지출, 사전구매 항공/숙소 입력, 카테고리 필터, 검색, 정렬, 숙소 박수별 자동 분할을 지원합니다.
- **국내/해외 통화**: 해외 모드에서 통화, 환율, 외화 금액을 원화 지출로 환산합니다.
- **패킹 리스트**: 기본 준비물, 직접 추가, 드래그 앤 드롭 체크를 제공합니다.
- **더치페이 정산**: 현재 여행 또는 저장 스냅샷을 기준으로 참여 멤버, 개인 지출, 항목별 N분의 1/직접 입력 분담, 송금 가이드를 계산합니다.
- **통계 리포트**: 카테고리 도넛, 일차별 지출 추이, 최대 지출, 일평균, 장소별 소요 시간 인사이트를 보여줍니다.
- **저장/복원/백업**: 브라우저 저장소에 현재 여행과 스냅샷을 보관하고 JSON으로 내보내거나 가져올 수 있습니다.
- **보고서 출력**: 지출 보고서, 일정 보고서, 전체 여행 보고서를 브라우저 인쇄 기능으로 출력하거나 PDF로 저장합니다.
- **테마와 설정**: Neo/Toss 테마, 여행 모드, 기준 통화/환율, Google 지오코딩 API 키, 샘플 데이터, 초기화를 설정합니다.

## 파일 구조

```text
TripLOG/
├─ index.html                 # Travel.html로 이동
├─ Travel.html                # 앱 마크업, 7개 페이지, 모달, Leaflet CDN
├─ styles.css                 # 전체 UI와 반응형 스타일
├─ app.js                     # src/app 스크립트 순차 로더
├─ src/app/
│  ├─ core/                   # 네임스페이스, 설정, DOM 캐시, runtime 전역
│  ├─ data/                   # 국가 코드/국가명/국기 검색 데이터
│  ├─ bootstrap/              # 초기화, 이벤트 연결, 앱 시작
│  ├─ persistence/            # localStorage/IndexedDB 상태와 스냅샷 저장
│  ├─ navigation/             # 페이지 라우팅, 여행 날짜 계산
│  ├─ ui/                     # 날짜/시간/셀렉트/일차 스트립 커스텀 UI
│  ├─ shared/                 # 금액, 날짜, 합계, 포맷, SVG 유틸
│  ├─ services/maps/          # 지도 쿼리, 지오코딩, Leaflet, OSRM 경로
│  └─ features/               # 화면별 기능 모듈
└─ server.log / server.err.log # 로컬 서버 실행 중 생길 수 있는 로그
```

## 상태와 저장소

TripLOG의 런타임 상태는 전역 `state` 객체입니다. 대부분의 상태 변경은 `saveAndRender()`로 저장과 렌더링을 함께 수행합니다.

- `domesticTravelExpensePlanner.trips.v2`: 여러 여행의 현재 데이터 배열
- `domesticTravelExpensePlanner.activeTripId.v2`: 현재 선택된 여행 ID
- `domesticTravelExpensePlanner.theme.v2`: 선택한 테마
- `domesticTravelExpensePlanner.googleGeocodingApiKey.v1`: 선택적으로 저장한 Google 지오코딩 API 키
- `domesticTravelExpensePlanner.v1`: 기존 단일 여행 저장 키 겸 호환용 미러
- `domesticTravelExpensePlanner.history.v1`: 저장 스냅샷의 localStorage 미러
- IndexedDB `triplog-local-archive` / `travelSnapshots`: 저장 스냅샷의 주 저장소

모든 데이터는 사용자의 브라우저 로컬 저장소에 남습니다. JSON 내보내기 파일은 현재 여행 목록과 저장 스냅샷을 함께 담습니다.

## 개발 규칙

- npm, 번들러, 프레임워크가 없는 브라우저 전역 구조입니다. 새 기능도 이 구조를 유지합니다.
- `app.js`의 `scriptFiles` 순서가 의존성 순서입니다. 새 모듈은 필요한 전역 함수보다 뒤에, 호출 지점보다 앞에 넣습니다.
- 모듈은 `window.TripLog.register("영역.이름", { ... })`로 등록합니다. DevTools에서 `window.TripLog.registry`와 `document.documentElement.dataset.triplogLastModule`로 로드 상태를 확인할 수 있습니다.
- DOM 요소를 추가하면 `Travel.html`의 ID, `src/app/core/runtime.js`의 `els`, 이벤트 연결 위치, 렌더 함수 위치를 함께 맞춥니다.
- 상태 스키마를 바꾸면 `getFallbackState()`, 기존 저장값 정규화/마이그레이션, 샘플 데이터, 저장/복원, 관련 렌더링을 같이 확인합니다.
- 지도 기능은 외부 네트워크에 의존합니다. Google API 키가 있으면 Google Places/Geocoding을 먼저 쓰고, 없거나 실패하면 공개 지오코더와 URL/좌표 파싱을 사용합니다.
- 캐시 때문에 변경이 보이지 않으면 브라우저 강력 새로고침을 하거나 `app.js`의 `scriptVersion`, `Travel.html`의 CSS/앱 쿼리 버전을 갱신합니다.

## 검증

자동 테스트 설정은 없습니다. 변경 후 로컬 서버에서 브라우저로 확인합니다.

1. 콘솔 오류 없이 앱이 열리는지 확인합니다.
2. 변경한 페이지와 연동 페이지를 함께 확인합니다. 예를 들어 일정 변경은 지도, 지출 연동, 리포트, 저장 복원을 같이 봅니다.
3. 새로고침 후 여행, 지출, 일정, 정산 설정이 유지되는지 확인합니다.
4. 모바일 폭과 데스크톱 폭에서 탭, 폼, 표, 지도, 모달이 겹치지 않는지 확인합니다.

저장 상태를 빠르게 확인하거나 초기화할 때는 DevTools 콘솔에서 다음 키를 사용합니다.

```javascript
localStorage.getItem("domesticTravelExpensePlanner.trips.v2")
localStorage.getItem("domesticTravelExpensePlanner.activeTripId.v2")
localStorage.removeItem("domesticTravelExpensePlanner.trips.v2")
localStorage.removeItem("domesticTravelExpensePlanner.activeTripId.v2")
localStorage.removeItem("domesticTravelExpensePlanner.history.v1")
```

## Codex Skill

이 프로젝트는 개인 Codex skill `triplog`를 사용합니다. Windows 기준 `%USERPROFILE%\.codex\skills\triplog\SKILL.md`에 프로젝트 구조, 작업 규칙, 디버깅 절차가 들어 있으며, Codex 작업에서 `$triplog`로 불러올 수 있습니다.
