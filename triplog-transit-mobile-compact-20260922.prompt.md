# TripLOG compact mobile journey concept

- Date: 2026-09-22
- Generation: built-in Image Gen, one successful generation, no existing image overwritten.
- Input: `triplog-transit-journey-20260922.png`, the selected option 2.
- Output: `triplog-transit-mobile-compact-20260922.png`.

## Exact generation prompt

Revise the selected option 2 into a compact mobile UI for TripLOG. Show the route view and the manual-entry view side by side at mobile proportions. Preserve the selected design's identity while substantially reducing font sizes, padding, gaps, row heights, and button sizes so that several travel segments and the bottom actions fit on a mobile screen. Keep transport and duration controls on the same row. Use generic transport names, especially the exact label “기차” instead of “한큐 전철”. Include a compact, usable color picker for each selected transport segment, showing small selectable color swatches. Make the Google map itself 70% of the available content width, using the remaining narrow column for compact map controls. Replace “지도에서 열기” text buttons with a single small external-link icon button. Keep the timeline readable and the total duration and expected arrival compact. Show the map without the “옵션 더보기” label; retain map-provider attribution.

Input images:
- triplog-transit-journey-20260922.png: the user's selected option 2 to revise for compact mobile use.

## Subsequent user instructions take precedence

- Keep Google origin-to-destination directions and transit/walking modes; the provider's “옵션 더보기” link may remain. Do not introduce separate origin/destination place-preview buttons.
- Reduce the then-current map height by 20%: desktop 240 → 192px, mobile 200 → 160px. The complete Google viewport is scaled to fit without cutting off provider controls or attribution.
- Restore the map to the full content width and place the compact map controls inside it.
- Make the origin/destination summary smaller and refine the total/arrival summary. The focused reference is `triplog-transit-summary-refined-20260922.png`.
