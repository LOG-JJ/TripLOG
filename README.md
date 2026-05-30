# TripLOG ✈️

여행 일정, 지출, 정산, 리포트를 한 번에 관리하는 정적 웹 앱입니다. 빌드 도구 없이 `Travel.html`, `styles.css`, `app.js`, `src/app/`의 브라우저 전역 스크립트로 동작합니다.

## 🚀 실행

```powershell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000/` 또는 `http://localhost:8000/Travel.html`을 엽니다. `index.html`은 `Travel.html`로 자동 이동합니다.

## ✨ 주요 기능

- 🧭 **여행 개요**: 여행명, 날짜 범위, 총예산, 패킹/지출 요약을 표시합니다.
- 💸 **지출 가계부**: 일차별 지출 입력, 카테고리 필터, 검색, 정렬, 숙소 박수별 자동 분할을 지원합니다.
- 🌍 **국내/해외 모드**: 해외 모드에서 통화, 환율, 외화 금액을 원화 지출로 환산합니다.
- 🗺️ **일정 관리**: 시간, 이동수단, 장소, 메모를 기록하고 일정 비용을 지출 항목으로 연동할 수 있습니다.
- 📍 **지도/동선**: Leaflet 지도, Photon/Nominatim 지오코딩, OSRM 경로 조회로 일정 동선을 그립니다.
- 🎒 **패킹 리스트**: 기본 준비물, 직접 추가, 드래그 앤 드롭 체크를 제공합니다.
- 🧾 **더치페이 정산**: 현재 여행 또는 저장 기록을 기준으로 멤버별 분담금과 송금 가이드를 계산합니다.
- 📊 **통계 리포트**: 카테고리 도넛, 일차별 추이, 최대 지출, 일평균, 장소별 소요 시간을 보여줍니다.
- 💾 **저장/복원**: `localStorage`에 현재 상태와 저장 스냅샷 기록을 보관합니다.
- 📄 **인쇄/PDF**: 브라우저 인쇄 기능으로 여행 경비 보고서를 출력합니다.

## 📁 파일 구조

```text
TripLOG/
├─ index.html                 # Travel.html로 리다이렉트
├─ Travel.html                # 앱 마크업, 탭 화면, Leaflet CDN
├─ styles.css                 # 전체 UI 스타일
├─ app.js                     # src/app 스크립트 순차 로더
├─ src/app/
│  ├─ core/                   # 네임스페이스, 설정, DOM/runtime 전역 상태
│  ├─ bootstrap/              # 초기화, 이벤트 연결, 앱 시작
│  ├─ persistence/            # localStorage 상태 로드/저장
│  ├─ navigation/             # 탭 라우팅, 여행 날짜 계산
│  ├─ ui/                     # 날짜/시간/셀렉트/일차 스트립 커스텀 UI
│  ├─ shared/                 # 금액, 날짜, 합계, 포맷, SVG 유틸
│  ├─ services/maps/          # 지도 쿼리, 지오코딩, Leaflet, OSRM 경로
│  └─ features/               # 지출, 일정, 정산, 리포트, 패킹 등 화면 기능
└─ design_mockups/            # UI 참고용 목업 이미지
```

## 🛠️ 개발 메모

- `app.js`의 `scriptFiles` 순서가 의존성 순서입니다. 새 모듈은 필요한 전역 함수보다 뒤에, 호출 지점보다 앞에 넣습니다.
- 각 모듈은 `window.TripLog.register("영역.이름", { ... })`로 등록되어 DevTools에서 `window.TripLog.registry`로 확인할 수 있습니다.
- 핵심 상태는 `state`이며 저장 키는 `domesticTravelExpensePlanner.v1`, 기록 키는 `domesticTravelExpensePlanner.history.v1`입니다.
- 지도 기능은 외부 네트워크(Leaflet CDN, CARTO 타일, Photon, Nominatim, OSRM)에 의존하므로 오프라인에서는 일부 기능이 제한됩니다.
- 자동 테스트 설정은 없습니다. 변경 후 로컬 서버에서 개요, 지출 입력, 일정 지도, 정산, 리포트, 설정 탭을 브라우저로 스모크 테스트하세요.

## 🤖 Codex 전용 Skill

Codex를 사용하는 개발자는 프로젝트 전용 skill을 개인 Codex skills 디렉터리에 `triplog` 이름으로 등록해 사용할 수 있습니다. 예를 들어 `~/.codex/skills/triplog/` 또는 Windows의 `%USERPROFILE%\.codex\skills\triplog\`에 `SKILL.md`를 두면, 다음 작업부터 `$triplog`로 이 저장소의 구조와 디버깅 규칙을 불러올 수 있습니다.
