# Bag capacity and bulk-sale QA

Final isolated UI run: **21 grouped checks passed, 0 failures, 0 browser errors** at 1366×768, 1920×1080 and 390×844. All confirmed blocking/layout findings below were corrected by the parent before the final captures. QA changed only the new harness and this evidence directory; production code and regression tests belong to the parent/capacity agent. Art approval belongs to the Art Director.

Post-merge refresh on `caa85f8` includes painted-item-icons PR #84. No new findings. The fixture now loads the real `icon-theme.css` and uses a painted `dusk_fort_sword` at slot 499. Its 256px WebP loads successfully, uses `object-fit: contain`, and stays inside the 40×40 sale image box within the 44×44 holder at all three viewport sizes. All 18 screenshots were refreshed with the merged artwork and styles. This refresh changed only the QA harness/evidence; no production logic changed.

```text
Severity: blocker (resolved)
Environment: branch codex/bag-500-bulk-sell; Node 24.16.0, Vite 8.3.2, headless Edge fixture
Steps to Reproduce: Run npm run build or load the real ShopPanel module during the initial shared-edit state.
Expected: SaleBasket parses and the shop can load.
Actual: Duplicate isItemLocked imports caused SyntaxError: Identifier 'isItemLocked' has already been declared.
Evidence: Initial build failed after 323 transformed modules; initial focused suite passed 60, failed 1 (shop-bulk module load). Final build and focused suite pass after parent removed the duplicate.
Suspected Area: src/shop/SaleBasket.js:1, parent
```

```text
Severity: major (resolved)
Environment: isolated real ShopPanel fixture, headless Edge, 1366×768
Steps to Reproduce: Open Sell with 500 occupied slots; select all and scroll both lists to the end.
Expected: Shop window, proceeds, clear and review/confirm remain inside the viewport.
Actual: The inherited top:132px plus 688px height put the window bottom at 820px, 52px below the viewport.
Evidence: Browser bounds assertion failed. Final shop bounds are x=133, y=32, width=1100, height=688; bottom=720. Final sale-500-1366x768.png and verification.json record reachable controls.
Suspected Area: src/ui/shop.css desktop anchor, inherited src/ui/layout.css:335, parent
```

```text
Severity: minor (resolved)
Environment: isolated real ShopPanel fixture, headless Edge, desktop and mobile
Steps to Reproduce: Scroll the sale inventory under the sticky selection header.
Expected: Header text is unobstructed by inventory rows underneath.
Actual: Translucent theme background allowed row labels to bleed through the header.
Evidence: Earlier desktop capture visibly showed underlying text; final captures show a clean header. Final computed background is rgb(21, 40, 32).
Suspected Area: src/ui/shop.css .sh-sale-tools, parent
```

```text
Severity: minor (resolved)
Environment: isolated real ShopPanel fixture, headless Edge, desktop and mobile
Steps to Reproduce: Inspect sale rows with item artwork beside the item name.
Expected: Artwork fits its holder and does not cover text.
Actual: Earlier desktop capture showed artwork extending toward the item text.
Evidence: Parent constrained sale icons. Final measured image is 40×40 inside a 44×44 holder at all three viewports; text starts 10px beyond the holder. See sale icon entries in verification.json and final screenshots.
Suspected Area: src/ui/shop.css .sh-sale-row .sh-ic .icon-img, parent
```

## Checks actually run

- The harness imports the real Character, CharacterUI, InventoryWorkspace, ShopPanel and SaleBasket plus the real HUD styles. Only `sellBatch`, `save`, feed and notifications are stubbed. It opens no account, server session or WebGL canvas.
- A mixed 500-occupied fixture renders exactly 500 bag buttons and reports 500/500. Slot 499 is a painted +10 dusk-fort sword with two cards and four high-tier random-affix fields; selecting it preserves inventory and exposes explicit actions. Its equip action is correctly disabled for the level-1 fixture. Desktop grid and detail have independent scrolling, with search and occupancy visible at the last row.
- A sparse 500-capacity bag contains four items at indexes 0, 25, 250 and 499. It renders 32 total buttons (4 occupied, 28 decorative empty), retains those original indexes and renders zero empty buttons under search. Sparse screenshots show the actual panel proportions.
- Category `use` plus search `ยาหม้อเล็ก` selects only current unlocked matching rows, including indexes above 24. Locked matches remain disabled and unselected. Clear empties the basket and disables submission. Selecting all without filters produces 486 selected rows, excluding the 14 locked cells.
- The last sale row and last basket quantity input are reachable; totals, resulting gold, clear and submit stay inside every tested viewport. Special gear has a visible warning.
- First submission reviews without calling the sale stub. Second submission calls it exactly once with the reviewed original-index lines, calls the save stub once, and clears the basket. Locking a selected instance invalidates its basket line and disables submission.
- Mobile uses a touch-enabled context and taps slot 499. Long details/actions and the last grid row can be reached by scrolling. Browser nearest-scroll does not account for the sticky header; the harness uses real scroll input to expose the row below it and then asserts its center receives pointer hits. This extra mobile scrolling remains a usability limitation, not an unreachable-item blocker.
- Every run uses one headless Edge browser, one reused page, a dedicated Vite server with HMR/file watching disabled, and `finally` closes browser/server. The fixture replaces only Vite's dev-client websocket with the CSS style insertion functions needed by CSS modules; application errors remain recorded.
- Read `AGENTS.md`, `docs/GAME_VISION.md`, `docs/technical/VERIFY.md`, `docs/art/ART_BIBLE.md`, the previous large-bag, shop and dynamic-HUD reviews; reviewed current diff and recent git log. `git diff --check` passed.

## Exact command results

- Earlier `npm test`: exit **0**; **1001 tests, 999 pass, 0 fail, 2 skipped, 0 cancelled, 0 todo**, duration **48585.7016ms**. The two skips are pre-existing optional NPC packing/candidate checks requiring model helper dependencies. This full run preceded the final CSS-only anchor/proportion/icon/header adjustments and PR #84 merge; per parent instruction it was not repeated. These counts are historical, not a full-suite verification of the merged head.
- `node --test tests/bag.test.js tests/inventory-workspace.test.js tests/inventory-capacity.test.js tests/inventory-capacity.integration.test.js tests/shop-bulk.test.js tests/shop-online.integration.test.js tests/gridpath.test.js tests/maps.test.js tests/world.test.js`: exit **0**; **68 tests, 68 pass, 0 fail, 0 skipped, 0 cancelled, 0 todo**, duration **532.9974ms**. Includes collision/pathing data and authenticated local WS sale/reconnect tests.
- Post-merge `node --test tests/painted-item-icons.test.js`: exit **0**; **3 tests, 3 pass, 0 fail, 0 skipped, 0 cancelled, 0 todo**, duration **130.2919ms**. Covers definition preservation, approved export hashes and opt-in painted markup.
- Final post-merge `npm run build`: exit **0**, **built in 573ms**. Main JS **2328.34 kB** (gzip **708.78 kB**); CSS **313.34 kB** (gzip **64.04 kB**). Vite's existing advisory about chunks over 500 kB remains.
- Final `node tools/bag-bulk-sale-qa.mjs`: exit **0**, **21 passed, 0 failed, 0 browser errors**. Detailed rectangles, image bounds, checks and screenshot paths are in [verification.json](verification.json).
- Raw command output is retained locally in ignored `artifacts/bag-bulk-sale-qa/`, excluded from PR deliverables.

## Screenshots

All 18 files listed in `verification.json` were captured from the fixture: for each tested viewport, occupied bag top, last row, detail actions, sparse bag, dense sale and filtered sale. Representative PC captures:

- [1366×768 bag top](bag-500-1366x768-top.png), [last row](bag-500-1366x768-last.png), [actions](bag-500-1366x768-actions.png), [sparse bag](bag-sparse-1366x768.png), [dense sale](sale-500-1366x768.png), [filtered sale](sale-filtered-1366x768.png)
- [1920×1080 bag top](bag-500-1920x1080-top.png), [last row](bag-500-1920x1080-last.png), [actions](bag-500-1920x1080-actions.png), [sparse bag](bag-sparse-1920x1080.png), [dense sale](sale-500-1920x1080.png), [filtered sale](sale-filtered-1920x1080.png)
- [390×844 bag last row](bag-500-390x844-last.png), [actions](bag-500-390x844-actions.png), [sparse bag](bag-sparse-390x844.png), [dense sale](sale-500-390x844.png), [filtered sale](sale-filtered-390x844.png), [bag top](bag-500-390x844-top.png)

## Limits

No browser verification of login → character selection/creation → city, movement, combat or training dummy: this task expressly uses lightweight isolated UI fixtures. Collision/pathing tests ran; no interactive world traversal ran. Browser sales use a safe stub; the focused local WS tests verify actual sale persistence separately. No production account, PostgreSQL deployment, physical phone, device FPS, memory profile or live multi-player load was tested. DOM-node counts verify sparse rendering discipline, not a frame-time benchmark. Visual style/proportion approval remains with the Art Director; QA checks reachability, overlap and bounds.
