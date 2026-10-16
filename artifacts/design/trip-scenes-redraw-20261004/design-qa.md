# Destination artwork redraw — 2026-10-04

final result: passed

## Scope and visual authority

- User request: redraw domestic and overseas destination artwork in the current approved Suncheon style.
- The canonical Suncheon landscape and portrait are preserved. The completed batch contains 58 images for the other 29 dedicated destinations, plus 20 images for ten common themes. The catalog uses 40 scene pairs: 30 dedicated destinations and ten themes, covering the existing 80 destination definitions. The 78 new WebPs total 6,261,276 bytes; raw originals are retained outside the deployed build.
- Exact visual references: `../trip-header-mobile-20261004/assets-original/kr-suncheon.png` and `kr-suncheon-mobile.png`. Every generated image uses only the matching fixed canonical reference; no generated city is used as a subsequent style reference.
- The user's latest title correction and both-surface left-information/right-art requirement remain authoritative. Typography and component geometry stay unchanged; the image fitting rule is corrected to preserve complete drawings at wide phone aspect ratios.
- `jobs/` stores exact generation briefs; `assets-original/` stores the original PNG, English prompt and provenance for each image. `prepared.json` records source/output hashes, transparent-edge trims, web dimensions and file sizes. Generation is once per asset with the built-in image tool. No prior asset is overwritten.

## Comparison evidence and normalization

- Approved component reference: `../trip-header-mobile-20261004/title-reduced-390.png` and `title-reduced-1440.png`, representing the current Suncheon header after the user's title-size correction.
- `comparison-canonical-390.png` and `comparison-canonical-1440.png` place that approved component beside real Seoul, Busan, Osaka and Paris headers at the same component width. Different trip names and destination subjects are intentional; dates, countdown, duration and member count match.
- Mobile viewport: 390 × 844 CSS px, device scale 1, header 354 × 172 px. Desktop viewport: 1440 × 1000 CSS px, device scale 1, header 912 × 232 px. These captures are already at CSS-pixel density; no density normalization is necessary. Contact sheets downscale only for overview inspection.
- `rendered-korea-390.png`, `rendered-world-390.png`, `rendered-korea-1440.png` and `rendered-world-1440.png` show all 30 dedicated destinations inside the actual component. Individual representative screenshots preserve full size for focused text/edge inspection.
- `contact-korea-*.png`, `contact-world-*.png` and `contact-themes-*.png` document the prepared web assets. The canonical Suncheon appears in the domestic sheet as the unchanged style reference.
- `in-app-osaka-final.jpg` is the final independent in-app browser capture after using the real local trip selector. `in-app-theme-mountain.jpg` verifies the common mountain portrait after switching to the Interlaken fixture. The preview uses isolated fixture data and cannot send changes to production services.

## Findings and comparison history

1. **P2, resolved — only Suncheon used the approved style and portrait composition.** The other dedicated destinations still selected the previous landscape-only assets. All 30 dedicated entries now use immutable v2 landscape/portrait pairs. Actual header contact sheets confirm consistent text placement, artwork scale and right/bottom connection.
2. **P2, resolved — common theme coverage.** All 20 theme assets are complete. Remaining catalog destinations and unknown/regional matches now select the new theme pairs, including the unknown destination's mobile source. The real theme switch, missing-image and offline checks pass.
3. **P2, resolved — wide-phone foreground crop.** The first 599px contact sheets showed that `cover` with top alignment cropped the lower portion of portrait drawings, hiding Osaka's canal and parts of other scenes. Evidence is retained in `before-fit-korea-599.png` and `before-fit-world-599.png`. All images now use `contain` with right/bottom alignment, including missing-image fallbacks. Full foregrounds remain visible and no empty band appears below the art. The city regression explicitly guards this fitting rule. Original illustrations are not regenerated based on this implementation review.

## Required fidelity surfaces

- **Fonts and typography:** Existing bundled Pretendard (`TripLOG Collaboration`), title weight 850, mobile 20–24px and desktop 24–40px remain unchanged. The five-component comparisons check Korean letterforms, spacing, title hierarchy and metadata legibility. Two-line title truncation and accessible full names remain intact.
- **Spacing and layout:** Both mobile and desktop keep text left and art right. 320/390/599/1440px city matrices check horizontal overflow, title/art separation and bottom-edge alignment. The existing header suite covers both sides of the 600/768px breakpoints and long names.
- **Colors and tokens:** Existing white card, ink `#0b1020`, pink `#f7afc7` countdown and muted controls are unchanged. The fixed Suncheon references carry the common illustrated palette and outlined drawing style.
- **Images:** Real transparent generated raster assets, separately composed for landscape and portrait. Web delivery uses 800 × 480 / 480 × 600 WebP. No CSS/SVG artwork substitutes or placeholder graphics. Exact original hashes prevent mixing concurrent generation results. Geometry checks and full-size visual comparisons verify readable subjects, crisp edges and no empty band below the image.
- **Copy and content:** Trip names, dates, durations and members still come from the selected trip. Destination matching, aliases and parent-region rules are unchanged. No mock values are written to real trips.

## Verification status

The flow under test is: overview → destination illustration for the current viewport → trip selector/member controls → another city or common theme → reload/offline or failed image → readable header with preserved trip data.

- Browser plugin unavailable; the repository's existing isolated Playwright/Edge tests provide precise responsive coverage. The in-app browser independently checks the real preview and trip-selector interaction.
- Passed: `npm test`, including database/sync, persistence, model, maps, itinerary order, country/destination and receipt regressions. The destination suite validates all 80 active image files, mobile variants, aliases and non-mutating selection.
- Passed after the fitting correction: `node scripts/trip-scene-art-browser-regression.js`, 30 cities × 320/390/599/1440px = 120 render combinations; correct responsive source, decoded transparent image, full-image fit, preserved trip data and zero uncaught runtime errors. Metrics are in `browser-city-results.json`.
- Passed: `node scripts/trip-header-browser-regression.js`, eleven widths (320/360/390/480/599/600/613/767/768/1024/1440), loaded primary font, live trip selector, keyboard/focus return, member dialog, region/theme selection, reload and user-data preservation. Long/unknown/escaped/same-day states and both failed portrait/landscape fallbacks pass.
- Passed: `node scripts/trip-scene-cache-browser-regression.js`, selected-image-only download, offline reload, uncached desktop/city fallback, online recovery, HTML/API response exclusion, 48-file bound and retained app shell. All 20 active theme variants are precached; legacy theme files remain for compatibility. No city illustration is required for shell installation.
- Passed: `npm run build`; generated `Travel.html` and `sw.js` fingerprints reviewed.
- Passed: in-app preview reload → trip chooser → Osaka → Interlaken/common mountain → Osaka; new v2 portraits visible, meaningful app content and no error overlay; error log empty. Fixture connection warnings are expected because production network calls are blocked.
- Hosting verification is performed after the Git-based automatic deployment. Push success alone is not a deployment assertion.

## Completion gate

No actionable P0/P1/P2 finding remains. Physical Safari/iOS/Android testing is not available; responsive testing uses Edge/Chromium and the in-app browser. The illustrated scenes are editorial representations rather than geographic maps. A wide phone intentionally shows more white space to the left of a complete portrait, preserving its foreground instead of cropping it.

- [x] Preserve the approved Suncheon pair and compact typography.
- [x] Generate, connect and compare all 29 remaining dedicated city pairs.
- [x] Verify all 30 cities at four viewport widths.
- [x] Complete and connect all ten theme pairs.
- [x] Pass core, header, fallback/cache checks and build.
- [x] Verify the Git-based automatic deployment separately from push success.

## Production verification

Runtime commit `b7599a7b786488d4706a822ad14e205978f0e9d2` was pushed to `origin/main`. At 2026-10-04 04:50:20 UTC, all 80 active public WebPs matched the prepared local files byte for byte, and the catalog, resolver, stylesheet, HTML and service worker matched after normalizing line endings and generated build IDs: 85 files, zero mismatches. Public build `7206fde3127fa4e46cae` is recorded in `production-verification.json`.

The existing in-app production tab updated automatically to that build with a loaded illustration, no open dialogs and zero error logs. No production trip data was edited. The later documentation commit only records this verification; it does not alter the deployed runtime files.
