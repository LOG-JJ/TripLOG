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

## Production verification

- Commit `8beac335b5f665e2139cd006c36474b72611326a` is present on `origin/main`. The deployed `/Travel?page=overview` entry automatically resolves to `/Travel?page=start` and renders the passport collection before selecting a trip.
- The public `app.js`, home module, home stylesheet and blue passport asset match the local files. Public `Travel.html` and `sw.js` match after normalizing line endings and the generated build fingerprint; the production fingerprint is `f0476ebe6c19a1156613`.
- In the production in-app browser, the upcoming filter displayed its empty state and returning to all trips restored the collection. No warning/error console entries were recorded. This check did not create or edit trip records.
