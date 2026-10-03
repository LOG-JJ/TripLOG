# Compact reservation summary — 2026-10-04

final result: passed

## Visual truth and normalization

- Selected target: `../../triplog-reservation-t2i-brand-editorial-20261004.png`, the exact refined T2I result approved by the user. Original size: 1566 × 1005 pixels. The saved PNG matches the exact Image Gen original at `C:/Users/tbdk5/.codex/generated_images/01a0c429-1920-7d20-a95f-bb0950d8831b/exec-7a48cbcf-100d-4cad-b7d3-25f76a5ee52b.png`, SHA256 `f1ea723a2e566d653f3f87fe77c34beca6cfe8e3a3b6185b2a4d9f0a4bacc8d3`.
- A previous latest-file save selected an unrelated concurrent generation. This was corrected from that exact original before the final visual comparison; the adjacent mockup JSON records both hashes. `AGENTS.md` now requires exact-source/hash verification.
- Compare the component only: crop the original frame to `(39, 39, 1527, 966)` and proportionally normalize to 354 × 221 pixels. Do not count the source's outside canvas as application padding.
- Implementation: `summary-390.png`, a 354 × 232 pixel component capture in a 390 × 844 CSS-pixel viewport at device scale factor 1. Both columns contain synthetic September 25–28 reservations: three flights and two stays. No selection or open dialog; light app theme.
- Full comparison: `comparison-final.png`; readable 2× inspection: `comparison-final-2x.png`. Focused type/content/action comparison: `comparison-final-text.png`. Both sides remain at equal width and preserve their actual height rather than stretching the implementation to conceal spacing differences.
- App context: `overview-390.png`; alternate states: `summary-320.png`, `summary-1440.png`, `empty-390.png`, `many-long-320.png`.
- Local in-app preview: `http://127.0.0.1:18088/Travel?page=overview&trip=reservation-pockets-fixture`. The in-app browser capture is `C:/Users/tbdk5/AppData/Local/Temp/triplog-reservation-summary-iab-20261004.jpg`.

## Comparison history and findings

1. [P2, fixed] The old shared reservation container inherited broad child-span rules, and the accommodation column initially shared a class with its rows. These changed the intended two-column layout. The component now has independent semantic sections and `.rs-summary-stay-item` rows; final desktop and mobile captures show aligned columns.
2. [P2, fixed] The first valid comparison (`comparison-first.png`, `summary-first.png`) was 354 × 249 pixels versus the normalized target's 354 × 221 pixels. Excess brand-row spacing made the panel taller, while the category type looked smaller. Reduced outer/brand/row spacing and enlarged category type. The recaptured panel is 354 × 232 pixels with matching hierarchy and compact content; the remaining 11 pixels mainly retain a 36-pixel visible button target.
3. [P3, accepted] Generated plane/hotel details differ slightly from the source, and the existing supplied TripLOG logo has its established outlined pink label. The plane, hotel, ink/blue/pink palette and compact positions match the selected direction. The library's bidirectional arrow uses its standard shape. No blocking visual mismatch remains.

## Required fidelity surfaces

- **Typography:** Uses the bundled Pretendard variable face registered as `TripLOG Collaboration`; the browser test checks the computed primary family is actually loaded. At 390 px, category type is about 18 px/800, route about 18 px/850, hotel names about 14 px/750, and supporting dates 12 px with lighter weight. Names stay on one line with ellipsis and retain complete text in accessible content/title attributes and the wallet. Source and render were inspected together at 2× for Korean metrics, wrapping and baseline alignment.
- **Spacing/layout:** One white outlined frame, small brand row, equal columns, quiet vertical divider, two accommodation rows with a fine separator, and yellow actions on one baseline. The two-column structure remains at every tested width from 320 to 1440 px. The panel stays below 280 px high and avoids horizontal overflow. Empty/many/long-name states preserve the same compact layout.
- **Colors/tokens:** App ink `#0b1020`, white surface, yellow `#fff05a`, muted text `#686b75`, and generated light-blue/pink accents. Buttons retain the app's small solid offset shadow and outlined treatment. No leather texture or old pocket background remains in this component.
- **Images:** Real generated transparent WebP plane and hotel assets, 384 × 216 and 192 × 192 pixels, total 44,934 bytes. Original PNGs and prompts are in `assets-original/`. Each original was SHA256-verified against its generation result. Supplied logo reused; ordinary arrows/train/ticket use the existing Phosphor library. No CSS or SVG illustration substitutes. Screenshots confirm all images load and fit without stretching or conspicuous transparency halos.
- **Copy/content:** Category labels, full counts, route, airline, dates, nights and `전체 보기` match the selected composition. Real data drives the preview; it never merges records. Transport shows the first dated reservation, and accommodation shows up to two records. Generic rail/ticket entries, one-way flights, year boundaries, missing dates and invalid stay periods have truthful fallbacks. Empty columns show short guidance and `예약 추가`.

## Behavior and verification

The flow under test is: trip overview → a compact reservation summary → the correctly filtered full wallet or the correct-type add form → close/save → preserved records after reload.

- Browser plugin not available. Used the existing isolated Playwright/Edge project tests for reproducible viewport/data cases, and the in-app browser for actual preview rendering and wallet interaction. Synthetic tests block external production services.
- `node scripts/reservation-pockets-browser-regression.js`: passed 320/360/390/480/600/768/1440 layouts; title/count separation; actual font and image loading; one transport/two stay previews; complete counts; original airport qualifiers in the full wallet; keyboard activation/focus return; no state mutation on open/cancel; direct add/save/reload; generic/one-way/cross-year/missing/invalid/many/escaped/empty data; zero uncaught page errors.
- `node scripts/wallet-passbook-browser-regression.js`: passed filtered wallet, original-record details/editing, manual create/edit/reload, search/sort, empty/long data and mobile/desktop layout.
- `node scripts/reservation-expense-editor-browser-regression.js`: passed existing reservation editing, original wallet metadata, no duplicated lodging, cancel/reload and validation guards.
- `npm test`: passed all configured core, sync, persistence, travel-companion, redesign, map, itinerary-order, country/time and receipt checks.
- `npm run build`: passed; generated `Travel.html` build fingerprint and `sw.js` were reviewed for the release.
- In-app browser: expected page title/route, meaningful nonblank content, no framework error overlay, real `전체 보기` opens three original transport records, and closing returns to the summary. The isolated preview logs expected exchange-rate fetch warnings because external services are blocked; no relevant app error was observed.

## Remaining limits and checklist

- Physical iOS/Android devices and Safari were not available. Responsive Chromium/Edge and the in-app browser were verified.
- Long names and cross-year dates intentionally truncate in the compact preview; their full values remain in the wallet. The rendered summary is deliberately a preview of individual records, not a statement that every transport booking shares the same route.
- Desktop and empty states extend a mobile populated-state reference. No authentication, persistence, database or API contract changed.
- [x] Resolve and verify the exact selected reference.
- [x] Generate, verify and place both required raster assets.
- [x] Compare source/render together and resolve P2 layout/type drift.
- [x] Check all five fidelity surfaces and responsive/empty states.
- [x] Exercise wallet and add/edit/save/reload behavior.
- [x] Run relevant regressions and core tests.
- Deployment verification is reported separately after the Git-based release; a passing QA report alone does not establish production rollout.
