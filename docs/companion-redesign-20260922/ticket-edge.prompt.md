# Ticket perforation asset — 2026-09-22

- Mode: built-in Image Gen, one reference-guided generation. No existing image was overwritten.
- Inputs: `triplog-companion-pocket-passport-20260922.png` (selected mockup); `C:/Users/tbdk5/AppData/Local/Temp/codex-clipboard-b6ed1d7c-cb31-4afc-be1d-b816317ffcde.png` (user's current-ticket screenshot).
- Generated source: `C:/Users/tbdk5/.codex/generated_images/01a0c429-1920-7d20-a95f-bb0950d8831b/exec-dff80505-733f-48fd-a206-15a942799340.png`.
- Original output saved by image-creator helper to `triplog-ticket-perforation-20260922.png`, 992×1586 RGBA.
- Consuming asset: `src/assets/companion-ticket-edge.png`, 72×174 RGBA, 7,806 bytes. Extracted one complete generated repeat at `(330,171)-(402,345)`, preserving the original antialiasing and edge shading. No shapes were drawn or reconstructed in code.
- UI: 8px-wide repeating image with a fixed 12px pitch. The ticket can grow without stretching individual perforations. Existing content padding and all ticket interactions remain unchanged.

## Exact generation prompt

Create one standalone, vertically repeatable raster trim for the left edge of the NEXT STOP travel ticket. Match the ticket-edge detail in the selected Pocket Passport mockup, supplied as the first reference. The second reference is the current implementation to correct. Isolate the narrow dark binding behind an ivory paper edge, with closely spaced semicircular tear-off perforations like a real paper ticket. Use the app's dark ink #29313a and warm ivory #fffdf7. Keep the paper on the right and the dark binding on the left. Render a full-bleed upright strip, approximately 128 pixels wide by 1024 pixels tall, with eight evenly spaced scallops; no extra margins, card contents, lettering, UI, or other objects. The top and bottom should join naturally when repeated vertically, and the edge should remain crisp at a 12-pixel display width.
