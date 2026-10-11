# Skill samples v2 QA

No confirmed defects in final v2 preview. Preview only; no runtime game integration.

- Asset validation: 4 unique builtin ImageGen masters. Original source PNG SHA equals preserved master SHA for each; production SHA matches each receipt. Prompt files match recorded prompts. Actual alpha bytes equal 255 throughout original and output (intentional painted backgrounds). Every output is 256 x 256 WebP; combined 99,076 bytes.
- Headless Edge via Playwright: 1100 x 1000 desktop viewport (2 columns), 390 x 844 mobile viewport (1 column), four cards and all 20 images loaded each. No horizontal overflow, JavaScript errors, console errors or HTTP 404. All 16 new image elements decode at natural 256 x 256; four legacy comparisons decode successfully.
- npm test: 1,007 tests; 1,005 pass; 0 fail; 0 cancelled; 2 skipped; 0 todo. Duration 42,652.1714 ms.
- npm run build: passed in 1.18 seconds. Existing warning: main JS minified chunk exceeds 500 kB.

Screenshots: gallery-desktop.png (1100 x 1034), gallery-mobile.png (390 wide full-page).

Changed files: ignored QA verify.mjs, result.json, npm-test.log, npm-build.log, screenshots and this report only. No game or gallery source changed by QA.

Limits: visual style scored separately by art-director. Did not verify gameplay/combat/FX/login/collision or deployment because sample assets are not integrated into the game and user requested preview first. Mobile is an emulated Edge viewport, not a physical phone.
