# Minimap clock

Moved the existing world clock and day/night indicator from the central location heading to a separate row beneath the minimap's safety/coordinate footer. The original IDs and HUD update path remain intact. The row uses the existing theme, a subtle divider and tabular time digits. ResizeObserver already positions travel controls beneath the minimap, so they follow its new height.

Changed files: `index.html`, `src/ui/layout.css`, `tools/minimap-clock-qa.mjs`, and this evidence directory.

Validation: `npm run build` passed (existing large bundle warning). Isolated headless Edge checks passed for modern 1366×768 and classic 1920×1080 with HUD 1.3: one clock, none in the location heading, clock within minimap bounds, separated from safety and coordinates, night/morning phase updates, and no page errors. Browser closed after completion. Screenshots and measured bounds are saved here.

Limitations: touch keeps its existing compact layout with time hidden. Actual online clock synchronization is unchanged and was not retested; browser fixture uses local world time. Not deployed yet.
