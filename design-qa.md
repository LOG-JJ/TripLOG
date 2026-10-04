# Illustrated postcard mobile correction — 2026-10-04

final result: passed

- User requirement: original hand-drawn postcard mood; information left and artwork right on both mobile and desktop.
- Mobile visual truth: `triplog-trip-header-mobile-postcard-20261004.png`; desktop visual truth: `triplog-trip-header-postcard-20261004.png`. The rejected photo/banner concept is excluded from implementation.
- Source/render comparison: mobile source normalized to 354 × 152 versus actual 354 × 172 at 390 × 844, scale 1; desktop source 912 × 246 versus actual 912 × 232 at 1440 × 1000. Live controls account for the mobile height difference.
- Full and magnified comparisons: `docs/trip-header-mobile-20261004/comparison-mobile.png`, `comparison-mobile-detail.png`, `comparison-desktop.png`. Responsive evidence includes both sides of 600/768px and long titles; final in-app proof is `final-iab.jpg`.
- Fixed the 104px floating mobile image, hard crop edge, oversized divider, intermediate-width wrapping and failed offline image after responsive source changes. Suncheon now has original-style landscape/portrait WebP assets. All eleven test widths preserve left/right placement and bottom alignment.
- Required typography, spacing, color, image and copy surfaces reviewed. Monochrome library icons and 44px controls are intentional runtime differences. Physical mobile/Safari remain untested.
- Core tests, header/city-cache/trip-chooser/reservation browser checks and build passed; actual in-app controls/rendering verified with zero error logs.
- [Detailed QA, exact image provenance, findings and checks](docs/trip-header-mobile-20261004/design-qa.md).

---


# Destination Postcard header and destination scenes — 2026-10-04

final result: passed

- Visual truth: `triplog-trip-header-postcard-20261004.png`, the exact user-selected first header concept, SHA256 `ce5f368a29ca49effc244b120a887567f298e3c4e1c493ffc03696c3453e1e97`.
- Same-width comparison: source frame normalized to 912 × 246; implemented header 912 × 232 at a 1440 × 1000 viewport and scale 1, with matching Suncheon/D-6/October 10–11/two-person data. Full and focused evidence: `docs/trip-header-20261004/comparison-final.png`, `comparison-final-type.png`.
- Resolved P2 inherited small type, weak countdown/metadata hierarchy, oversized long-name height and intermediate-width control/art overlap. Tested 320–1440 px, with a visible mobile illustration and intact trip/member controls.
- Catalog has 80 country-aware destinations, 30 dedicated illustrations and 10 common themes. All 40 T2I source hashes and optimized assets verified. Unknown/ambiguous/multi-destination and parent-region rules preserve actual trip data.
- City artwork loads on demand into a separate 48-entry cache. Real offline, unvisited-image fallback, concurrent cache bounds, API/HTML exclusion, first-visit warming and existing safe auto-update tests pass.
- Core tests, relevant trip-library/chooser/reservation regressions, `npm run build` and actual in-app browser rendering/interactions pass. Source/render typography, spacing, colors, imagery and copy reviewed. Finer watercolor details, standard library icons and badge geometry are accepted P3 differences; physical mobile/Safari remain untested.
- Detailed evidence, generation provenance, comparison history, loading behavior and verification: [trip header QA](docs/trip-header-20261004/design-qa.md).

---

# Compact two-column reservation summary — 2026-10-04

final result: passed

- Selected visual truth: `triplog-reservation-t2i-brand-editorial-20261004.png`, verified against the exact Image Gen original (1566 × 1005, SHA256 `f1ea723a2e566d653f3f87fe77c34beca6cfe8e3a3b6185b2a4d9f0a4bacc8d3`). A prior concurrent latest-file save mismatch was corrected before final comparison.
- Equal-width comparison: original panel crop normalized to 354 × 221; rendered component 354 × 232 at a 390 × 844 viewport, scale 1. Full, 2× and focused evidence: `docs/reservation-summary-20261004/comparison-final.png`, `comparison-final-2x.png`, `comparison-final-text.png`.
- Resolved P2 layout inheritance/row-class collision and excess height/small category type. The final component keeps equal columns at 320–1440 px, loaded local Pretendard, compact real raster artwork and aligned yellow actions.
- The summary shows one representative transport and up to two stays; badges retain complete counts and the full wallet preserves all original records. Empty columns open the correct-type reservation form directly.
- Five fidelity surfaces, responsive/long/empty states, wallet navigation, keyboard focus, direct add/cancel/save/reload, wallet/editor browser regressions, `npm test` and `npm run build` passed. In-app browser rendering and wallet interaction verified. Generated asset detail and the established logo have minor accepted P3 differences; physical mobile/Safari remain untested.
- Detailed evidence, comparison history, normalization, behavior and limitations: [reservation summary QA](docs/reservation-summary-20261004/design-qa.md).

---

# Reservation cards — empty-state refinement, 2026-10-04

final result: passed

- Source: `triplog-reservation-empty-refined-20261004.png`, 1891 × 832, proportionally normalized to 682 × 300. Implementation: both cards empty, 682 × 300 CSS pixels (PNG 682 × 301 fractional clip), 1440 × 1000 viewport, device scale 1.
- Final evidence: `docs/reservation-empty-20261004/comparison-final.png`, `comparison-final-text.png` and `empty-desktop.png`. Populated-card evidence: `pockets-1440.png`.
- Resolved P2 findings: fragmented empty composition, insufficient inside padding, oversized category type, action touching the paper edge, and insufficient paper clearance for populated rows. Heading counts are now in layout; empty cards have coherent copy and aligned textured yellow actions.
- The five fidelity surfaces (font/type, spacing, colors, artwork and copy) pass. New and populated states, 320–1440 px responsive widths, keyboard focus, direct correct-type entry, cancellation, save/reload, existing wallet/edit flows and `npm test` pass. The local in-app browser confirms real rendering and interactions.
- User heading feedback resolved: category labels shifted down 4 px; live type changed from 18 px/800/−0.5 px tracking to 19.5 px/750/−0.2 px. Both states and all tested widths pass again.
- Detailed comparison history, exact source/implementation paths, normalization, validation and P3 limits: [reservation empty-state QA](docs/reservation-empty-20261004/design-qa.md).

---

# Reservation Passport Pockets — 2026-10-04

final result: passed

- Selected target: `triplog-reservation-passport-pockets-refined-20261003.png` (1829 × 860), normalized to 682 × 321. The final component is 682 × 322 CSS pixels in a 1440 × 1000 viewport, density 1; the lossless element screenshot includes one fractional boundary pixel and is 682 × 323.
- Implementation screenshot: `docs/reservation-pockets-20261003/pockets-desktop-final.png`. Full and focused comparisons: `comparison-final.png` and `comparison-final-text.png` in the same folder.
- State: synthetic three transport/two accommodation reservations matching the source content. Exact shared schedules are intentionally grouped as `2건` + `1건`; all three records remain reachable in the wallet.
- Resolved P2 issues: inherited desktop grid/flex rules, small/heavy type and unbalanced line wrapping, and an unregistered font family that caused system-font fallback. The component now uses the actual bundled Pretendard face, measured role weights and text widths, balanced hotel names, aligned dates and times, and count-tab clearance.
- Fonts, spacing, color, raster asset fidelity and app copy were compared against the same-size source. Mobile stacking, 320/390/480/600/768/1440 layouts, empty/long/mixed data, keyboard and wallet navigation were checked. Relevant browser regressions, `npm test`, and `npm run build` passed.
- In-app browser page identity/rendering and interactions were verified. No app error was found; blocked exchange-rate requests and connection retries are expected in the isolated preview. Standard icon shapes and generated texture details retain minor P3 differences. Physical mobile/Safari testing remains unavailable.
- Full comparison history, evidence and implementation checklist: [reservation pocket design QA](docs/reservation-pockets-20261003/design-qa.md).
- Follow-up P2 resolved: the user's production screenshot exposed native vertical centering in empty buttons. Explicit top-aligned flex layout separates the heading/chevron from the count tab, with a new geometry regression for populated and empty cards. Corrected evidence: `docs/reservation-pockets-20261003/empty-desktop.png` and `empty-320.png`. Targeted browser regression and build passed again.

---

# Passport Library — 2026-10-03

final result: passed

## Visual target and evidence

- Selected visual: `triplog-home-passport-library-20261003.png`, option 1 displayed in the prior ideation turn. Source pixels 853 × 1844; normalized to 390 × 844 for comparison.
- Implemented route: `/Travel?page=start`. Isolated preview: `http://127.0.0.1:18086/Travel?page=start` (synthetic records; no production account or writes).
- Browser screenshot: `docs/home-passport-20261003/home-390.png`, 390 × 844 CSS pixels and image pixels, device scale factor 1. Screenshots at 320, 768 and 1440 CSS pixels are in the same folder.
- Full-view comparison: `comparison.png`. Focused comparisons: `comparison-header.png` and `comparison-covers.png`. Both sides use the same content, current date (2026-10-03 Asia/Seoul), filter and no selection.
- In-app browser additionally exercised past/all filters, opening the Osaka passport, returning through the brand link, and opening/cancelling the new-trip form. Its capture is `C:/Users/tbdk5/AppData/Local/Temp/TripLOG-home-iab-mobile-20261003.png`.

## Comparison history

1. Initial implementation: [P2] the previous desktop `#rdTripList` rule forced two enormous columns. Added scoped library breakpoint rules, verified 2 columns at 320/390, 3 at 768 and 4 at 1440.
2. Initial comparison: [P2] transparent exterior padding made the pink passport smaller than the blue one. Aligned the existing raster artwork to the measured card slot while preserving the stitched cover. New full-view and cover comparisons show aligned top/bottom edges and consistent dimensions.
3. Initial comparison: [P2] the grid started about 10 px below the target, and the Japanese trip title wrapped unevenly. Adjusted header/heading spacing and used balanced wrapping within the two-line title area. The final composition preserves the target's first viewport, two rows and yellow creation cover.
4. Functional QA found the old edit-cancel flow would leave the new library hidden. Both cancel and successful save now render the collection again; automated UI interactions cover both paths.

## Required fidelity surfaces

- **Typography:** existing local Pretendard and TripLOG wordmark; compact title/body/metadata roles. Balanced two-line trip titles preserve the full name in the accessible button label. Search input uses 16 px entered text to avoid iOS focus zoom, with a compact placeholder. Footer destination labels are decorative metadata, while trip names/dates remain readable above the illustration.
- **Spacing/layout:** 390 px frame has 16 px side padding, a compact search field, pills and two passport columns. 320 px remains free of horizontal overflow. Larger screens use three/four columns and retain the passport aspect ratio rather than stretching cards horizontally. No trip-scoped bottom navigation appears on the collection.
- **Colors:** warm `#fffdf7` paper, ink `#202730`, yellow `#ffeb50`, pink/blue/mint passport covers, high-contrast selected filters and clear focus outlines.
- **Images:** generated individual raster backgrounds for blue, pink, mint, generic travel and yellow creation covers, grounded in the chosen image. PNG originals are retained in `assets-original/`; deployed WebP images total 1,176,610 bytes, versus 11,680,397 bytes of source PNGs. Standard icons use the existing Phosphor font; no handmade SVG or CSS illustration substitutes.
- **Copy:** fixed Korean copy matches the selected concept. Trip names, dates, counts, remaining days and destinations come from the actual scoped repository. Only test fixtures use the sample trips. Unknown dates, very long names, no matches and an empty collection have explicit states.

## Behavior and regression checks

- Root entry, existing `page=overview` home bookmark without a trip, PWA start URL and post-login default open the library.
- Selecting a passport opens that trip's overview and records its ID in the route. Reload and browser back/forward retain the intended trip. Explicit itinerary/expense links remain supported; missing trip links return to the collection.
- NFKC/whitespace-insensitive search, upcoming/ongoing/past filters, reset/empty states, profile, keyboard activation and new-trip cancellation work.
- New-trip creation opens the new overview; repeated submit during simulated storage latency creates exactly one record. Existing trip edit/cancel/save and chooser deletion/recovery remain reachable.
- Repository updates refresh another trip's title without entering it. Selection/search/navigation preserve original itinerary/expense data. Hidden records and automatic empty placeholders are excluded.
- `npm test` passed. Browser regressions passed in batches: the first full run exposed an existing calendar fixture tied to September; fixing that test's date and rerunning it and the remaining suite passed. Authentication, sync, offline/update recovery, chooser deletion, itinerary, maps, wallet, expense, receipt and manual exchange-rate regressions passed.
- Isolated browser page errors: zero. IAB logged expected exchange-rate fetch warnings because the preview deliberately blocks external services; no uncaught app error or error overlay. Runtime production verification is reported separately after Git-based deployment.

## Intentional differences / remaining limits

- Illustrated texture/stroke details are regenerated assets and standard icons, so they are not pixel-identical to the generated mockup. The same paper/passport composition, hierarchy and material direction are preserved (P3).
- English destination labels derive from saved destination fields; a title mentioning two cities does not invent a second stored city. Non-Korean/Japanese destinations use a neutral travel sketch.
- Desktop and empty/long-title states extend the selected mobile-only reference. Physical iOS/Android device testing was not available; responsive Chromium and the in-app browser were verified.

No actionable P0/P1/P2 findings remain.


---

# 예약 지갑 — 선택한 1안 Ticket Passbook 구현 (2026-09-23)

final result: passed

- 정확한 선택 기준: 가장 최근 목업 세트의 첫 번째 표시 이미지 `triplog-wallet-ticket-passbook-20260923.png` (`exec-0ea43d20-7bf5-4dca-b3b3-34aa145f5958.png`). 오늘·점검·도구의 Pocket Passport 톤을 예약 탭에도 적용했다.
- 구현: 대표 예약의 출발/도착·왕복 날짜 또는 숙소 체크인/체크아웃을 티켓으로 표시하고, 나머지는 날짜/종류/제목/예약번호 동작이 있는 작은 색인 목록으로 구성했다. 기존 검색·필터·정렬·상세·원본 지출 수정·직접 예약 등록/수정·예약번호 복사 흐름을 유지했다. 실제 모델에서 읽은 값만 표시하며 같은 항공권도 독립 레코드로 보존한다.
- 이미지 자산: 헤더 손글씨와 항공권 스탬프는 내장 ImageGen으로 개별 생성했다. 원본·프롬프트·배치용 크롭은 `docs/wallet-passbook-20260923/asset-*.prompt.md`에 기록했다. 티켓 절취 홈은 선택된 원본 이미지의 해당 가장자리 픽셀을 재사용했다. 표준 아이콘은 기존 Phosphor, 로고/글꼴은 기존 TripLOG 자산을 사용한다.
- 비교 입력: `docs/wallet-passbook-20260923/comparison.png`에서 원본과 390px 실제 화면을 나란히 정규화했다. 원본의 OS 상태 표시줄은 앱 소유 영역이 아니므로 비교에서 제외했다. 데스크톱에서는 기존 동행 도구와 동일한 최대 480px 패널을 사용한다.
- [P2, 해결] 첫 구현에서 320px 예약번호 버튼이 두 줄로 깨지고 390px 마지막 예약이 첫 화면 아래로 밀렸다. 공용 버튼 스타일의 우선순위를 바로잡고 헤더/티켓/행 높이를 줄였으며, 목록에서는 반복 항공권 접두어와 긴 날짜 문장을 압축했다. 다시 촬영한 320/390px에서 버튼 줄바꿈과 가로 넘침이 없고 기본 5건이 첫 화면에 표시된다.
- [P2, 해결] 생성된 항공 스탬프의 외곽 액자가 티켓 안에 중첩됐다. 원본에서 손글씨와 작은 태그라인만 비례 크롭해 목업의 열린 스텁 구성에 맞췄다. 후속 비교에서 미해결 P0/P1/P2 없음.
- 의도적 차이: 실제 예약에 없는 공항 코드나 스캔용 바코드는 만들지 않는다. 출발까지 남은 일수는 여행지 시간대와 실제 예약일로 계산한다. 닫기 버튼은 기존 앱 사용 흐름을 위해 유지한다. 호텔 이름과 코드 등은 실제 레코드가 기준이며 목업의 예시 값을 저장하지 않는다.
- 검증 경로: 지출 → 더보기 → 예약 지갑 → 필터/정렬/상세/예약번호 입력 → 최신 지출 수정창 → 저장 → 예약번호 복사, 직접 예약 등록/수정 → 재접속. 320/390/768/1440px, 긴 제목·긴 번호·날짜 미정·빈 목록·항공/숙소/일반 교통을 격리 fixture로 검증했다. Browser plugin 부재로 저장 검증은 기존 Playwright/Edge를 사용했고, IAB에서도 화면 및 숙소/전체 필터 전환을 확인했다. IAB 오류 로그 0건.
- `npm test` 통과. 브라우저 회귀에서 자정 이후 기존 오늘 fixture가 빈 다음 날을 선택하는 테스트 의존성을 발견해 테스트가 채워진 fixture 날짜를 명시하도록 보정했다. 그 전까지 통과한 회귀는 유지하고 해당 검사 및 이후 모든 회귀를 재실행해 통과했다. 새 `wallet-passbook-browser-regression.js`도 기본 실행 목록에 포함했다.
- 격리된 실제 코드 미리보기: http://127.0.0.1:8133/Travel?page=budget (가상 예약, 외부 네트워크 차단). 운영 계정의 지출/예약 데이터를 테스트로 수정하지 않았다.
- 운영 배포 완료: https://447ca7f6.triplog-5qs.pages.dev (`main`), 빌드 `cc8c00b843a1677c2694`. HTML·변경 JS/CSS·이미지·서비스 워커 9개 파일 모두 HTTP 200 및 로컬 `dist`와 SHA-256 일치. 운영 origin에서도 격리된 예약 지갑 회귀 검사를 통과했다. 배포 후 스크린샷: `C:/Users/tbdk5/AppData/Local/Temp/TripLOG-Wallet-Passbook-Production-20260923/wallet-390.png`.

---

# 지출 카테고리·정렬 메뉴와 필터 유지 (2026-09-22)

시각·동작 검증: passed

- 요청: 지출 항목을 열 때 해당 카테고리로 자동 필터링하지 않고, 카테고리·최신순 메뉴를 현재 TripLOG 톤에 맞는 작은 글씨와 컴팩트한 간격으로 통일.
- ImageGen 참조: `triplog-expense-dropdowns-compact-20260922.png`. 기존 지출 디자인 이미지를 참조해 한 번 생성했으며, 프롬프트와 출처는 같은 이름의 `.prompt.md`에 기록했다.
- 실제 구현: 200px 메뉴, 12px 글씨, 34px 행, 36px 검색·메뉴 버튼. 흰 바탕/잉크색 테두리/노란 선택 행/작은 선 아이콘/오른쪽 체크 표시를 구현했다. 정렬은 최신순·오래된순·금액·가나다순으로 묶었다.
- 원본과 구현을 같은 이미지에서 비교: `docs/expense-dropdowns-20260922/comparison.png`. 공용 스타일에서 새어 나오던 4px 행 간격과 42px 검색 입력 높이를 제거했다. 해결되지 않은 레이아웃/가독성 문제 없음.
- 제품에 맞춘 차이: 목업의 임의 숫자 뱃지는 넣지 않고 실제 선택값을 표시한다. 작은 모바일 화면에서는 기존 검색/필터 펼치기 흐름을 유지하고 메뉴 두 개를 다음 줄에 배치한다. 모바일 입력 글씨는 iOS 확대 방지를 위해 16px, 힌트와 메뉴 글씨는 12px이다.
- 지출 제목·카테고리 표시·기존 항공권을 열고 취소/저장해도 명시적으로 선택한 필터·검색어·정렬·탭을 보존한다. 사전구매 열기/저장의 강제 카테고리 전환 및 검색어/탭 초기화를 제거했다. 저장 후 현재 조건에 보이는 항목만 강조한다.
- 격리된 가상 여행으로 새 항공권/숙소 저장까지 검증했다. 실제 계정은 메뉴의 읽기 전용 확인에만 사용했으며 실제 지출을 수정하지 않았다. Browser plugin 부재로 저장/동작 검증은 기존 Playwright/Edge 경로를 사용했다.
- `scripts/expense-filter-browser-regression.js`: 320/390/1440px에서 팝업 너비/높이/글씨/전체 페이지 넘침, 명시적 선택, 방향키/Enter/Escape/포커스 복귀, 외부 클릭 닫기, 필터 유지 통과. 기본 브라우저 회귀 실행 목록에 추가했다.
- `npm test`, `npm run test:browser`, `npm run build` 전체 통과. 운영 배포 `https://cfeebed2.triplog-5qs.pages.dev`, 빌드 `cfc969ccfecf628160c4`. 운영 HTML·변경 JS/CSS·서비스 워커 7개 파일 모두 HTTP 200 및 로컬 빌드와 SHA-256 일치. 운영 origin의 격리 브라우저 회귀도 통과했다.

---

# NEXT STOP 티켓 왼쪽 절취 디테일 (2026-09-22)

final result: passed

- 사용자 지적: 선택한 목업의 실제 종이 티켓 같은 절취 가장자리가 구현에서 직선으로 단순화되어 있었다.
- 시각 기준: `triplog-companion-pocket-passport-20260922.png`의 왼쪽 티켓. Image Gen으로 해당 가장자리만 제작하고 한 반복 단위를 `src/assets/companion-ticket-edge.png`로 분리했다. 생성 프롬프트와 원본/추출 정보는 `docs/companion-redesign-20260922/ticket-edge.prompt.md`에 기록했다.
- 수정: 기존 왼쪽 6px 직선 테두리를 투명하게 만들고, 8px 너비·12px 간격의 반복 이미지로 반원형 종이 절취 홈을 표시했다. 높이에 따라 반복하므로 긴 이름이나 화면 크기에 따라 홈이 늘어나지 않는다. `pointer-events: none`으로 버튼과 겹쳐도 입력을 가로채지 않는다.
- [P2, 해결] 첫 적용의 16px 간격이 목업보다 성겼다. 원본의 약 13px 간격(모바일 정규화 시 약 11px)을 비교한 뒤 12px로 조정했다.
- 최종 시각 비교: `docs/companion-redesign-20260922/ticket-edge-comparison.png`. 원본과 구현의 티켓 및 가장자리를 하나의 이미지에서 나란히 확대 비교했다. 미해결 P0/P1/P2 없음.
- 글꼴/내용/색/여백은 기존 티켓을 유지했고, 이미지 가장자리의 알파/명암과 작은 화면에서의 반복을 확인했다. 320/390/768/1440px, 긴 이름, 완료/길찾기 및 기존 오늘·점검·도구 동작 회귀 통과. in-app browser에서도 실제 반복 표시를 확인했다.
- 빌드 통과 및 운영 재배포 완료: https://aac01ff5.triplog-5qs.pages.dev (production `main`), 빌드 `5862d0d8ad046cafd4f2`.
- 운영 HTML/서비스 워커/CSS/새 PNG가 모두 HTTP 200이며 로컬 빌드와 SHA-256이 일치했다. 실제 운영 origin을 대상으로 격리 fixture 브라우저 회귀도 통과했다.

---

# 오늘의 여행 — 2안 Pocket Passport 구현 (2026-09-22)

final result: passed

후속 요청으로 운영 배포까지 완료했다. 운영 주소는 https://triplog-5qs.pages.dev/Travel?page=overview 이며, 배포 `f92aa351`, 빌드 `81656a701dd6ca26e8af`이다. 운영 파일 일치 및 배포된 origin의 격리 브라우저 회귀가 통과했다. 상세 기록: `docs/companion-redesign-20260922/production-release.md`. 아래의 로컬 구현 범위 서술은 배포 요청 전 최초 검증 당시의 기록이다.

## 비교 기준과 결과

- 선택한 시안은 가장 최근 세 가지 제안 중 두 번째로 표시한 `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/triplog-companion-pocket-passport-20260922.png`이다. 이전 이동 정보의 2번 시안과 구분했다.
- 구현 범위: 오늘의 여행의 오늘/점검/도구 탭, 시간 조정 확인 및 예산 설명 창. 기존 예약 지갑은 계속 연결된다.
- 실제 코드 미리보기: http://127.0.0.1:18083/Travel?page=overview . 가상 여행/가상 계정으로 격리했으며 외부 Supabase 요청을 차단했다. 운영 계정 데이터는 테스트에 사용하지 않았다.
- 최종 비교에서 미해결 P0/P1/P2 없음. 아래에 명시한 실제 데이터 및 모바일 밀도에 따른 차이는 의도한 제품 동작이다.

## 시각 증거와 정규화

증거 폴더: `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/docs/companion-redesign-20260922/`.

- `passport-comparison.png`: 상단 원본의 세 화면, 하단 구현의 세 화면을 한 이미지 안에 배치해 비교했다.
- `passport-detail-comparison.png`: 다음 장소 티켓과 점검표의 글자·열 간격을 같은 이미지의 좌우 영역에서 확대 비교했다.
- `passport-implemented.png`: 실제 구현한 세 화면만 모은 이미지. `today-implemented.png`, `review-implemented.png`, `tools-implemented.png`에 개별 캡처를 보관했다.
- `passport-comparison-initial.png`: 최종 수정 전 비교본. 숫자 열이 좁고 오프라인 저장 버튼이 지나치게 강조된 상태가 남아 있다.
- 원본은 1477×1065px이며 각 앱 화면 영역 `(19,10)-(479,1054)`, `(509,10)-(969,1054)`, `(999,10)-(1459,1054)`를 각각 390×885px로 정규화했다. 원본의 바깥 여백과 그림자는 앱 바깥의 제시용 캔버스다.
- 구현 비교 캡처는 390×900 CSS px, deviceScaleFactor 1. 원본 정규화본보다 높이가 15px 크다는 점을 비교에 반영했다. 가상 날짜/장소의 내용은 동일한 주제를 사용하되 실제 시간 계산 결과를 표시했다.
- 추가 검증: 320×844, 390×844, 768×1050, 1440×1050. `{today,review,tools}-{320,390,768,1440}.png`에 저장했다. 큰 화면에서는 폭 480px의 여행 패널로 표시한다.
- Codex in-app browser에서도 완료 버튼을 눌러 다음 장소가 바뀌는지 확인하고 점검표, 조정 확인창, 도구 화면을 직접 열었다. 앱 콘솔 오류는 0건이었다.

## 비교 중 발견하여 수정한 항목

1. [P1, 해결] 전역 글자 스타일이 장소명의 큰 타이포그래피를 덮고, 이전 데스크톱 그리드 규칙이 섹션 간격을 없앴다. passport 범위의 선택자와 이전 레이아웃의 적용 조건을 분리했다. 최종 티켓은 짧은 장소명 44px, 긴 이름은 32/25px로 단계적으로 조정된다.
2. [P2, 해결] 점검표의 현재/조정 시간 열이 지나치게 좁았다. 390px에서 60/62px의 숫자 열과 13px 시각 글자로 변경하고, 이미 완료한 일정의 불필요한 이동 행을 줄였다. 마지막 잠금 일정과 변경량을 함께 확인할 수 있다.
3. [P2, 해결] 기존 펼침 메뉴의 노란색 배경이 완료/준비물 제목에 남았다. 투명한 종이 배경과 얇은 선으로 통일했다.
4. [P2, 해결] 도구 화면에 추가한 큰 노란 저장 버튼이 시안의 정보 위계를 바꿨다. 포켓노트 오른쪽의 작은 다운로드 버튼으로 옮기고 접근성 이름과 저장 표시를 남겼다.
5. [P2, 해결] 외부에서 도구 탭을 열 때 이전 패널의 스크롤 위치 때문에 제목이 가려질 수 있었다. 명시적으로 화면을 여는 동작에서 스크롤을 초기화하고, 기록 변경 때는 현재 스크롤을 보존한다.
6. [P2, 해결] 시간대 선택기의 공통 테두리가 중첩되고 보조기술 이름이 '선택'이었다. 얇은 한 줄 선택기로 정리하고 이름을 '일정 시간대'로 연결했다.
7. [P2, 해결] 새 CSS도 기존 자동 업데이트와 같은 내용 해시를 사용하도록 빌드 치환 대상에 포함했다. 수동 버전 번호 없이 전체 캐시가 함께 갱신된다.

## 필수 시각 검토

- 글꼴: 기존 Pretendard를 재사용했다. 큰 장소명, 24px 화면 제목, 13px 시간 비교, 10–12px 보조 정보의 위계를 확인했다. 긴 장소명은 줄바꿈되며 320px에서 고정된 숫자 열을 침범하지 않는다.
- 간격/구조: 다음 장소를 중심으로 날짜 선택, 완료/남은 일정, 예산 띠를 배치했다. 점검은 현재와 조정안의 열 비교, 도구는 표지/다운로드/체크리스트 순서다. 짧은 높이에서는 본문이 스크롤되고 하단 메뉴는 유지된다.
- 색상: 따뜻한 종이색 `#fffdf7`, 잉크 `#202730`, 노란 행동/선택 `#ffeb50`, 분홍 변경 강조 `#ffe6ed`, 경고색의 용도를 구분했다. 포커스는 2px의 진한 테두리로 보인다.
- 이미지: 제공된 TripLOG 워드마크와 서울 탑 이미지, Image Gen으로 개별 제작한 리넨 포켓노트 표지와 펜 스케치를 사용했다. 표지는 1717×916, 스케치는 1390×1132 원본으로 표시 영역 대비 충분하다. CSS/인라인 SVG로 삽화를 대체하지 않았다.
- 문구/데이터: 목업의 모순된 '+5분'과 '조정되었습니다'를 복사하지 않고 실제 모델의 변경량과 '확인 후 적용'을 표시한다. 완료·잠금 시간은 보존된다. 여행명, 일수, 인원, 예산, 준비물은 모두 현재 여행 상태를 따른다.
- 아이콘/접근성: 기존 Phosphor 사용, 의미 있는 버튼 이름, 네이티브 체크박스와 details, 선택 상태, 고정된 하단 메뉴, reduced-motion 대응을 확인했다. 여러 이동 수단은 일반 경로 아이콘, 단일 이동은 실제 수단 아이콘이다.

## 의도한 실제 서비스 적용 차이

- 서울에 고정된 표지 글귀 대신 어느 여행에도 쓸 수 있는 노트 표지와 여행 스케치를 제작했다. 현재 여행지가 서울일 때의 기존 서울 탑 표시는 유지한다.
- 방문 완료/취소와 준비물 편집 같은 실제 조작을 추가했다. 준비물은 기존 모바일 공간 요구를 반영한 두 열 목록이며, 각 항목은 기존 저장 경로로 즉시 저장한다.
- 원본의 시간 예시는 완료된 일정까지 바꾸지만 구현은 기존 검증된 모델을 따른다. 적용 전에 비교하며 잠금/완료 상태와 되돌리기를 보존한다.
- 844px 이하 높이에서 모든 항목을 강제로 축소하지 않고 본문 스크롤을 제공한다. 메뉴·조정 확인 버튼은 화면 안에 남는다.

## 기능 검증 및 완료 체크

- `npm test`: 전체 데이터/동기화/계산/기존 기능 단위 회귀 통과.
- `npm run test:browser`: 전체 브라우저 회귀 통과. 동기화, 오프라인 시작, 자동 업데이트, 드래그, 폼/시간 컨트롤, 이동 정보, 국내/해외 지도, 지출과 신규 passport 검사 포함.
- 신규 `scripts/companion-passport-browser-regression.js`: 완료/취소, 접기 상태, 날짜 전환, 조정안 읽기 무변경, 잠금, 적용/되돌리기, 이동 정보 연결, 준비물 재접속 유지, 저장 실패 복원, 포켓노트 선택 정보 제외, ICS 시간대, 예약 탭, 긴 이름/빈 일정/미정 시간/초과 예산/빈 준비물, 4개 폭과 자산 로딩 통과.
- 마지막 CSS 해시 연결 후 자동 업데이트 및 오프라인 시작 검사를 재실행하여 통과했다. 독립 오프라인 검사의 첫 시도는 테스트 서버 미기동으로 연결하지 못했으며, 전용 임시 서버를 사용한 재실행에서 통과했다.
- `npm run build`: 배포용 dist 생성 통과. 새 CSS와 두 이미지가 빌드에 포함되는 것을 확인했다. 이 작업에서는 로컬 구현 및 미리보기까지 완료했다.
- 시안 비교, 좁은 화면, 주요 상호작용, 오류/빈 상태, 기존 기능 회귀, 빌드 및 사용 가능한 미리보기 확인 완료.

---

# 이동 정보 — 2번 시안 및 모바일 압축·요약 재설계 (2026-09-22)

final result: passed

## 최종 요구사항과 시각 기준

- 전체 구조: `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/triplog-transit-journey-20260922.png` (선택한 2번).
- 모바일 밀도·구간 색상: `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/triplog-transit-mobile-compact-20260922.png`.
- 출발/도착 요약: `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/triplog-transit-summary-refined-20260922.png`의 상단 영역. 이 이미지의 하단 두 칸 요약은 최종 디자인이 아니다.
- 최종 시간 요약: `C:/Users/tbdk5/Desktop/MAIN/0_Working/TripLOG/triplog-transit-ticket-summary-20260922.png`. 사용자의 추가 요청에 따라 기존 두 칸 박스를 출발–총 이동 시간–도착 예상 가로 타임라인으로 교체했다.
- 생성 이미지보다 최신 사용자 지시를 우선: 지도는 전체 가로폭, 높이 192px(데스크톱)/160px(모바일), 작은 지도 버튼은 지도 내부. Google 출발지→도착지 경로와 대중교통/도보 전환 및 ‘옵션 더보기’를 유지한다. 출발지/도착지를 따로 고르는 지도 UI는 없다.
- 미리보기: http://127.0.0.1:18082/Travel?page=itinerary&view=manual . 별도 가상 계정/일정 fixture이며 실제 사용자 계정과 Supabase 쓰기는 차단했다. 운영 배포는 이 작업에 포함하지 않았다.

## 구현 캡처 및 비교

검증 출력 폴더: `C:/Users/tbdk5/AppData/Local/Temp/TripLOG-Journey-20260922/`.

- 전체 비교: `compact-comparison.png`에 모바일 참조와 실제 구현을 한 이미지로 나란히 배치해 확인했다.
- 하단 집중 비교: `summary-comparison.png`에 최종 티켓형 요약 참조와 `estimate-390.png`를 같은 너비로 맞춰 비교했다.
- 상단 집중 비교: `route-summary-comparison.png`에 출발/도착 요약 참조와 `route-summary-390.png`를 비교했다.
- 실제 화면: `manual-1536.png`, `manual-768.png`, `manual-390.png`, `manual-320.png`, `route-1536.png`, `route-390.png`, `route-320.png`.
- 실제 외부 지도: Codex in-app browser에서 Google 출발/도착 정보, 경로선, ‘옵션 더보기’, 로고/약관/지도 데이터 표시를 확인했다. 실제 Google 지도 전체 화면은 `route-mobile-context.png`. 자동화 캡처의 지도는 외부 서비스 요청을 막은 fixture이므로 지도 영상의 진위를 판단하는 근거로 쓰지 않는다.
- Live manual capture: `manual-mobile-context.png`.
- Playwright viewport: 1536×1050, 768×1050, 390×844, 320×844; deviceScaleFactor 1. 수동 캡처용 in-app browser는 393×852, 관찰한 devicePixelRatio 약 1.
- 전체 모바일 참조는 기기 베젤/상태바를 제외한 `(681,84)-(1247,1150)` 영역을 390 CSS px 너비로 비율 유지 축소했다. 390px 구현은 390×724, 320px 구현은 320×824. 상단 요약은 368×44, 하단은 368×54.
- 최종 하단 참조는 2170×725 원본에서 `(96,246)-(2075,438)`를 368px 너비로 정규화했다. 기기 프레임과 캔버스 여백은 앱의 구현 요소로 취급하지 않는다.

## 비교 이력과 해결한 문제

1. [P2, 해결] 최초 데스크톱 시안 구현에서 전역 label/span 스타일이 중첩되어 메모의 ‘선택’ 문구가 두 줄로 갈라지고 숫자 요약이 스크롤 아래로 밀렸다. 메모를 한 줄 필드로 정리하고 글꼴/여백을 모달 내부에 한정했다.
2. [P2, 해결] 최초 모바일 구현에서 수단/시간을 세로로 쌓아 네 구간을 볼 수 없었다. 모바일 재생성 시안을 적용해 수단·시간·색상을 한 줄에 놓고, 320px에서만 색상 팔레트를 다음 줄로 배치했다. 최종 캡처에서 수평 넘침 없이 저장 버튼이 유지된다.
3. [P2, 해결] 동일 환승지의 연속 구간에서 옵션 메뉴와 마지막 색상 버튼이 겹쳤다. 모바일의 해당 구간에 일반 교통수단 이름 행을 두어 분리했다. 모든 색상 버튼을 실제 클릭하는 검사 통과.
4. [사용자 수정, 반영] 축소 지도 옆의 버튼 열을 제거하고 지도를 다시 전체 너비로 확장했다. 지도 버튼 네 종류의 경계가 지도 내부에 들어오는지 자동 검증했다.
5. [P2, 해결] 첫 시간 요약 개선은 기존 두 칸 구성과 유사했다. 새 Image Gen 참조에 따라 박스/큰 원형 아이콘을 없애고 3단 가로 타임라인으로 다시 구현했다. 최신 `summary-comparison.png`로 재검증했다.

## 필수 시각 표면

- 글꼴: 기존 로컬 Pretendard 사용. 모바일 제목 20px, 주요 장소/편집 11–12px, 보조 정보 9–10px, 하단 수치 17px. 숫자는 tabular-nums, 읽기 순서는 출발→이동 시간→도착. 사용자가 요구한 압축 밀도를 적용했고 버튼·입력의 접근 가능한 이름은 유지한다.
- 간격: 단일 타임라인 프레임, 5px 필드 간격, 26–28px 편집 필드, 32px 저장 버튼. 네 구간과 하단 요약이 390px 화면에서 함께 보인다. 데스크톱은 684px 모달을 유지한다.
- 색상: 흰색/짙은 남색/노란 선택선의 기존 톤. 교통수단 구간마다 파랑·빨강·초록·주황·회색 선택, 아이콘·축·배지에 반영. 하단은 흰색 바탕과 얇은 회색 연결선, 작은 노란 노드로 구성한다.
- 이미지/아이콘: 실제 Google iframe과 기존 Leaflet/OSM을 사용한다. 지도를 생성 이미지로 대체하지 않았다. 아이콘은 기존 로컬 Phosphor이며 새 외부 CDN이나 임의 SVG 그림은 없다. Google viewport 전체를 0.8 배율로 맞춰 provider UI/출처 표기를 잘라내지 않는다.
- 문구: 표시 교통수단은 ‘버스’, ‘기차’, ‘도보’ 등 일반 이름. 특정 철도 이름을 기본 표시로 강제하지 않는다. 사용자가 적은 선택 노선명·메모·환승지는 보존한다. 아래 타임라인은 직접 기록한 내용임을 표시하며 API가 자동 제공한 교통 정보처럼 표현하지 않는다.

## 동작 검증

- `npm test` 통과: 기존 동기화, 복구/백업, 데이터 보존, 좌표/정렬 및 관련 모델 회귀 검사.
- `transit-journey-browser-regression.js` 통과: 누적 출발/도착, 시간 미정, 자정 넘김, 지각 안내, 잘못된 입력, 구간 추가/삭제, 메모/환승지/노선명, 색상 선택·저장·새로고침·취소, 알 수 없는 기존 필드 유지, 탭 전환, 타임라인에서 해당 편집 구간 열기, 4개 화면 너비.
- 모바일 외부 지도 아이콘으로 나갔다가 돌아와도 미저장 시간/색상이 복원됨을 검증했다. 취소 시 원래 저장 자료는 그대로다.
- Google iframe의 saddr/daddr 및 transit/walking dirflg, 활성 탭, 전체 너비, 지도 내부 버튼 위치, 192/160px 높이 확인.
- `map-provider-browser-regression.js`, `domestic-route-browser-regression.js`, `itinerary-controls-browser-regression.js` 통과. 국내 OSM 표시/Naver 길찾기 및 해외 Google 분기, 장소 자동 찾기/오류/캐시/닫힌 모달 처리와 원본 일정 보존을 유지한다.
- 기존 브라우저 회귀 실행기에 새 journey 검사를 등록했다. 테스트 브라우저는 격리된 Playwright/Edge, 시각 검증과 실제 Google 지도 확인은 in-app browser. 별도 Browser plugin은 설치되어 있지 않아 저장소의 기존 회귀 도구를 사용했다.
- 자동 브라우저 검사에서 pageerror 없음. 외부 네트워크 차단 fixture의 동기화 ‘연결 재시도 중’ 상태는 의도된 격리 조건이다.
- `npm run build` 및 `git diff --check` 완료. 자산 갱신 표시는 기존 콘텐츠 해시 기반 스크립트가 자동 생성한다.

## 남은 범위

- 실제 iPhone Safari 기기/키보드 조합은 미검증. 320/390px Chromium 및 visualViewport 기반 기존 시트 제한은 검증했다.
- Google의 지도 색상, 노선 결과, 내부 안내 디자인은 provider 소유이며 시안의 가상 지도와 픽셀 단위로 일치시키지 않는다. 구간 색상은 TripLOG 타임라인의 색상이다.
- [P3] 하단 노드는 시안의 채운 원 대신 기존 아이콘 라이브러리의 작은 원을 사용한다. 앱의 대비와 연결선 역할은 동일하다.

---
# 지출 목록·입력·숙박비 가독성 — 2026-09-21

final result: passed (아래 검증 범위). 버전 `expense-polish-20260921-1`.

운영 배포: https://b63f47fc.triplog-5qs.pages.dev. 기본 주소 https://triplog-5qs.pages.dev 에서 지출 UI 회귀 검사 통과. 배포 HTML/JS/CSS/서비스워커 6개 파일의 SHA-256이 로컬 빌드와 일치한다. Edge 전체 회귀 및 Chrome 지출 검사 통과.

- [조사/목업/구현 비교](docs/expense-polish-20260921/README.md). 목록, 외화 입력, 숙박비 입력을 실제 화면으로 조사하고 각 목업을 Image Gen으로 먼저 생성한 후 구현했다.
- 총 지출 20px / 남은 예산 16px / 보조 예산 12px / 항목명·금액 14px. 일반 입력 16px와 주요 44px 터치 영역을 유지한다.
- 카테고리 아이콘, 날짜·Day·결제수단 배지, 탭 개수 배지, 한 줄 메모. 원본 메모/결제일/여행 일정은 편집창에서 보존한다.
- 외화 환산은 `≈ 원화 금액`과 환율 편집 동작, 숙박비는 박 수·1박 금액·적용 날짜로 표시한다. 원화에 반복 환산 문장은 숨기고 오류 메시지는 명확히 유지한다.
- 공통 hover와 선택 상태의 충돌, 기존 typography 선택자 우선순위로 글자가 다시 커지는 부분을 조정했다. 다른 기능의 공통 글자 크기는 바꾸지 않는다.
- `npm test`, `npm run test:browser` 전체 통과. 새 지출 UI 회귀 검사에 환산/실제 저장/키보드 편집/새로고침/불균등 숙박비 배분/저장 후 계속/검색·필터·정렬/예산 경계/320px 화면을 포함했다.
- 1440px 데스크톱 및 390px/320px 모바일 캡처를 확인했다. 외부 API를 차단한 격리 fixture 사용. 실제 사용자 여행은 수정하지 않았다. 실제 iPhone Safari 기기 검증은 미수행.
- Browser plugin unavailable: 기존 Playwright Edge/Chrome 경로를 사용했다.

---

# 모바일 일정 즉시 집기·드래그 모션 — 2026-09-20

final result: passed (아래 검증 범위)

운영 배포: https://abb01c4e.triplog-5qs.pages.dev · 버전 `mobile-drag-20260920-1`. 기본 운영 주소의 최종 터치 회귀 검사 통과(집기 이벤트 처리 4.1ms, 해당 검증 실행 기준). HTML/JS/CSS/서비스워커 7개 파일 SHA-256 일치 확인.

- 시안: `triplog-mobile-drag-mockup-20260920.png`. built-in Image Gen으로 1회 생성하고 프로젝트 루트에 저장. 원래 모바일 일정 캡처를 디자인 기준으로 사용. 프롬프트/입력 경로/덮어쓰기 여부는 `.prompt.json`에 기록.
- 실제 구현: [모바일 드래그 캡처](docs/mobile-drag-preview-20260920.png), [터치 동작 영상](docs/mobile-drag-demo-20260920.mp4).
- 원인: 기존 모바일 정렬은 HTML draggable과 브라우저의 기본 길게 누르기에 의존. 앱 자체의 즉시 터치 시작 경로가 없었음.
- 수정: 오른쪽 44×44px 손잡이에만 touch-action:none 적용. pointerdown 이벤트 안에서 즉시 집기/미리보기 시작하며 추가 대기 타이머 없음. 카드 본문은 원래 터치 스크롤을 유지. 터치 환경의 native draggable은 비활성화하고 PC 본문 드래그는 유지.
- 모션: 손가락 위치를 다음 프레임에 그대로 추적, 약한 들어올림(120ms), 이웃 카드 이동(170ms), 놓기 정렬(190ms), 노란 손잡이와 하늘색 삽입 공간. 여섯 점은 기존 Phosphor 아이콘 사용. 과한 회전/바운스와 큰 글자는 사용하지 않음.
- 드롭: 기존 필드 단위 일정 순서 API를 사용하고 시간/메모/이동정보는 그대로 보존. 드래그 중에는 localRevision/저장 데이터가 바뀌지 않음. 낙하 애니메이션은 동기 렌더 직후 실행해 디스크 저장 지연 뒤에 뒤늦게 재생되지 않도록 함.
- 경계: 안정된 기준 좌표와 7px 경계 여유로 슬롯 진동 방지. 화면 가장자리 자동 스크롤. 터치 취소/Escape/외부 렌더/화면 전환 시 정리. 모바일 주소창의 높이 변화는 유지하고 너비·방향 변화는 취소.
- 접근성: 키보드 Alt+위아래 이동, 손잡이 설명, 위치 안내 live region, reduced-motion 즉시 배치. 원래 장소·시간 편집 버튼을 유지.
- 검증: `npm test`, `npm run test:browser` 전체 통과. Chrome에서 별도 터치 검사 통과. native PC 드래그와 마우스 손잡이 드래그도 통과.
- 측정: 격리 Edge/Chrome 실행에서 pointerdown 내부 집기 처리 약 3.3~4.0ms. 추가 대기 타이머 제거 검증이며 실제 기기별 입력/화면 지연을 보장하는 수치가 아님.
- 실제 CDP 터치: 본문 스크롤, 즉시 집기, 손가락 추적, 끼워 넣기, 정지 포인터 안정성, 놓기/새로고침, 무변경 취소, viewport 높이/너비 변경, 자동 스크롤, 줄인 모션, 320px 넘침 없음 확인. 실제 iPhone Safari 기기 테스트는 수행하지 않음.
- 초기 전체 검사에서 시작 직후 분리된 DOM 참조로 스타일 검사가 빈 값이 되는 테스트 경합을 확인. triplogInitialized/auth/appReady 및 현재 손잡이 스타일 준비를 모두 기다리도록 수정 후 전체 검사 통과.
- Browser plugin not available: 기존 Playwright/Edge·Chrome 격리 컨텍스트 사용. 외부 API 차단, 실제 사용자의 여행/서버 자료는 편집하지 않음.

---

# 테마 필드·드롭다운 가로 폭 일치 — 2026-09-20

final result: passed. 운영 배포 `e330f470` / 버전 `compact-controls-20260920-2`. 기본 운영 주소에서 최종 브라우저 회귀 검사를 다시 실행해 통과함. 1440/390/320px 및 열린 상태의 768px 리사이즈에서 필드·메뉴 너비와 좌측 경계 일치 확인. 기존 시간 토글과 이동정보 스크롤/정렬 검사도 통과.

- 드롭다운의 304px 최대 폭 제한을 제거하고 필드의 실제 너비를 사용. 열린 상태에서 화면 크기가 바뀌어도 필드 너비와 좌측 경계를 다시 계산함.
- 앞서 축소한 항목 높이 44px, 글자 14px, 이모지 18px, 패딩/간격은 유지.
- `itinerary-controls-browser-regression.js`에서 1440/390/320px의 필드·메뉴 너비/좌측 경계 일치 및 열린 상태의 768px 리사이즈를 검증.
- 아래 304px 제한 설명은 이전 릴리스 기록임.

---

# 테마 크기·시간 토글·이동 팝업 정리 — 2026-09-20

final result: passed (아래 검증 범위)

운영 배포: https://e4a6dd9f.triplog-5qs.pages.dev · 버전 `compact-controls-20260920-1`. 기본 도메인에서 최종 컨트롤 회귀 검사 통과, HTML/JS/CSS/SW 6개 SHA-256 일치 및 diff 공백 검사 통과.

- 사용자 요청: 주변 필드와 맞는 작은 테마 메뉴, 시간 화살표 재클릭 시 닫힘 유지, 이동 팝업 스크롤바 숨김, 이동수단 글자 가운데 정렬.
- 테마: 최대 너비 360→304px이면서 현재 트리거 폭을 넘지 않음. 항목 68→44px, 글자 18→14px, 이모지 25→18px. 패딩 14→8px/간격 10→6px. 2열 3행과 선택 체크를 유지. 실제 메뉴 높이 약 164px.
- 시간: 화살표를 type=button 제어로 분리. pointerdown에서 포커스 이탈을 막고 click의 label 기본 동작을 차단. aria-expanded/열기·닫기 이름 동기화. 휠 내부 입력에 포커스가 있을 때도 눌렀다 놓는 동작이 정확히 한 번 토글됨.
- 이동: `.transit-editor-scroll`의 overflow-y:auto 유지, scrollbar-width:none 및 WebKit scrollbar 숨김. 이동수단 메뉴와 선택값을 가운데 정렬하고 화살표 양쪽 공간을 맞춤. 메뉴 스크롤도 유지.
- 검증: `itinerary-controls-browser-regression.js`에서 1440/390/320px 크기, 반복 클릭, 길게 누르기, Enter/Space, CDP 터치 탭, 내용이 실제로 넘치는 4개 환승 구간의 휠 스크롤과 하단 포커스 이동, 이동수단 선택을 검증. Edge·Chrome 통과. 터치 검증은 에뮬레이션이며 실제 iPhone Safari 기기 검증은 별도.
- 기존 `controls-browser-regression.js`와 `time-wheel-browser-regression.js`도 통과: 시간 애니메이션·직접 입력·확정/취소·저장/새로고침 유지.
- 증거: [테마](docs/compact-theme-20260920.png), [스크롤바 없는 이동 팝업](docs/transit-popup-scroll-20260920.png), [가운데 정렬된 이동수단](docs/transit-mode-centered-20260920.png).
- Browser plugin not available: 저장소의 Playwright 격리 브라우저 경로 사용. 실제 사용자 데이터/서버 여행 정보는 수정하지 않음.

---

# 시간 선택기 글자 크기·연속 모션 개선 — 2026-09-20

final result: passed (아래 검증 범위)

최종 배포: https://644573fb.triplog-5qs.pages.dev · 운영 https://triplog-5qs.pages.dev · 버전 `time-motion-20260920-2`. 최종 운영 모션 테스트 통과(중간 위치 18개), 배포 HTML/JS/CSS/SW 7개 SHA-256 일치 확인.

- 시안: `triplog-time-motion-mockup-20260920.png`. built-in Image Gen으로 한 번 생성, 기존 시간/테마 캡처를 참조. 프롬프트와 입력 경로는 같은 이름의 `.prompt.json`에 기록. 기존 목업을 덮어쓰지 않음.
- 결과: [실제 캡처](docs/time-picker-compact-20260920.png), [실제 작동 영상](docs/time-picker-motion-20260920.mp4).
- 글자: 시·분 19→13px, 주변 숫자 24→16px(18px 글리프를 8/9로 표시), 중앙 숫자 26→18px, 버튼 15→14px. 304px 패널, 데스크톱 행 36px / 터치 행 44px.
- 원인: 이전 140ms 유휴 타이머 이후에만 값을 갱신하고, 중앙의 고정 입력칸이 스크롤하는 숫자를 가렸으며, 선택 후 scrollTop을 즉시 재배치했음.
- 수정: 움직이는 숫자 행 위에 고정 선택 배경을 배치. 스크롤 중 현재 숫자를 즉시 반영하고, 클릭·방향키에는 중단 가능한 requestAnimationFrame 전환. 거리에 따른 숫자 크기/농도 변화와 마지막 행 정렬. 가운데 숫자 탭은 직접 입력, 가운데에서 드래그하면 휠 스크롤.
- 연속 조작: 드래그 뒤 새 탭을 350ms 동안 막던 입력 억제를 새 포인터 제스처에서 해제하고 즉시 탭 회귀 검사를 추가. 최신 목표값으로 재지정, 마우스 드래그는 제한된 관성, 터치는 브라우저의 기본 관성을 사용. 23/00·59/00은 인접한 반복 행으로 전환하고 정렬 후 같은 모습의 중간 위치로 이동.
- 통합 UI: 이전 일정 편집기의 시계/화살표 재삽입을 제거해 트리거의 중복 아이콘과 잘못 회전하던 화살표를 정리.
- 안전: 확정 중 모션은 목표값을 즉시 마무리, Escape는 시작값 복원, clear·닫기·비활성·분리 시 타이머/프레임 정리. change는 확정 시 한 번만 발생. prefers-reduced-motion에서는 이동을 즉시 적용.
- 검증: `npm test`, `npm run test:browser`, Chrome의 추가 `time-wheel-browser-regression.js` 통과. 클릭 애니메이션에서 18~19개 중간 위치를 관측. 빠른 방향키, 직접 입력, 범위 보정, 취소·확정 중단, 자정 경계, 마우스 휠/드래그, CDP 터치 스크롤/중앙 탭, 저장 후 새로고침을 검증.
- 디자인 비교: 생성 시안과 실제 캡처의 구조/색상/정렬/크기 계층을 대조. 중앙 노란 띠를 유지하면서 실제 글자 크기를 요청대로 축소. 터치 화면에서는 작은 글자를 유지하고 클릭 영역만 확대.
- Browser plugin not available: 저장소의 격리 Playwright/Edge·Chrome 경로 사용. 실제 여행과 서버 자료는 편집하지 않음. iPhone Safari 실기기 테스트는 수행하지 않았으며 CDP 터치 검증과 구분함.
- 운영 검증 중 CDP의 데스크톱→터치 전환 직후 첫 제스처가 한 번 미반영됨. 이후 운영 주소 4회 검사 통과. 에뮬레이션 전환 이후 렌더 좌표가 3프레임 안정된 다음 터치하도록 테스트를 보완했으며, 실제 Safari 결과로 해석하지 않음.
- 기존 자동 동기화/오프라인/서비스워커 복구/드래그 회귀 검사 통과. 아래는 이전 릴리스 기록.

---

# TripLOG 선택 컨트롤 · 목업 구현 QA — 2026-09-20

final result: passed (검증 범위: 아래 명시)

운영 배포: https://c3ebcde3.triplog-5qs.pages.dev · 기본 도메인 https://triplog-5qs.pages.dev · 파일 버전 `controls-20260920-1`. 최종 배포 HTML/JS/CSS/SW 8개 SHA-256 일치 확인.

## 기준과 결과물

- 승인 기준: 프로젝트 루트의 `triplog-controls-01`부터 `06`까지 20260920 목업 PNG 6개. 새 디자인을 생성하지 않고 이 이미지를 구현 기준으로 사용함.
- 실제 화면: [6개 구현 화면](docs/controls-ui-implemented.png), [목업/구현 비교 뷰어](docs/controls-ui-review.html).
- 원본과 렌더 캡처를 같은 비교 입력에서 확인함. 시간·테마·통화, 카테고리·여행 일정·달력의 두 묶음으로 검토하고 수정 후 다시 캡처함.
- Browser plugin/skill이 제공되지 않아 기존 프로젝트의 Playwright/Edge 격리 브라우저 테스트를 사용함. Chrome에서도 동일한 기능 검사를 수행함.

## 구현 충실도

| 항목 | 반영 및 확인 |
| --- | --- |
| 시간 | 5줄 연속 휠, 시·분 가운데 정렬, 옅어지는 주변 숫자, 노란 중앙 선택, 세로 구분선, 시간 없음/확인. 중앙 필드 직접 입력과 스크롤 모두 작동. |
| 테마 | 2열×3행, 📍 명소 / 🏨 숙소 / 🍽️ 맛집 / 🛍️ 쇼핑 / 🚆 이동 / ✨ 기타, 선택 타일과 체크. 트리거에도 동일한 이모지. |
| 카테고리 | 전체 포함 7개 행, 하늘색 아이콘 배지, 구분선, 선택 체크와 비선택 원형 표시. |
| 통화 | 버튼보다 넓은 메뉴, 검색창, 민트색 기호 배지, 이름/ISO 코드/체크 정렬. 9개 통화, 한국어·코드 검색, 빈 결과 표시. |
| 여행 일정 | 사전구매 선택행, 여행 중 지출 구분, 실제 여행 기간에 따른 Day 배지와 날짜·요일. |
| 결제일 | 이전/다음 달, 주말 색상, 노란 선택 날짜, 오늘 점, 옅은 바깥달, 오늘/닫기 하단. |
| 공통 | Pretendard 기반 서체, 짙은 외곽선, 둥근 모서리, 짧은 그림자, 노란 강조색. 작은 화면에서 메뉴 위치/너비/높이 제한. |

## 발견 후 수정한 항목

- P1 동작: Escape 이후 blur/change가 취소한 시간 초안을 다시 적용함 → 닫힌 패널의 change를 무시하고 원래 시간을 복원.
- P2 글꼴: 기존 폼 label/span 스타일이 메뉴 글자를 작게 만듦 → 컨트롤 범위에서 글자 크기·굵기 상속을 명시.
- P2 배치: 통화의 좁은 메뉴/이름 줄바꿈 → 독립 메뉴 폭과 고정 기호/코드 열, 검색 입력 추가.
- P2 상태: 오늘 날짜의 불필요한 검정 테두리, 검색창의 중복 포커스 테두리 → 오늘 점과 검색창 전체 포커스 표시로 통일.
- P2 접근성: 작은 달력·통화 보조 텍스트 대비 → 배색 계열을 유지하면서 더 진한 색으로 조정. 활성 날짜/코드의 대비를 4.5:1 이상으로 확보.
- P2 키보드: 테마 2열 이동, Home/End, 검색 Enter, 달력 방향키/PageUp/PageDown, Esc/Tab 닫기 및 포커스 복귀 적용.

## 기능 검증

- `npm test` 통과: 동기화 DB/client/service/presentation, 백업, 일정 순서·지도 위치, 여행 도우미, 지출 모델 등.
- `npm run test:browser` 통과: 실제 두 브라우저 동기화, 오프라인 저장/복원, ERR_FAILED 서비스워커 복구, 일정 드래그 애니메이션 및 새 컨트롤 회귀 검사.
- `scripts/controls-browser-regression.js`를 Edge/Chrome과 운영 주소의 격리 컨텍스트에서 실행. 실제 계정/여행 서버 데이터는 변경하지 않음.
- 1440/768/390/320px 및 높이 420px에서 패널 경계·가로 넘침 확인. 통화 긴 목록은 검색창을 유지하며 내부 스크롤.
- 실제 마우스 휠, 직접 입력, 59→00 경계, Esc 취소, 시간 없음, 테마별 종료 시각 숨김/복귀, 통화 검색/빈 결과/선택, 여행 일차 및 결제일 저장 검증.
- 일정(숙소 09:00, 종료 시각 없음)과 지출(KRW 12,000, 여행일 9/26, 결제일 9/27)을 실제 폼으로 저장하고 새로고침 후 보존 확인.
- `npm run build`와 `git diff --check` 통과. 운영 HTML/JS/CSS/서비스워커 8개 파일의 SHA-256을 배포 산출물과 대조.

## 범위 및 차이

- 생성 목업의 큰 캔버스는 실제 서비스 크기로 축소하되 클릭 영역을 유지함. 기기별 이모지 그림과 글자 안티앨리어싱은 운영체제에 따라 다름.
- 달력의 비선택 날짜는 읽기 대비를 위해 목업보다 조금 진하게 조정함. 날짜·선택값은 예시를 고정하지 않고 실제 여행/입력 상태에서 생성함.
- 실제 iPhone Safari 기기에서의 터치 스크롤·가상 키보드는 이번 자동 검증 범위 밖임. 모바일 화면 폭은 Edge/Chrome으로 검증함.
- 남은 P0/P1/P2 항목 없음(위 검증 경로 기준). 아래는 이전 작업의 QA 기록이며 당시의 배포 여부 설명은 이번 릴리스 상태와 별개임.

---

# TripLOG 일정 편집 / 요약 전환 QA

검증일: 2026-09-15. 버전: `itinerary-summary-20260915-1`.

final result: passed

## 비교 기준과 환경

- Source visual truth: `triplog-itinerary-summary-inline-20260915.png` (1194 × 1317px). 사용자가 선택한 같은 화면 내 편집/요약 전환 목업입니다.
- 구현 화면: `C:/Users/tbdk5/.codex/visualizations/2026/09/15/triplog-itinerary-summary-qa/summary-390.png`, `edit-390.png`.
- 전체 비교: 같은 폴더의 `summary-comparison.png`, `edit-comparison.png`. 세부 비교: `summary-details-comparison.png`.
- 원본의 각 휴대전화에서 앱 영역을 CSS로 약 540 × 1168px 영역에 맞춰 표시하고 390 × 844 CSS px로 정규화했습니다. 원본 파일은 변경하지 않았습니다. 기기 프레임·상태 표시줄·홈 표시줄은 앱 구현에 추가하지 않았습니다.
- 실제 구현 캡처는 390 × 844px, DPR 1입니다. 유한 전환 효과가 끝난 상태를 캡처했고 추가로 320 × 740, 768 × 1024, 1280 × 900에서 편집/요약 화면을 검증했습니다.
- Browser plugin 미제공 환경에서 기존의 격리된 Chrome/Playwright 검증 흐름을 사용했습니다. 로그인 표시는 응답 메모리의 UI 테스트 대체값이며 실제 계정 로그인이나 원격 여행 데이터 쓰기는 수행하지 않았습니다.

## 확인한 디자인과 상호작용

| 항목 | 결과 |
| --- | --- |
| 글꼴·위계 | 기존 Pretendard와 토큰 유지. 제목 22px, 보기 버튼 14px, 일차 제목 15px, 장소 14px, 보조 정보 12px 확인. 긴 이름 줄바꿈 확인. |
| 배치·간격 | 여행 정보 아래 편집/요약 선택, 본문 교체, 인라인 날짜 요약과 하단 탭 유지. 모드 전환 전후 헤더와 선택 버튼 위치가 동일함. |
| 색상·선 | 기존 노란 선택 상태, 옅은 노란 펼침 헤더, 회색 접힘 카드와 얇은 경계 유지. 기록된 테마에 따라 기존 색상 사용. |
| 이미지·아이콘 | 기존 TripLOG 워드마크와 Phosphor 아이콘 사용. 목업 이미지나 기기 외형을 제품 UI로 삽입하지 않음. |
| 내용·계산 | 실제 여행 데이터로 날짜/요일/시간 범위/장소 수/기록된 이동 시간 계산. 날짜를 넘어간 종료 시각과 미입력 값 표시. |
| 동작 | 같은 화면 전환, 키보드 전환, 날짜별 접기/펼치기, 날짜 편집 이동, 요약 복사와 권한 거부 시 수동 복사 UI 확인. |
| 기존 기능 | 전체 일정 보기, 장소 수정 및 요약 반영, Google 경로 창, 새 일정 입력 연결 확인. |
| 상태 보존 | 보기 전환은 일정 기록을 변경하지 않음. 펼친 날짜와 현재 여행 보기 상태 복원, 다른 여행의 요약 분리 확인. |
| 반응형 | 네 가지 폭에서 가로 넘침 없음. 실제 표시되는 `nav.rd-nav`의 하단 고정과 편집 추가 버튼 위치 확인. |
| 콘솔 | 관련 런타임 오류 없음. |

## 비교 이력과 의도한 차이

- [수정 완료] 빠르게 보기를 바꾸면 이전 페이드가 남을 수 있어 전환 전에 기존 애니메이션을 취소했습니다. 동작 줄이기 설정에서 새 애니메이션이 생기지 않는 것을 재검증했습니다.
- [수정 완료] 복사 성공 직후 다음 복사가 거부될 때 오류 안내가 숨겨질 수 있어 이전 피드백 상태를 초기화했습니다. 실패 메시지와 선택 가능한 텍스트를 확인했습니다.
- [수정 완료] 긴 동선은 접힘 상태에서 두 줄로 제한하고 펼치면 모든 장소를 표시합니다.
- 정적인 목업의 날짜/요일/박수/테마 예시는 실제 저장값에서 계산한 내용으로 대체합니다. 날짜별 도시는 별도 데이터가 없어 추측하지 않고 실제 날짜와 요일을 표시합니다.
- 편집 화면은 기존 Google 경로 연결과 장소/메모 표현을 유지합니다. 기존 전체 일정 보기도 날짜 선택 줄의 `전체 / 일차별` 버튼으로 유지합니다.
- 실제 기기 UI와 기존 타이포그래피 토큰을 우선해 원본의 기기 장식, 과장된 그림자나 예시 숫자를 복제하지 않았습니다.
- 남은 P0/P1/P2 항목 없음. 브라우저 원본 이미지와 구현의 세부 글자 크기, 경계, 장소 목록, 선택 상태를 비교했습니다.

## 검증 근거와 범위

52개 통과 확인과 수정 전 발견 사항은 `C:/Users/tbdk5/.codex/visualizations/2026/09/15/triplog-itinerary-summary-qa/verification.json`에 기록했습니다. 클립보드 성공/거부는 제어된 API 대체값으로 검증했으며, 실제 iPhone Safari 및 기기 클립보드는 별도 실기 확인 범위입니다.

---

# TripLOG 전체 화면 개편 QA

검증일: 2026-09-13~14. 최종 JS `redesign-20260914-13`, CSS `redesign-20260914-16`.

## 결과와 비교 기준

검증한 상태에서 남은 P0/P1/P2 문제는 없습니다. P3 차이와 실제 기기·서버 검증 범위는 아래에 기록했습니다.

Source visual truth는 `docs/redesign-20260913/`의 승인된 13개 PNG입니다. `http://localhost:8012/__qa/compare.html`에서 원본과 실제 `Travel.html` iframe을 같은 캔버스에 나란히 놓고 모두 직접 비교했습니다. 별도 이미지 두 장을 같은 화면의 비교로 간주하지 않았습니다.

기본 폭은 393 CSS px, 높이는 원본 비율에 맞췄습니다. 원본을 늘이거나 장치 프레임을 추가하지 않았습니다. 추가 반응형 검사는 320/393/1280 × 852 CSS px에서 수행했습니다. 최종 측정 iframe 폭은 392.995 CSS px, 내부 폭 393px, DPR 약 1.2였습니다. 원본 래스터는 브라우저에서 393px로 축소했고 실제 구현도 같은 배율에서 표시했습니다. 캡처 픽셀을 CSS px로 오인한 정량 오차 점수는 산정하지 않았습니다.

비교 파일은 캡처 원본 바이트입니다. 실제 반환 포맷이 JPEG이므로 `.jpg`로 보관했으며 픽셀 크기는 Pillow로 직접 읽었습니다. 제목·날짜·금액·아이콘·입력을 비교 영역에서 읽을 수 있어 추가 확대 크롭은 필요하지 않았습니다. 지출·정산·입력 화면은 동일한 850 × 900 비교 영역으로 캡처하고 DOM 경계도 확인했습니다.

## 비교 상태

서울 주말 여행, 2026-09-18~20, 나·민지·준호 3명, 예산 600,000원. 지출 312,000원(숙소 180,000 / 교통 72,000 / 식비 36,000 / 관광 24,000), 잔액 288,000원, 사용률 52%. 결제일은 9월 10~13일입니다. 정산은 1인 104,000원, 낸 돈 180,000/96,000/36,000원, 민지 8,000원·준호 68,000원을 나에게 보내는 상태입니다. 일정은 경복궁·북촌 한옥마을·광장시장, 준비물 4/6개, 서울·제주 저장 기록 2개를 사용했습니다.

시간 경과로 최종 D-4는 목업의 D-5와 다릅니다. 저장 시각은 테스트 레코드의 시각입니다. 영수증은 동일한 상호·날짜·금액 조건의 `qa-receipt-fixture.png`로 실제 OCR을 실행했으며 목업 안의 사진과 동일한 픽셀은 아닙니다. 초대 링크는 화면 검증용 값이며 실제 초대를 생성·발송하지 않았습니다.

## 최종 비교 증거

원본 경로는 `docs/redesign-20260913/<화면>.png`입니다. 각 비교 파일 왼쪽은 원본, 오른쪽은 구현입니다.

| 화면 | 원본 pixels | CSS viewport | 비교 이미지 | 비교 pixels |
| --- | --- | --- | --- | --- |
| overview | 853 × 1844 | 393 × 850 | [overview-comparison.jpg](docs/redesign-20260913/qa/overview-comparison.jpg) | 1063 × 1125 |
| start | 853 × 1844 | 393 × 850 | [start-comparison.jpg](docs/redesign-20260913/qa/start-comparison.jpg) | 1063 × 1125 |
| budget | 853 × 1844 | 393 × 850 | [budget-comparison.jpg](docs/redesign-20260913/qa/budget-comparison.jpg) | 1581 × 889 |
| settlement | 853 × 1844 | 393 × 850 | [settlement-comparison.jpg](docs/redesign-20260913/qa/settlement-comparison.jpg) | 1063 × 1125 |
| report | 853 × 1844 | 393 × 850 | [report-comparison.jpg](docs/redesign-20260913/qa/report-comparison.jpg) | 1063 × 1125 |
| settings | 853 × 1844 | 393 × 850 | [settings-comparison.jpg](docs/redesign-20260913/qa/settings-comparison.jpg) | 1063 × 1125 |
| login | 934 × 1684 | 393 × 709 | [login-comparison.jpg](docs/redesign-20260913/qa/login-comparison.jpg) | 1063 × 1125 |
| new-trip | 934 × 1684 | 393 × 709 | [new-trip-comparison.jpg](docs/redesign-20260913/qa/new-trip-comparison.jpg) | 1063 × 1125 |
| expense-add | 853 × 1844 | 393 × 850 | [expense-add-comparison.jpg](docs/redesign-20260913/qa/expense-add-comparison.jpg) | 1063 × 1125 |
| receipt | 853 × 1844 | 393 × 850 | [receipt-comparison.jpg](docs/redesign-20260913/qa/receipt-comparison.jpg) | 1063 × 1125 |
| packing | 934 × 1685 | 393 × 709 | [packing-comparison.jpg](docs/redesign-20260913/qa/packing-comparison.jpg) | 1063 × 1125 |
| invite | 853 × 1844 | 393 × 850 | [invite-comparison.jpg](docs/redesign-20260913/qa/invite-comparison.jpg) | 1063 × 1125 |
| history | 852 × 1846 | 393 × 851 | [history-comparison.jpg](docs/redesign-20260913/qa/history-comparison.jpg) | 1063 × 1125 |

추가 증거: [320px 지출](docs/redesign-20260913/qa/mobile-320-budget.jpg), [1280px 개요](docs/redesign-20260913/qa/desktop-overview.jpg), [일정 회귀](docs/redesign-20260913/qa/itinerary-regression.jpg), [지도 편집](docs/redesign-20260913/qa/itinerary-editor-regression.jpg). 일정 원본과 기존 비교는 [이전 QA](docs/itinerary-design/design-qa-20260913.md)에 보관했습니다.

## 발견·수정·재비교 이력

| 문제 | 조치 | 수정 후 증거 |
| --- | --- | --- |
| P1: 3D 컨테이너 때문에 고정 버튼·메뉴 위치가 달라짐 | flat 컨테이너와 공통 헤더·메뉴 적용 | overview/budget. 준비물 bottom 711.07px < footer top 712.99px |
| P1: 이전 로그인 장식과 여백이 새 그림에 겹침 | 이전 장식 제거, 목업 기반 래스터와 입력 간격 적용 | login |
| P2: 검색 상자 이중 테두리와 큰 지출 행 | 테두리·탭·행 높이·아이콘 색상 정리 | budget |
| P2: 나의 여행 입력·다른 여행 카드 높이 과다 | 날짜 라벨과 카드·행 간격 조정 | start, start-before 보관 |
| P2: 정산 하단 버튼·리포트 축 라벨 가림 | 행간·차트 높이·여백 조정 | settlement/report, settlement-before 보관 |
| P1: 준비물 창이 숨겨진 일정 페이지에 종속 | dialog를 body로 옮기고 실제 상태에 연결 | packing 및 저장·새로고침 검증 |
| P2: 준비물 체크박스 크기 상속과 하단 안내 가림 | 체크박스·헤더·목록·버튼 간격 조정 | packing 최종 비교 |
| P2: 기록의 일정·지출 수치가 한 줄에 뭉침 | 두 열 수치와 백업 행 구성 | history |
| P2: 영수증 사진이 좁고 입력이 하단 버튼 밑으로 밀림 | 이미지 프레임, 접을 수 있는 안내·원문, 입력 그리드와 하단 영역 정리 | receipt: 항목·결제 방식·적용 버튼 모두 표시 |
| P2: 초대 공유 설정 링크가 화면 밖으로 밀림 | 상태 안내와 링크를 같은 영역에 배치 | invite |
| P1: 일정 분석 탭이 구형 필드에 의존해 빈 화면 | 시작·종료와 이동 구간으로 실제 분석 | 일정 3개, 체류 195분, 이동 45분; 빈 날짜 0개/0분 |
| P1: 영수증 글자 오인식, 36,0002를 2로 분리 | OCR sparse 모드와 잘못된 숫자 그룹 거부 | 실제 2026-09-12 / 36,000 / KRW 추출, 파서 16 시나리오 |
| P1: 복원이 다른 활성 여행 ID를 덮어쓸 수 있음 | 저장된 여행 ID로 upsert 후 전환 | 서울 복원 후 부산 검증 여행의 120,000원 예약·ID 유지 |
| P1: 스냅샷 없는 여행이 JSON 가져오기에서 빠짐 | 현재 여행도 복원 후보로 보관, 반복 가져오기 ID 고정 | 백업 회귀 검사 통과 |

## 필수 디자인 표면

- **Fonts / typography:** Pretendard 우선 글꼴, 제목·금액과 보조 정보의 크기·굵기·행간을 비교했습니다. 입력은 iPhone 자동 확대를 고려한 16px 기반입니다. 미세 윤곽과 지역별 날짜·숫자 표기는 P3 차이입니다.
- **Spacing / layout:** 393px 여백·카드·행·입력·하단 메뉴를 대조하고 가려진 핵심 요소를 수정했습니다. 320/393/1280px에서 7개 주요 화면 모두 가로 넘침이 없습니다. 320px 지출 dialog의 clientWidth/scrollWidth는 320px이며 저장 버튼이 viewport 안에 있습니다.
- **Colors / tokens:** 흰 바탕, `#0b1020`, `#fff05a`, `#bce6fb`, `#f7afc7`, `#686b75`, `#e4e5e9`. active/disabled/checked/focus를 구분하며 여러 목업의 작은 색상 차이는 공통 멤버 색상으로 통일했습니다.
- **Image quality / assets:** 로고·서울 타워·가방·티켓·보관함은 목업 기준 래스터입니다. CSS 그림으로 대체하지 않았습니다. 표준 UI 아이콘은 Phosphor입니다. 지도·영수증 이미지는 실제 데이터에 따릅니다.
- **Copy / content:** 한국어 메뉴·행동 이름과 실제 저장·인식·중복 확인·빈 상태 안내를 적용했습니다. 원본의 ‘반영’은 실제 동작을 설명하는 ‘지출 정보에 적용’으로 표시합니다.

## 기능·기술 검증

- 지출 신규 저장·검색·수정, 결제한 사람/메모/결제일 유지, 삭제 취소·확인과 새로고침 확인.
- 실제 사진 OCR, 결과 반영, 결제일·receipt 메타데이터 유지, 중복 취소·저장. 해당 PC 샘플은 초기 약 3.4초, 캐시 후 약 1.2~1.3초였습니다. iPhone 속도 보장은 아닙니다.
- 안내 영역에서 원문 직접 입력 접근 가능. 자르기 canvas/wrapper 표시 크기가 약 233.3 × 350px로 일치합니다.
- 여행 생성, 예산 500,000원, 숙소 120,000원·예약번호 저장. 수정 시 기존 예약 메타데이터를 유지합니다.
- 준비물 체크·추가·순서 이동·새로고침 유지·테스트 항목 삭제 확인.
- 복원 취소·확인, 여행 ID 분리와 다른 여행 보존. JSON의 현재 여행과 과거 기록을 사용자가 선택해 복원합니다.
- 정산 합계, 구형 기록, 정수 분할, 잘못된 분담, 없는 결제자와 별도 지출 처리 검증.
- 리포트 분류 합계·100% 비율·결제일, 일정 분석과 빈 날짜 검증.
- PDF 버튼의 전체 리포트 DOM 생성과 print 1회 호출 확인. OS 인쇄 호출은 테스트에서 대체 후 원복했으며 실제 PDF 파일 저장을 실행한 검증은 아닙니다.
- 실제 인증 모듈에서 로그인/회원가입 전환, 이름·확인 비밀번호 필드, 표시·숨기기 확인. 실제 로그인 제출·메일 전송은 하지 않았습니다.
- 일정 수정 후 메모와 3개 좌표 유지, 지도 마커·날짜·편집창 회귀 확인.
- 70개 앱 JS 문법 검사 후 마지막 변경 파일 재검사 통과. 정산/리포트, 영수증 16 시나리오·5 숫자 형식·4 중복 판정, 백업, 좌표 5개, 시간 선택기 회귀 통과.
- 최종 DOM 중복 ID와 새 uncaught JavaScript 오류 없음.
- 최종 빌드 통과. HTML/loader/스타일/기능/실제 인증 모듈/새 이미지가 소스와 일치합니다. QA 서버·문서는 배포 목록에서 제외됩니다.

## P3와 남은 검증 범위

생성 이미지와 웹 폰트·표준 아이콘의 미세 윤곽·굵기·날짜 표기·일부 보조 여백 차이는 남습니다. 동일 픽셀 복제라고 주장하지 않습니다.

실제 iPhone 14 Pro Safari, 실제 계정의 Supabase 로그인·실시간 동기화·초대 생성, 운영 배포 후 환경은 로컬 QA 범위 밖입니다. RLS/스키마는 변경하지 않았습니다. 샘플 서버의 인증 대체는 로컬 QA 전용이며 실제 인증 UI는 별도 일반 정적 서버에서 검증했습니다.

## Implementation checklist

- [x] 승인된 13개 화면과 공통 메뉴 구현
- [x] 기존 일정 타임라인·지도 편집 유지
- [x] 입력·저장·OCR·정산·복원 검증
- [x] 원본/구현 비교와 P0/P1/P2 수정 후 재확인
- [x] 반응형·문법·회귀·최종 빌드 검증
- [x] 비교 이미지·상태·한계 기록

## 2026-09-14 개요에서 여행 전환·추가

기존 화면 톤에 맞춘 [추가 컨트롤 콘셉트](docs/redesign-20260913/overview-trip-switcher-concept.png)를 생성한 뒤 구현했습니다. 상단에 노란 `새 여행` 버튼을 추가하고, 현재 여행 이름의 하늘색 펼침 버튼에서 검색 가능한 선택 창을 엽니다. 작은 화면에서 제목과 버튼이 밀리지 않도록 여행 선택 버튼은 기존 여행 카드의 제목에 배치했습니다. 새로운 여행별 그림을 임의로 만들지 않고 기존 서울 이미지와 Phosphor 아이콘을 재사용했습니다.

모바일은 내용 높이에 맞는 하단 패널, PC는 520px 중앙 팝업입니다. 현재 여행을 노란색으로 표시하며, 여행 이름·도시·국가 검색과 검색 결과 없음, 검색어 지우기, 지난 여행 표시를 제공합니다. 기존 저장/전환 및 여행 생성 경로를 재사용합니다. 새 여행 기본 날짜는 오늘부터 2박 3일입니다.

| 검증 | 결과 |
| --- | --- |
| PC 개요·선택 창 | 본문, 로고, 하단 메뉴 중심 일치. 선택 창의 검색 입력 이중 테두리와 불필요한 높이 제거 |
| 모바일 393px | 가로 넘침 없음. 준비물 하단 713.03px < 고정 버튼 영역 시작 714.66px |
| 모바일 선택 창 | 2개 여행일 때 높이 465.73px, 하단 버튼까지 표시. Escape 후 여행 선택 버튼으로 포커스 복귀 |
| 320px, 여행 12개 | 긴 이름과 특수문자를 텍스트로 표시. 가로 넘침 없음. 목록 높이 470px / 내용 1134px, 실제 스크롤 664px 확인 |
| 검색 | 이름·여행지 검색, 공백 포함 `서 울`, 결과 0개, 검색어 지우기 확인 |
| 새 여행 | 개요 버튼과 선택 창 버튼에서 생성 폼 진입. 취소·포커스 복귀·오늘 기준 날짜·생성 완료 확인 |
| 저장·전환 | 생성한 여행 선택이 새로고침 후 유지. 서울로 전환 후 지출 312,000원, 예산 600,000원, 일정 3개, 준비물 4/6 유지 |
| 런타임 | 최종 앱 직접 로드 후 검색/닫기에서 새 예외·콘솔 오류 없음. 중복 DOM ID 없음 |

생성/전환 데이터 검증은 사용자 샘플 미리보기와 저장 공간이 분리된 `127.0.0.1:8012`에서 진행했습니다. 긴 목록 검증용 임시 10개 여행은 제거했습니다. 비교용 임시 iframe 페이지 전환 중 관찰자 오류 1건이 있어 최종 앱 직접 로드의 새 이벤트 구간을 별도로 확인했으며, 해당 구간은 오류가 없습니다. 변경한 JS 문법 검사와 정산/리포트·백업 회귀가 통과했습니다.

화면 증거: [모바일 개요](docs/redesign-20260913/qa/trip-switch-overview-mobile.jpg), [모바일 선택 창](docs/redesign-20260913/qa/trip-switch-chooser-mobile.jpg), [320px 긴 목록](docs/redesign-20260913/qa/trip-switch-chooser-320.jpg), [PC 개요](docs/redesign-20260913/qa/trip-switch-overview-desktop.jpg), [PC 선택 창](docs/redesign-20260913/qa/trip-switch-chooser-desktop.jpg).

최종 빌드, 저장소 기본 줄바꿈 설정에서의 diff 검사, 변경한 런타임 파일 5개의 소스/배포 산출물 해시 일치를 확인했습니다. 모바일 393px 화면 캡처 파일은 브라우저 배율에 따라 491×1065px로 저장되며, 320px 캡처는 320×852px, PC 캡처는 1627×1590px입니다.

기존 디자인의 윤곽·색상을 유지했으며 생성 이미지와 텍스트 배치의 소폭 차이는 화면 크기에 맞춘 의도적인 조정입니다. 실제 iPhone Safari와 운영 계정 동기화는 이번 로컬 검증 범위 밖이며, 배포는 실행하지 않았습니다.

## 2026-09-14 국가 입력 편집 수정

국가 입력창이 `readOnly=false`임을 확인했습니다. 일반 Backspace는 재현 환경에서 동작했지만, 한글 조합 중 Enter 이벤트가 추천 국가를 선택해 `감`을 `감비아`로 덮어쓰는 오류를 재현했습니다. 조합 시작/종료와 `isComposing`·229 키 코드를 구분해 입력 중 자동 선택과 추천 목록 재생성을 막았습니다.

- 동일 조합 이벤트 재검증: 입력 `감` 유지, Enter 기본 동작 가로채기 없음.
- 선택한 `일본`에서 Backspace → `일`, 국가 코드 해제 확인.
- 전체 선택 후 Delete와 추가한 지우기 버튼 → 빈 입력 확인. 지우기 후 입력 포커스 유지.
- 지운 뒤 국가 재입력·선택 확인. Escape는 먼저 추천 목록만 닫고 작성 폼을 유지합니다.
- 지우기 버튼 44×44px, 입력 테두리 내부 배치와 접근성 이름 확인.
- 변경 JS 문법, 빌드, diff 검사, 런타임 파일 6개 소스/산출물 해시 일치 확인. 최종 앱 콘솔 오류 없음.
- 현재 미리보기에 수정본을 적용한 뒤 작성 중이던 여행 이름·국가·도시·기간과 국가 입력의 커서 위치를 복원했습니다. 해당 폼을 제출하지 않았습니다.

실제 운영체제 한글 입력기와 iPhone Safari 실기기 검증은 별도이며, 이번 재현은 브라우저의 조합 이벤트 및 실제 삭제 키 입력을 사용했습니다.

## 2026-09-14 국가 직접 타이핑 후속 수정

사용자가 키를 눌러도 글자가 입력되지 않는다고 명확히 알려주어, 입력 필드 구조를 수정했습니다. `role=combobox`와 자동 선택 속성을 제거하고, 국가 라벨·일반 텍스트 입력·검색 결과 버튼을 분리했습니다. 국가 추천은 120ms 입력 대기 후 최대 8개만 표시하며, 첫 결과를 미리 선택하지 않습니다. 빈 입력에서는 목록을 닫습니다. 입력 중 글자를 코드로 덮어쓰지 않으며, 국가 선택은 결과 클릭 또는 방향키로 이동 후 Enter로 수행합니다.

검증에서는 `fill`로 값을 설정하는 방법 외에 CUA의 직접 `typeText`·`pressKey` 경로를 사용했습니다.

- 브라우저 접근성 트리에서 국가가 선택형 컨트롤 대신 편집 가능한 텍스트 필드로 인식됩니다.
- `일본` 타이핑 → `일본`, Backspace → `일`, 다시 입력 후 왼쪽 이동·중간 삽입 → `일가본`과 커서 2 확인.
- Ctrl+A 후 `캐나다`로 교체, 방향키로 결과 이동 후 Enter → 국가 코드 `CA`, 입력 포커스 유지 확인.
- Ctrl+A·Delete → 빈 입력, 결과 버튼 0개 확인.
- `a` 직접 입력 → 입력 `a` 유지, 결과 8개, 자동 선택 0개 확인.
- 변경한 런타임의 빌드·문법·diff·소스/산출물 해시 일치 확인. 새 앱 콘솔 오류 없음.
- 현재 미리보기에 버전 23을 적용하고 작성 중인 폼과 커서를 복원했습니다.

in-app browser의 CDP `Input.imeSetComposition`은 지원되지 않아 실제 운영체제 IME 조합을 그 경로로 검증했다고 주장하지 않습니다. 위 검증은 지원되는 브라우저 직접 타이핑/키 입력 경로를 사용했습니다.

## 2026-09-14 실제 사용자 IME 추적과 영문 국가명

국가 입력칸에 한정해 90초 동안 조합·입력·키 이벤트를 메모리에서 관찰하고, 사용자가 직접 삭제 문제를 재현한 뒤 관찰자를 제거했습니다. 44개 이벤트에서 현재 조합 글자를 줄이고 없애는 `insertCompositionText`와 `compositionend`는 확인됐지만, 앞에 남은 완성 글자를 지우기 위한 Backspace/`deleteContentBackward` 이벤트는 해당 입력칸에서 관찰되지 않았습니다. 기록된 이벤트의 `defaultPrevented`는 모두 false였습니다. 일반 입력 키의 전달 문제는 Codex 인앱 브라우저 쪽으로 추정되며, 이 현상을 사이트 수정으로 해결했다고 판정하지 않습니다.

동일 소스를 일반 Chrome에서 열고 지원되는 CDP `Input.imeSetComposition`과 실제 Backspace 키 경로를 사용했습니다. `가나 → 가ㄴ → 가 → 빈 문자열`을 확인했습니다. 앞서 인앱 브라우저에서 지원되지 않았던 조합 입력 프로토콜은 Chrome에서는 동작했습니다. 이는 Chrome 엔진의 조합/삭제 검증이며, iPhone 실기기 검증은 아닙니다.

영문 국가명 입력에서는 한국어·영어 결과를 함께 표시하고, 영어로 검색하면 영어 이름을 먼저 표시합니다. 영어 검색 결과를 선택해도 입력값을 영어 이름으로 유지합니다. `Japan`, 국가 코드, 대소문자, `USA`, `UK`, `Turkey`/`Türkiye`, `Czech Republic`, `Hong Kong`, `Macau` 등을 처리합니다.

- 브라우저: `Jap` 입력 → `Japan / 일본` 결과 → 선택 후 값 `Japan`, 코드 `JP` 확인.
- `scripts/country-search-regression.js`: 250개 영문 국가명, 한국어·영어·코드·약칭, 대소문자/구두점, 부분·잘못된 입력 검증 통과.
- 빌드·JS 문법·diff·런타임 파일 7개의 소스/산출물 해시 일치 확인.
- Chrome 및 인앱 브라우저에 작성 중이던 폼 값을 복원했습니다. 폼 제출과 운영 배포는 하지 않았습니다.

웹사이트/Chrome 검증은 통과했습니다. **Codex 인앱 브라우저의 조합 종료 후 삭제 문제는 미해결인 외부 실행 환경 제약**으로 남아 있으며, 확인한 Chrome 미리보기를 별도로 열어두었습니다. 아래 최종 판정은 웹사이트의 검증 범위에 해당합니다.

final result: passed

## 2026-09-14 여행 동행 기능 — 최종 검증

런타임 버전: `companion-20260914-2`. 기능 구현 전에 목업 6장을 생성했으며 기존 승인 이미지와 자산을 재사용했습니다. 구현 기준은 [여행 동행 설계 기록](docs/travel-companion-20260914/implementation.md)에 있습니다.

### 화면 및 디자인

| 화면 | 비교 이미지 | 결과 |
| --- | --- | --- |
| 오늘의 여행 | [비교](docs/travel-companion-20260914/qa/today-comparison.png) | 다음 장소·진행률·가용 예산·고정 하단 동작 확인 |
| 일정 점검 | [비교](docs/travel-companion-20260914/qa/review-comparison.png) | 이동 부족·중복 시간 경고, 시간 잠금 확인 |
| 예약 지갑 | [비교](docs/travel-companion-20260914/qa/wallet-comparison.png) | 교통·숙소·입장권 카드와 복사 동작 확인 |
| 여행 도구 | [비교](docs/travel-companion-20260914/qa/tools-comparison.png) | 시간대·ICS·오프라인 저장·준비물 연결 확인 |
| 시간 조정 미리보기 | [비교](docs/travel-companion-20260914/qa/adjustment-comparison.png) | 변경 전후 시간과 적용·취소 확인 |
| 예약 입력 | [비교](docs/travel-companion-20260914/qa/reservation-editor-comparison.png) | 종류·날짜·번호·주소·메모와 저장·취소 확인 |

흰색/검정 외곽선, 노랑 기본 동작, 파랑·분홍 포인트, 기존 TripLOG 로고와 서울 타워, Phosphor 아이콘을 사용했습니다. 공통 대화상자 스타일이 새 제목·체크박스·폼에 영향을 주던 문제를 전용 CSS 범위에서 수정했습니다. 목업의 예산 설명은 계산에 맞게 ‘오늘 사용’으로 보정했으며, 예약일은 실제 요일을 사용합니다.

393×852 CSS viewport에서 6개 화면을 확인했습니다. 기본 예제의 활성 스크롤 영역은 콘텐츠 높이와 같으며, 가로 넘침은 없습니다. 비교 PNG는 브라우저 캡처 배율을 포함하므로 PNG 픽셀 수를 CSS viewport로 간주하지 않습니다. 화면 폭은 DOM에서 별도 확인했습니다.

- 320px: [예약 입력](docs/travel-companion-20260914/qa/reservation-editor-320.png), [여행 도구](docs/travel-companion-20260914/qa/tools-320.png), [시간 조정](docs/travel-companion-20260914/qa/adjustment-320.png)에서 가로 넘침과 버튼 잘림 없음. 날짜 입력칸 각각 141px 확인.
- 1280px: [PC 오늘의 여행](docs/travel-companion-20260914/qa/today-desktop.png). 중앙 대화상자 안에서 일정과 예산을 두 열로 배치해 모두 표시합니다. 중앙 정렬과 가로 넘침 없음 확인.
- 일정이 많거나 검증 오류가 길어지면 본문을 스크롤하고 하단 주요 동작은 유지합니다.

### 브라우저 기능 검증

검증은 사용자 여행 저장소와 분리된 루프백 `127.0.0.1:8014`의 샘플 데이터로 진행했습니다. 이 검증 서버는 인증 모듈 응답을 샘플용으로 대체하며, 소스 인증 코드를 바꾸지 않습니다. 서버·샘플·목업·QA 자료는 `dist`에 포함되지 않습니다.

- 경복궁 완료 → 1/3, 33%, 다음 장소가 북촌으로 변경. 새로고침 후 유지, 완료 취소 확인.
- 북촌 시간 잠금 후 +30분 조정 → 충돌 메시지와 적용 버튼 비활성화. 잠금 해제 후 `10:30–12:00`, `12:15–13:15`, `13:45–14:45` 적용 확인. 경고가 사라지고, 되돌리면 원래 세 시간이 저장됨.
- 기존 숙소 지출·일정 바우처·수동 교통 예약을 3개로 집계. 개요의 예약 요약도 같은 데이터를 사용함.
- 예약 이름 필수 검증, 한글·영문 입력, 추가, 수정, `QA-UPDATED` 예약번호 복사, 새로고침 복원, 확인 후 삭제 검증. 테스트용 예약은 정리함.
- 예약의 일정 연결 → 예약번호와 07:00 시각이 연결된 일정 편집 창에 표시됨. 연결된 바우처를 지갑에 중복 표시하지 않음.
- 미저장 예약 입력 도중 다른 여행으로 전환하면 창이 닫히고, 새 여행의 예약은 0개. 원래 여행으로 돌아오면 기존 예약 1개가 유지되고 미저장 초안은 저장되지 않음. 별도 테스트 여행은 정리함.
- Chrome에서 새 예약 이름 입력에 조합 입력 후 Backspace를 사용하여 완성 글자 삭제를 확인함. 국가 입력의 기존 Chrome 검증 결과도 유지함.
- 실제 다운로드 동작으로 생성한 ICS: 일정 3개, 서울 10:00 → UTC `20260918T010000Z` 확인. 파일 생성 후 iPhone의 Mail 가져오기 안내가 표시됨.
- 포켓노트 HTML: 일정·예약·인라인 로고 포함, 외부 리소스 0개, 실행 스크립트 0개. 예약번호 제외 옵션에서는 `SEOUL-2026`, `TRAIN-0918`이 없으며, 예산을 선택하지 않으면 예산 금액도 없음. 임시 파일 검증 훅은 제거함.
- 최종 버전의 Chrome 콘솔 오류 0건, 기능 상태 오류 메시지 없음.

### 코드 및 데이터 검증

- `scripts/travel-companion-regression.js`: 날짜/윤년, 다음 장소, 예산 이월, 중첩 중복 일정, 이동 시간, 완료·잠금 보호, 적용·되돌리기, 미리보기 후 변경 감지, 자정 초과, 예약 집계·검증, 링크 검증, DST 중복/누락, UTF-8 ICS 줄 접기·이스케이프, 오프라인 문서의 이스케이프·정보 제외, 상태 정규화, 공유 범위와 백업 복원 통과.
- 기존 `persistence-backup-regression.js`, `redesign-regression.js`, `country-search-regression.js` 통과.
- 변경한 JavaScript 10개 문법 검사, `git diff --check` 통과.
- 안전한 경로 확인 후 정적 배포 파일 생성. 런타임 12개 파일의 소스/산출물 해시 일치. QA·문서 파일이 배포 파일에 포함되지 않음 확인.

남은 웹앱 P0/P1/P2 항목 없음. 실제 iPhone Safari 기기, 실제 Supabase 로그인·초대·동시 접속은 이번 검증 범위 밖입니다. 캘린더는 표준 ICS 파일 생성이며 기기 캘린더에 자동 등록했다고 주장하지 않습니다.

앞서 기록한 Codex 내장 브라우저의 조합 종료 후 삭제 이벤트 전달 문제는 외부 실행 환경 제약으로 남습니다. 이 문제를 해결했다고 표시하지 않으며 Chrome에서 확인한 실행 경로를 제공합니다. 이번 기능은 로컬 구현·검증까지 완료했고 운영 배포와 Git 커밋·푸시는 하지 않았습니다.

final result: passed
