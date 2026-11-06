# Reservation cards — empty-state refinement, 2026-10-04

final result: passed

## Source, state and normalization

- The user requested a new mockup and an implementation based on it after reporting that the empty transport/accommodation cards had lost their visual balance.
- Source visual: `../20261004/triplog-reservation-empty-refined-20261004.png`, generated once from the user's current screenshot and the selected refined passport-pocket direction. Exact prompt, inputs, built-in generation mode and non-overwriting save are recorded in the adjacent root JSON file.
- Source pixels: 1891 × 832. The full source, including its surrounding canvas, is normalized proportionally to 682 × 300. No source lettering or background is edited for comparison.
- Matching implementation: `.rs-reservations`, both categories empty, in a 1440 × 1000 CSS viewport with device scale 1. The component is 682 × 300 CSS pixels; its lossless element PNG is 682 × 301 because the fractional clip includes one boundary pixel.
- Final source and implementation appear together in `comparison-final.png`. `comparison-final-text.png` enlarges corresponding left-card regions for typography, count badge, divider, description and button inspection. The full-view comparison governs size; the focused regions are enlarged to a common panel only for close inspection.
- `empty-desktop.png` is the final browser rendering. The isolated local preview uses synthetic records and blocks external requests; it never seeds production data.

## Comparison history

1. **P2 resolved — fragmented empty layout.** The reported implementation used a separate header and lower text area, a count tab floating over the pocket edge, and a small underlined action. The new source requires a continuous cream insert, an aligned header count, and a substantial yellow action. Four independently generated raster surfaces supply the two pocket backgrounds, count badge and action button; all functional text remains HTML.
2. **P2 resolved — interior padding and title scale.** `comparison-first.png` showed content too close to the paper edges. Horizontal inset now scales with the card width. The intermediate 18 px title was subsequently refined in finding 5. The 320 px layout adjusts its heading to 17 px and body title to 15 px.
3. **P2 resolved — action too close to the cream paper edge.** `comparison-second.png` records the intermediate layout. The final 300 px empty card uses a tighter but readable 18 px description line height, 4 px description gap and 8 px action gap. Both actions keep the same vertical offset and a visible clearance above the pocket seam. The final full and focused comparisons verify this correction.
4. **P2 resolved — populated content touching the pocket edge.** Reusing the new background exposed insufficient clearance for the last flight row and stay dates. Populated cards now reserve a proportional lower row for the illustration, allowing the cream region to grow with the actual content. An explicit full-width grid column prevents intrinsic column shrinkage. `pockets-1440.png` shows the final schedule and accommodation rows fully inside the paper, and the regression verifies both full-width content and paper-edge clearance.
5. **P2 resolved after user review — heading too high and visually condensed.** `header-reported.png` records the user's report; `comparison-before-header.png` is the prior layout. The category label now sits 4 px lower relative to its count badge. The loaded Pretendard heading changes from 18 px/800/−0.5 px tracking to 19.5 px/750/−0.2 px, widening the two Korean headings from 63.77 to 70.85 CSS px and matching the source's less condensed proportions. This is a measured typographic adjustment to the existing font, not a claim that Image Gen disclosed an exact font family. Both empty and populated cards share this rule. The in-app browser read back the new computed styles; final comparisons and the responsive regression were refreshed.

## Required fidelity surfaces

- **Fonts and typography:** live Korean text uses the local `TripLOG Collaboration` registration of Pretendard Variable; the regression checks that the computed primary face is loaded. The category heading uses 19.5 px/750/−0.2 px tracking with a 4 px optical downward offset; the count remains 18 px/800 and supporting copy is 13 px/450. The two-line empty descriptions use deliberate line breaks; hotel names retain balanced wrapping and dates use lighter text.
- **Spacing and layout:** equal desktop cards, one category heading per card, header count in normal flex layout, matching dividers and aligned empty actions. Counts do not depend on artwork coordinates. The empty card retains an explicit flex column to avoid native button vertical centering. Populated cards keep their proportional artwork reserve. Small screens stack the cards.
- **Color and imagery:** cream paper, blue/pink pockets, yellow surfaces and dark ink follow the source. Full PNG originals and exact prompts are in `assets-original/`. The two 1358/1356 px background sources are encoded as WebP quality 90 at unchanged dimensions for delivery; the original PNGs remain untouched. Yellow surfaces are transparent, lossless WebP derivatives. Deployed new artwork totals 798,606 bytes. Existing Phosphor icons provide the plane, bed, building and chevrons.
- **Copy and content:** the source's six strings per card are implemented verbatim. Headings/counts are not repeated in body copy. Real booking totals, dates, routes, nights and grouping behavior remain derived from the existing model. An empty card opens the correctly selected reservation form directly; a populated card still opens its filtered wallet.
- **Image quality:** assets render with transparent surroundings and adequate native resolution. There are no missing images, screenshot-as-interface replacements or CSS-drawn illustrations. Standard icon silhouettes, stitch shapes and raster lettering versus live font antialiasing remain minor P3 differences.

## Behavior and verification

- `npm test` passed.
- `tests/reservation-pockets-browser-regression.js` passed at 320, 390, 480, 600, 768 and 1440 px. Checks cover real font and image loading, total/group counts, grouping guards, full-width content, text/edge clearance, long and escaped names, one-way and generic transport, extra records, empty header/count separation and matched empty-action positions.
- The empty-card flow opens the correct type directly, cancels without changing saved state, returns keyboard focus, saves transport and accommodation records, replaces each empty card and survives reload. These persistence checks use a separate untouched empty fixture after the deliberately malformed rendering fixtures, so rendering-only mutations cannot contaminate save validation.
- Existing wallet/passbook and reservation expense editor browser regressions passed. The original source reservations survive navigation and reload.
- The in-app browser verified page identity, nonblank content, actual artwork, direct transport-form entry and local save. Application error logs are empty. Exchange-rate warnings and connection retries are expected because the synthetic preview intentionally blocks external services.
- Responsive screenshots include `empty-320.png`, `overview-320.png`, `overview-390.png`, `pockets-600.png` and `pockets-768.png`. Full-page mobile captures include the fixed app navigation. Mobile dimensions come from the repository's Chromium/Edge regression; the in-app browser is verified at its actual desktop viewport. Its viewport helper targeted a different tab, so the temporary override was reset and not counted as mobile evidence.
- `npm run build` passed. Public deployment verification is recorded separately when completed; Git push is not treated as deployment evidence by itself.

## Remaining limitations

- P3: generated badge/button stitching and the background illustrations are faithful to the direction but not pixel-identical to the source. No further image regeneration was performed.
- Only Chromium/Edge and the in-app browser were available. No physical iOS/Android or Safari check was performed.
- The final comparison has no remaining actionable P0/P1/P2 mismatch.
