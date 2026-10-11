# Main menu movement and hotbar multiassign — QA

Validated 2026-10-11 on `codex/menu-recall-five-second-cast`, worktree `artifacts/recall-cast-worktree`. This extends the recall task; its separate QA and screenshots remain preserved.

## Findings

No unresolved blocker, major or minor regression found in the changed flow.

Severity: major — resolved (reported hotbar usability bug)
Environment: game ActionBar → จัดช่อง, desktop keyboard/mouse
Steps to Reproduce: Open the hotbar chooser; select an item/skill; attempt to assign the next slot.
Expected: Keep the editor open so several slots can be configured in one visit and save changes.
Actual before fix: Assignment and Clear called `close()`; the editor had to be opened for each slot.
Evidence: final real-browser multiassign → clear → reload checks in `artifacts/menu-hotbar-qa/browser-result.json`; final editor screenshots and `tests/nonmodal-hotbar.test.js` regression.
Suspected Area: `src/character/ui/HotbarEditor.js`, UI engineer. Resolved by rerendering the selected slot without closing and retaining focus.

Severity: major — resolved (reported movement bug)
Environment: main menu/hotbar editor open, focused buttons
Steps to Reproduce: Open a panel so its button receives focus; use WASD/arrows or open the menu while W is held and release W over the control.
Expected: Walk while using these lightweight panels, release movement reliably, retain typing and real-modal guards.
Actual before fix: Panel key containment stopped movement events; the chooser also shared the movement-modal gate.
Evidence: final real-browser W/arrows/ground-pointer movement, held-key release, text/contenteditable, travel/storage modal and action-key guard checks; meaningful InputManager/nonmodal regression tests.
Suspected Area: `src/ui/MainMenu.js`, `src/ui/windowNavigation.js`, `src/core/InputManager.js`, `src/core/Game.js`, UI engineer. Resolved by separating movement from action blocking and selectively allowing movement keys.

## Exact final validation

Source freeze received from the UI engineer after Combat/Training pointer guards and joystick preservation. Vite was restarted after these edits; final full checks began afterward.

- `npm test`: **1,028 tests; 1,026 pass; 0 fail; 0 cancelled; 2 existing skips; 0 todo**, **61,156.7284 ms**. Log: `artifacts/menu-hotbar-qa/npm-test-final.log`.
- `npm run build`: **pass**, Vite 8.3.2, **705 ms**. Existing chunk-size warning remains. Log: `artifacts/menu-hotbar-qa/build-final.log`.
- Reviewed the final input, window-navigation, menu, editor, Game and Combat/Training changes against their claims. The full suite includes gridpath/maps/world and actual HTTP/WebSocket recall/party regressions.

## Browser checks actually run

Fresh headless Microsoft Edge/SwiftShader, isolated Vite `http://127.0.0.1:5332/` and memory game server 8790. Test setup seeds a new Guest character with two ordinary consumables; no production data is touched.

1. Open จัดช่อง, put `potion_s` in slot 2 and a learned skill in slot 3, select slot 4 and Clear. Editor remains open throughout, then explicit Close works.
2. Reload: both assignments and the cleared slot remain saved.
3. With an editor button focused, W and ArrowDown move the actual character 0.42 m and 0.21 m respectively. Editor remains open.
4. Click an unobstructed ground pixel with editor open: actual character moves approximately 0.42 m; panel remains open.
5. With main-menu button focused, W and ArrowUp move 0.21 m and 0.42 m. Actual ground click with menu open also moves approximately 0.42 m, keeping menu open.
6. Hold W, open the menu, release W over its focused control: InputManager's held-key set becomes empty, so movement cannot stick.
7. Focus a text input or contenteditable element and press W: character does not move. These editable elements are harness fixtures used to exercise the real browser typing guard.
8. Press 1/Q/E/R/F from focused editor and menu controls: no outgoing cast/combat/operation packets, no Auto toggle and no flask charge consumption. HP/MP were lowered first so an unguarded flask press could have an effect.
9. Open the real WarpPanel and StoragePanel through their runtime `show` APIs; focus their close buttons and press W: actual character displacement is zero for both. These verify the real modal/input gate, not an authorized stash transfer.
10. Desktop 1600×900 and narrow portrait 390×844/landscape 844×390 layouts remain readable. A separate fresh browser context uses `hasTouch`/`isMobile` and `touch=1`: the editor still blocks joystick input; closing restores it. Main menu still hides touch controls and closing restores them in both orientations.

Final `browser-result.json`: **13 successful behavior checks; no JavaScript/console errors** (favicon request excluded as the already documented unrelated local development asset). Final `touch-result.json`: **3 successful touch-mode checks**. Both files are under `artifacts/menu-hotbar-qa/`.

## Screenshots

Under `docs/art/reviews/menu-hotbar-edit/`:

- `desktop-editor-multiassign.png`
- `desktop-menu-walking.png`
- `desktop-editor-reloaded.png`
- `portrait-editor.png`, `portrait-menu.png`
- `landscape-editor.png`, `landscape-menu.png`
- `touch-portrait-editor.png`, `touch-portrait-menu.png`, `touch-landscape-menu.png`

## Changed files and scope

QA changed only this report and the evidence/screenshots. Implementation ownership is the UI engineer: HotbarEditor, InputManager, Game, MainMenu, windowNavigation/nonmodalKeys, Combat/Training pointer guards and regression tests. See the PR diff for exact source files.

No deployment, account transfer or production character was modified. Tests ran on a seeded Guest; authenticated hotbar browser save/reconnect and physical mobile-device performance were not measured. Actual monster/dummy pointer combat was not rerun manually in the browser; guard wiring was inspected and the full combat regression suite passed. SwiftShader distances demonstrate input behavior and are not a performance benchmark.
