# Destination Postcard header — 2026-10-04

final result: passed

## Selected visual and evidence

- User-selected target: `../20261004/triplog-trip-header-postcard-20261004.png`, the first displayed header concept. Original 1983 × 793 pixels; exact generation original SHA256 `ce5f368a29ca49effc244b120a887567f298e3c4e1c493ffc03696c3453e1e97`.
- Normalize only the component frame: source crop `(32, 132, 1952, 650)`, proportionally scaled to 912 × 246 pixels. The surrounding white canvas is excluded.
- Implementation `header-1440.png`: 912 × 232 pixels at a 1440 × 1000 CSS-pixel viewport, device scale 1. State matches the reference: `1000일 순천`, `D-6`, October 10–11, one night/two days, two people, no open dialog. Preview clock is fixed to October 4, 2026 in Asia/Seoul.
- Source and implementation were opened in the same comparison image: `comparison-final.png`. Magnified type/control evidence: `comparison-final-type.png`. The earlier comparison remains `comparison-first.png` and `header-first.png`.
- Responsive evidence: `header-320.png`, `header-390.png`, `header-768.png`, `overview-390.png`, `overview-1440.png`, `long-320.png`. Mobile is a responsive extension of the selected wide component, keeping the picture above the facts row and the full trip selector label accessible.
- Local in-app preview: `http://127.0.0.1:18089/Travel?page=overview&trip=trip-header-suncheon`. Its final actual capture is `C:/Users/tbdk5/AppData/Local/Temp/triplog-trip-header-iab-20261004.jpg`.

## Comparison history and findings

1. [P2, fixed] A shared typography selector initially overrode the new trip-title font, leaving an 18px heading. Scoped the component rule above the shared selector's specificity and verified the computed, actually loaded Pretendard face. The final heading scales with its container and uses 850 weight.
2. [P2, fixed] In the first same-width comparison, the D-day and metadata were substantially smaller than the source. Increased their container-relative sizes and the trip title, preserving the compact frame. Final full and magnified comparisons show the intended title/status/facts hierarchy.
3. [P2, fixed] Very long trip names could make a desktop header approach 390px high. Limited the displayed title to two lines; preserved the complete title in both the button's accessible label and title attribute, and in the existing trip selector.
4. [P2, fixed] At an intermediate in-app viewport around 613px, the member chevron touched the painting. Reduced the desktop copy region to 58%; facts wrap within that area while the art uses the remaining 42%. Regression checks now assert that text and controls stay outside the art region at every viewport, and mobile metadata stays below it. Recaptured and reviewed the actual in-app panel after the fix.
5. [P3, accepted] The new scene collection has finer watercolor detail than the concept's flatter sketch. All 40 assets share the same pale blue/green/sand palette, outlined illustration treatment and postcard composition. The standard Phosphor icons and compact app-style badge differ slightly from the generated mock. No actionable P0/P1/P2 mismatch remains.

## Required fidelity surfaces

- **Typography:** Bundled Pretendard registered as `TripLOG Collaboration`, verified loaded in browser. Container-scaled title, bold pink countdown, clear date/duration/member hierarchy; full text remains accessible when long names clamp. The source and rendered Korean letterforms, weights, baseline and spacing were examined together at 2×.
- **Spacing/layout:** One outlined white card, left-aligned trip information and a right-side landscape. Desktop frame 912 × 232 versus normalized source 912 × 246. The 14px height difference is accepted for the live controls. Two-line long names, intermediate widths, 320/360/390/480/600/768/1024/1440 layouts and image/text separation pass. Mobile keeps a visible illustration rather than removing it.
- **Colors/tokens:** Ink `#0b1020`, white, pink `#f7afc7`, blue and soft natural accents from the scene collection, subtle gray separators. Uses current product colors rather than introducing a separate theme.
- **Images:** 30 city scenes plus 10 fallback themes, each generated independently once through built-in T2I without image inputs. Preserved source, exact prompt and SHA256 metadata live in `assets-original/`; every stored original was verified against the exact returned source path. Ordinary sizing/encoding produced 800 × 480 transparent WebP assets. City images total 4,035,428 bytes; common themes total 1,310,698 bytes. Contact sheets `asset-contact-korea.png`, `asset-contact-world.png`, `asset-contact-themes.png` were inspected for subject, crop, consistent style, transparency and readable landmarks. No CSS/SVG image substitutes.
- **Copy/content:** Live trip name, status, dates, duration and member count; illustration chosen from saved country/city. No hardcoded sample data in application modules. Existing trip selector and member entry points remain the actual controls. All test fixtures are isolated from production services.

## Destination contract

- Catalog: 80 destinations, 30 domestic and 50 overseas. Thirty receive dedicated images; the rest use 10 explicitly assigned scene themes. City/island/region identities are recorded separately.
- Match country/territory plus exact normalized aliases, including Korean, English and relevant local names. Unknown country/city, ambiguous short names and multiple destinations receive safe generic scenes. The trip title is never parsed as a destination.
- Known parent relationships are explicit: Seogwipo/Jeju City use the Jeju regional image; Hokkaido uses a forest theme and Hawaii an island theme, without pretending either region is a particular city. Da Nang and Hoi An remain distinct. Ambiguous Gwangju stays generic until qualified.
- Selection is synchronous, deterministic and read-only. No schema, migration, API, authentication or trip persistence contract changed.

## Loading, offline behavior and cache separation

- The build continues hashing the content, but excludes `/src/assets/trip-scenes/cities/` from the required app-shell precache. The 10 common themes remain bundled for offline fallback.
- Only the selected city image is requested. A separate cache holds at most 48 immutable versioned city-image paths; eviction never touches the app shell or user records.
- The first visible city is warmed when a newly installed worker starts controlling the page. This closes the initial-load race where the image can finish before the worker activates.
- Offline: previously cached city images remain visible; an unvisited city uses its bundled scene. Missing or invalid image responses fall back again to the universal travel illustration. A hosting provider's 200 HTML fallback is never accepted as a cached image. API/account responses are outside this cache route.

## Verification

The flow under test is: trip overview → correct destination scene → trip selector/member controls → another destination → reload/offline → correct preserved data and an available image.

- Browser plugin not available; used existing isolated Playwright/Edge regressions and the in-app browser for actual rendering and trip-selector interaction. No production services were contacted by the fixtures.
- `destination-scenes-regression.js`: 80 entries/30 dedicated/10 themes, every country/alias, Unicode/diacritics, wrong/missing country, unknown/ambiguous/multiple destinations, parent regions, non-mutating deterministic results and all deployed images present.
- `trip-header-browser-regression.js`: expected D-6/dates/two members, actually loaded Korean font, art, eight viewport widths, no overflow or art/control overlap, trip selector, keyboard/focus return, member modal, real trip switching/reload, preserved user fields, long names, escaped input, missing destination, same-day copy and failed-image fallback. No uncaught runtime errors.
- `trip-scene-cache-browser-regression.js`: no bulk city installation; first-city warming; real offline reload; unvisited-city fallback and online recovery; HTML/API exclusion; 48-entry bound under concurrent fetches; app-shell retention. No uncaught runtime errors.
- `npm test`: passed all configured core, database/sync, persistence, model, map, order, country, destination and receipt checks.
- `npm run build`: passed; generated `Travel.html` fingerprint and `sw.js` were reviewed, including the city-image exclusion and bundled themes.
- Existing browser regressions passed: trip chooser, trip library, compact reservation summary, automatic update (including incomplete deployment and draft preservation), offline app restart and draft recovery.
- In-app browser: correct route/title, meaningful screen, no error overlay, loaded Suncheon image, live trip-selector open/close and zero error logs. Expected exchange-rate warnings may appear in the preview because external services are intentionally blocked.

## Limits and implementation checklist

- Physical iOS/Android devices and Safari were not available. Responsive Chromium/Edge and the in-app browser were verified.
- Dedicated paintings cover the agreed first 30 destinations; 50 catalog entries intentionally use themes. These are illustrative destination summaries rather than geographic maps or current-weather imagery.
- [x] Resolve the exact selected visual and compare with the implemented state.
- [x] Produce, preserve and verify 30 dedicated images and 10 fallback themes.
- [x] Keep country/city matching separate from the view and from persistence.
- [x] Resolve layout/type/overlap findings and inspect final evidence.
- [x] Exercise controls, responsive states and offline/update safety.
- Build and Git-based production verification are recorded at release; QA alone does not establish deployment success.
