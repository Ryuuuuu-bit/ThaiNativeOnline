# Accessory slot wording

The equipment panel now labels its two accessory positions **ประดับ 1** and **ประดับ 2**. Full descriptions, accessible slot/lock names and the shop category use **เครื่องประดับ**. This covers rings, takrut, bia-kae and prayer beads without changing the individual item names.

Changed runtime files: `src/character/ui/CharacterUI.js` and `src/ui/ShopPanel.js`, four wording lines only. Saved `charm` / `charm2` keys, equipment rules, items, statistics and refinement remain unchanged.

Validation: full suite 1,007 total, 1,005 passed, zero failed, two skipped. Production build passed 326 modules; the existing main-chunk size warning remains. Actual local Edge equipment views at desktop/mobile, slot and lock ARIA text, item tooltip and the actual ritual merchant's purchase category/description passed with zero page errors. Item names remain unchanged. The initial shop harness checked a subtitle on the sell tab, which does not render group subtitles; verification was corrected to the actual purchase view without runtime changes.

Independent art review: approved, style/readability/Thai identity/technical usability all 9/10; no required changes. Screenshots: [desktop equipment](equipment-desktop.png), [mobile equipment](equipment-mobile.png), [shop category](shop-desktop.png). Raw QA assertions are retained in [report.json](report.json).

Limits: this checks wording and presentation, not a new balance or performance change. Production verification follows deployment; local guest QA does not mutate authenticated player accounts.
