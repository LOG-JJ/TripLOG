# Illustrated postcard header: mobile correction — 2026-10-04

final result: passed

## Follow-up: smaller trip title — 2026-10-04

- The user explicitly requested a smaller trip title after viewing the implementation. This overrides the original mock's display-title scale without changing the selected composition or artwork.
- Mobile title range is now 20–24px (previously 23–32px); desktop is 24–40px (previously 28–72px). The user's current 439px in-app viewport changed from 32px to 24px. Tracking was proportionally relaxed; font family/weight, controls, dates, art and left/right placement remain intact.
- Inspected actual captures together at 390 and 1440px: `title-reduced-390.png` and `../trip-scenes-world-300-20261004/browser-header/header-1440.png`. Existing comparison images below document the earlier stage; these two captures are the current title-size evidence.
- Existing header browser regression passed all eleven widths and long-title/interaction/fallback cases; its readability bound now also prevents oversized titles. `npm run build` passed. No new test suite or image generation was needed for this scoped typography correction.

## User intent and visual targets

- Preserve the original illustrated postcard mood. Both mobile and desktop place information on the left and the destination illustration on the right.
- Original desktop reference: `../20261004/triplog-trip-header-postcard-20261004.png`. The user supplied that same visual again as `codex-clipboard-45b82e80-c258-4aa5-bbde-bed5bfd786f5.png`.
- Mobile reference: `../20261004/triplog-trip-header-mobile-postcard-20261004.png`, generated once using the explicitly requested original reference. Original 1698 × 926 pixels; exact-source SHA256 `a17c01d16e4aa621bfb3fe2a51b5fb85f74c85b9100c361e65d9440a660fe1b6`.
- The earlier photo/banner concept was rejected by the user and is not a runtime asset or implementation target. Its manifest records that rejection.
- Test state: Suncheon, `1000일 순천`, D-6, October 10–11, one night/two days, two members, fixed October 4 clock; no open dialog. Isolated fixture data never reaches production services.

## Comparison evidence and normalization

- Mobile source component crop: (51, 129, 1649, 813), proportionally normalized to 354 × 152 pixels. Actual browser card: 354 × 172 at a 390 × 844 CSS viewport and device scale 1. The 20px height difference accommodates readable metadata and 44px live title/member targets.
- Desktop source component crop: (32, 132, 1952, 650), normalized to 912 × 246. Actual desktop card: 912 × 232 at 1440 × 1000 and device scale 1.
- Combined comparisons were opened and inspected: `comparison-mobile.png`, magnified `comparison-mobile-detail.png`, and `comparison-desktop.png`. Source and render appear together, not as unrelated screenshots.
- Responsive evidence: `responsive-contact.png` and individual captures for 320, 360, 390, 480, 599, 600, 613, 767, 768, 1024 and 1440px. Mobile cards at 320/390 are 292 × 172 and 354 × 172 respectively.
- Long-title evidence: `long-320.png`; full overview captures: `overview-390.png`, `overview-1440.png`. Final actual in-app capture: `final-iab.jpg`.
- Local preview remains available at `http://127.0.0.1:18089/Travel?page=overview&trip=trip-header-suncheon`.

## Findings, fixes and comparison history

1. **P1, fixed — empty mobile image area.** The old 104px image slot with contained artwork left a large empty rectangle below the image. `../trip-header-20261004/header-390.png` and `../trip-header-20261004/header-320.png` reproduce it. The art now occupies the full right-side slot to the card bottom. Information stays in the left column at every width.
2. **P2, fixed — illustration style drift.** The existing Suncheon painting differed from the original's crisp outlined illustration. Two new Suncheon raster assets use only the original user reference: a landscape painting and a portrait composition. Raw source, exact prompts, reference role and matched SHA256 hashes are in `assets-original/`; optimized immutable files are under `src/assets/trip-scenes/cities/v2/`.
3. **P2, fixed — hard crop edge.** Cropping the wide painting into a phone slot removed its organic left boundary (`before-portrait-header-390.png`). A dedicated portrait source now keeps the sky, hills, river, boardwalk and bird readable on narrow displays. Desktop uses the full landscape silhouette aligned to the right and bottom; `header-768.png` verifies the intermediate desktop case.
4. **P2, fixed — loose spacing and dangling dividers.** The first implementation was 188px high and its member divider extended through the whole touch target. The final mobile card is about 172px high with an 18px visual divider and a 44px member target. At 600–767px, dates take their own row so duration and member controls remain grouped. Final comparison and contact sheet show the corrected spacing.
5. **P2, fixed — failed responsive image after an offline resize.** In the isolated browser, switching from a cached mobile painting to an uncached desktop candidate could leave a completed image with zero natural width and no new error event. The selected candidate is decoded on media change; guarded fallback ignores obsolete images/trip renders. The cache regression now exercises this exact sequence, followed by online recovery.
6. **P3, accepted — runtime controls versus generated art.** Existing Phosphor line icons stay monochrome rather than the mock's tinted icons. The actual Pretendard font, meaningful live hit areas and conservative two-line title limit take precedence over literal raster dimensions. No actionable P0/P1/P2 finding remains.

## Required fidelity surfaces

- **Fonts and typography:** Actually loaded bundled Pretendard (`TripLOG Collaboration`) is verified, with 850-weight titles, compact pink countdown, readable 13px mobile metadata and preserved full title in the accessible label/tooltip. Source/render Korean letterforms, line spacing and wrapping were inspected at enlarged scale.
- **Spacing and layout:** Left information/right artwork on both surfaces; no horizontal overflow, text/art intersection or empty band below the right slot. Both breakpoint pairs (599/600 and 767/768), intermediate 613px, small 320px and two-line long names were inspected. Member and trip-selector controls retain usable hit targets.
- **Colors and tokens:** Existing white, ink `#0b1020`, pink `#f7afc7`, muted gray and pale illustrated blue/yellow/green. No photo banner or alternate theme was introduced.
- **Image quality:** Real generated transparent raster art, not CSS/SVG substitutes. Landscape 800 × 480 WebP (106,394 bytes), portrait 480 × 600 (86,500 bytes). The narrow composition preserves the organic edge; the landscape is contained against right/bottom so its outline is not cut off. Only Suncheon's illustration assets were revised; the destination catalog and other city paintings remain available.
- **Copy and content:** All runtime title/date/duration/member fields still come from the selected trip. No mock data was added to production. Existing trip selector and member entry points remain live.

## Verification

The flow under test is: overview → responsive postcard → trip selector/member controls → trip change/reload → missing artwork or offline width change → visible fallback with preserved trip data.

- Browser plugin not available; the repository's existing isolated Playwright/Edge checks cover precise viewports. The Codex in-app browser independently verifies actual rendering, trip-selector open/close, member modal and console health.
- `npm test`: passed the configured core, database/sync, persistence, model, map, order, country/destination and receipt checks.
- `trip-header-browser-regression.js`: passed all eleven widths, loaded font, correct selected image source, left/right separation and art bottom alignment, real trip selector, keyboard/focus return, member modal, trip switch/reload preservation, long/unknown/escaped/same-day states and both mobile-image/desktop-image failure fallbacks.
- `trip-scene-cache-browser-regression.js`: passed selected-mobile-only download, first-visible-source warming, offline mobile reload, uncached desktop fallback during resize, online recovery, unrelated city fallback, HTML/API exclusion, 48-entry cache bound and app-shell retention. No uncaught runtime errors.
- Existing `trip-chooser-browser-regression.js` and `reservation-pockets-browser-regression.js`: passed.
- `npm run build`: passed. Generated `Travel.html`/worker fingerprints reviewed; optional city images remain outside required shell precaching.
- In-app preview: correct title/route, meaningful content, no error overlay, trip-selector and member-modal interaction, final screenshot and zero error logs. The isolated fixture intentionally cannot create real invitation links and can show connection/rate warnings because production services are blocked.

## Limits and completion checks

- Physical iOS/Android devices and Safari were not available; verification used responsive Edge/Chromium and the in-app browser.
- The layout correction applies to all destination scenes. Only Suncheon received newly drawn landscape/portrait assets in this correction.
- [x] Preserve the requested original style and both left/right layouts.
- [x] Compare source and actual render together at matching component widths.
- [x] Check illustration edges, blank areas, crop and typography, not only DOM overlap.
- [x] Exercise controls and failed/offline responsive image behavior.
- [x] Pass relevant tests/build and preserve user trip records.
- Visual QA and Git push do not by themselves confirm hosting. Production verification is performed after the Git-based automatic deployment.
