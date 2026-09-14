# TripLOG

TripLOG는 여행 일정, 지출, 정산, 저장 기록, 리포트를 한 화면 흐름으로 관리하는 한국어 정적 웹 앱입니다. 별도 빌드 도구나 패키지 매니저 없이 `Travel.html`, `styles.css`, `app.js`, `src/app/`의 브라우저 전역 스크립트로 동작합니다.

## 실행

운영 주소: [TripLOG](https://triplog-5qs.pages.dev/Travel?page=overview). 로컬 변경은 배포 후 운영 화면에 반영됩니다.

```powershell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000/` 또는 `http://localhost:8000/Travel.html`을 엽니다. `index.html`은 `Travel.html`로 이동합니다. 특정 화면으로 바로 열 때는 `Travel.html?page=itinerary`, `Travel.html?page=budget`처럼 `page` 쿼리를 사용할 수 있습니다.

## 주요 기능

- **다중 여행 관리**: 여러 여행을 만들고 전환하며, 국내/해외 모드와 국가/도시/기간을 여행별로 저장합니다.
- **여행 개요**: 여행명, 기간, 목적지, 총예산, 예산 사용률, 패킹/지출 요약을 보여줍니다.
- **오늘의 여행**: 개요의 `오늘의 여행 시작`에서 다음 미완료 장소·길찾기·완료율·하루 가용 예산을 확인합니다. PC에서는 일정과 예산이 나란히 표시됩니다.
- **일정 점검과 지연 조정**: 겹치는 시간과 부족한 이동 시간을 찾고 0·15·30·60분 지연을 반영한 미리보기를 제공합니다. 완료·잠금 일정은 보호하며, 적용 후 한 번 되돌릴 수 있습니다.
- **예약 지갑**: 항공·숙소 사전구매와 일정 바우처를 모아 보고 직접 예약을 추가·수정·삭제합니다. 예약번호 복사, 예약 링크 열기, 일정 연결을 지원하며 지출을 중복 생성하지 않습니다.
- **여행 도구**: 여행지 시간대로 ICS 일정을 내보내고, 일정·예약번호·예산 포함 여부를 선택하여 독립 HTML 포켓노트를 저장합니다. 포켓노트는 오프라인에서 읽을 수 있습니다. iPhone 캘린더 가져오기 안내는 ICS 다운로드 후 표시됩니다.
- **일정 관리**: 일차별 타임라인에서 시간과 장소를 확인합니다. `일정 추가`를 누르면 지도와 입력 패널이 열리며, 장소 검색·직접 입력·시작/종료 시간·메모·티켓/바우처를 저장한 뒤 타임라인으로 돌아옵니다. 이동 정보는 일정 사이에서 펼쳐 편집하고, 전체 일정·준비물·시간 통계는 여행 메뉴에서 확인합니다.
- **지도와 동선**: Leaflet 지도, 네이버/구글 지도 링크, Google Places/Geocoding 선택 연동, Photon/Nominatim 보조 지오코딩, OSRM 경로 조회를 사용합니다.
- **지출 가계부**: 결제일·결제한 사람·결제 방식을 기록하고, 사전구매 항공/숙소 입력, 카테고리 필터, 검색, 정렬, 숙소 박수별 자동 분할을 지원합니다.
- **국내/해외 통화**: 해외 모드에서 통화, 환율, 외화 금액을 원화 지출로 환산합니다.
- **패킹 리스트**: 준비물 체크, 직접 추가·삭제, 순서 이동과 자동 저장을 제공합니다.
- **더치페이 정산**: 현재 여행 또는 저장 스냅샷을 기준으로 참여 멤버, 개인 지출, 항목별 N분의 1/직접 입력 분담, 송금 가이드를 계산합니다.
- **통계 리포트**: 카테고리별 지출 비율, 실제 결제일별 지출, 일자별 일정 수·체류·이동 시간을 보여줍니다.
- **저장/복원/백업**: 브라우저 저장소에 현재 여행과 스냅샷을 보관하고 JSON으로 내보내거나 가져올 수 있습니다.
- **보고서 출력**: 지출 보고서, 일정 보고서, 전체 여행 보고서를 브라우저 인쇄 기능으로 출력하거나 PDF로 저장합니다.
- **여행·계정 설정**: 프로필, 여행 모드, 통화·환율, 공유 범위와 백업·복원을 관리합니다. 연결 설정은 고급 설정에서 확인합니다.

## 전체 화면 개편

승인된 [13개 목업](docs/redesign-20260913/README.md)을 기준으로 공통 메뉴, 6개 주요 페이지, 로그인과 입력·준비물·초대·기록 화면을 구현했습니다. 일정 타임라인과 지도 편집 창도 같은 색상 체계를 사용합니다.

- 화면 구성과 연결: `src/app/features/redesign/design-workspace.js`
- 정산·차트의 표시 계산: `src/app/features/redesign/design-model.js`
- 디자인 토큰·반응형: `src/styles/redesign.css`
- 검증 결과와 비교 이미지: [design-qa.md](design-qa.md)
- 여행 동행 기능의 [6개 목업과 구현 기준](docs/travel-companion-20260914/implementation.md): `src/app/features/travel-companion/`, `src/styles/travel-companion.css`에 구현했습니다. 무료로 기기에서 계산하며 유료 API를 추가하지 않습니다.
- 영수증 OCR은 기기 안의 Tesseract.js로 실행합니다. 넓게 떨어진 글자를 읽는 모드를 사용하며, 모호한 금액은 직접 확인합니다. 날짜·통화·금액을 확인한 뒤 지출 입력창에 반영하고 저장합니다.

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
- `domesticTravelExpensePlanner.theme.v3`: 선택한 테마
- `domesticTravelExpensePlanner.googleGeocodingApiKey.v1`: 선택적으로 저장한 Google 지오코딩 API 키
- `domesticTravelExpensePlanner.v1`: 기존 단일 여행 저장 키 겸 호환용 미러
- `domesticTravelExpensePlanner.history.v1`: 저장 스냅샷의 localStorage 미러
- IndexedDB `triplog-local-archive` / `travelSnapshots`: 저장 스냅샷의 주 저장소

모든 데이터는 사용자의 브라우저 로컬 저장소에 남습니다. JSON 내보내기 파일은 현재 여행 목록과 저장 스냅샷을 함께 담습니다.

여행별 `travelCompanion`에는 완료·잠금 일정 ID, 직접 등록한 예약, 시간대와 마지막 시간 조정 기록을 저장합니다. 기존 백업에 이 필드가 없어도 빈 기본값으로 복원합니다. 일정 공유를 끄면 예약 지갑과 진행 상태도 서버 공유 스냅샷에서 제외하며, 시간 조정 되돌리기 기록은 공유하지 않습니다.

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

## 영수증으로 지출 입력

지출 기록의 **영수증으로 입력**에서 촬영하거나 사진을 선택합니다. 한국어+영어, 일본어+영어, 영어 인식을 지원하며, 회전·영역 자르기 후 상호, 결제일, 최종 금액, 통화, 항목, 결제 방식을 검토할 수 있습니다. 인식이 어려우면 사진에서 복사한 글자를 붙여넣을 수도 있습니다.

**지출 폼에 채우기**는 입력값만 반영합니다. 기존 지출 폼에서 **추가/저장**을 눌러야 지출로 저장됩니다. 여행 기간 밖의 결제일은 기록할 여행 일자 또는 사전구매를 직접 선택합니다. 외화는 해외 모드에서 기존 환율로 환산하며, 환불/취소·모호한 총액/통화는 직접 확인합니다.

- OCR은 Tesseract.js 6.0.1 / Tesseract.js-core 6.1.2의 LSTM 엔진과 tessdata_fast 4.1.0으로 브라우저에서 실행합니다. 유료 API나 OCR 서버가 필요하지 않습니다.
- 실행 파일과 한국어·영어·일본어 모델은 `vendor/receipt-ocr/`에서 필요할 때만 로드합니다. 언어 모델은 브라우저에 캐시하고, 인식 창을 닫으면 엔진 메모리를 해제합니다.
- HEIC는 브라우저에서 먼저 열고, 필요할 때만 heic2any 0.0.4로 기기 내 변환합니다. 변환 실패 시 JPG/PNG 안내를 표시합니다.
- 사진과 원문 전체는 저장/업로드하지 않습니다. 저장한 지출에는 중복 확인용 파일 해시와 확인한 결제일만 `receipt` 메타데이터로 추가됩니다. 기존 지출 수정·JSON 내보내기·여행 동기화 시 함께 유지됩니다.
- iPhone 14 Pro의 393×852 화면을 기준으로 구성했습니다. 데스크톱 브라우저의 모바일 크기 검증과 실제 iOS Safari의 성능 검증은 구분해야 합니다.

추출 로직 회귀 검증: `node scripts/receipt-parser-regression.js`. 배포 파일 생성: `npm run build`.

## Codex Skill

이 프로젝트는 개인 Codex skill `triplog`를 사용합니다. Windows 기준 `%USERPROFILE%\.codex\skills\triplog\SKILL.md`에 프로젝트 구조, 작업 규칙, 디버깅 절차가 들어 있으며, Codex 작업에서 `$triplog`로 불러올 수 있습니다.
