# Skill icon rollout audit

Decision: approve the user-approved v2 colored painted-background style for all 65 player-facing learned skills of the five currently ready classes. The set has 50 active kit skills and 15 tree passives. Four approved examples are reusable; 61 additional ImageGen jobs remain. No gameplay/stat changes, new dependencies, VFX, animation, new class unlocks or boss portraits are in scope.

`inventory.json` is the machine-readable production inventory. Every one of the 65 IDs has its current source, Thai display name, effect description, existing icon path, class palette and a specific visual semantic brief. All 65 IDs and briefs are present and unique. Most importantly, historical IDs must not dictate imagery: `arch_poison` means dog bite, `arch_rain` means a pack of hunting dogs, `arch_garuda` means a barking dog, `mage_thunder` means an emerging spectral hand and `mage_storm` means the underworld gateway.

## Exact runtime consumers

- `src/classes/index.js`: constructs all five `CLASS_KITS` and obtains active icon URLs from the five `*IconUrl` helpers in `src/classes/fx/*-skills.js`.
- `src/training/KitCaster.js:33`: copies the kit icon URL into live action bar controller slots. Evolutions change combat data but retain the base kit icon.
- `src/ui/ActionBar.js`: calls `assetIcon(s.icon)` for the live bar. `src/ui/autoSettings.js` does the same for AUTO skill settings.
- `src/character/ui/SkillPanel.js`: `entry()` reads active kit entries or `KIT_PASSIVES`; tree tiles, selected detail and assigned skill slots all call `assetIcon()`.
- `src/character/ui/CreationScreen.js`: ready-class preview buttons call `assetIcon()` for all ten kit skills.
- `src/ui/ActionBar.js`: the shared class/training bar calls `assetIcon()`; the unused standalone bar has been removed.
- `src/character/ui/HotbarEditor.js:38`: **bypasses `assetIcon` with a raw `<img src=s.icon>`**, so a central resolver only inside `assetIcon` would miss this screen. Route it through `assetIcon` or the same resolver.
- `src/combat/data/skills.js` / `CharacterUI.buffsHtml()`: buff badges use `iconHtml()` and therefore `assetIcon()`. Existing `waikru` and `regen` images alias `boxer_waikru` and `heal_zone`; map those existing paths. Other guard/smoke/poison badges are glyph status cues, not separate learned skill artwork.

## Integration advice

A small pure UI icon URL resolver can remap the known old `fx/<class>/icon_<id>.png` URLs to the final 65 painted WebPs without mutating rules tables or skill values. Use an explicit allowlist derived from the 65 inventory IDs. Preserve unmapped URLs exactly, including data URIs, remote hosts, unknown IDs and query/hash suffixes. Respect `import.meta.env.BASE_URL`; passive source paths begin `/fx/` while active helpers already prepend BASE. Normalize only the known local path forms and prepend BASE to the new production path once. Exact path lookup is safer than arbitrary substring matching or changing arbitrary `icon_*.png` assets.

Mapped images should select `.painted-art` in `assetIcon`: this avoids the old four-pixel baked-rim crop and uses smooth 100% contain, which also suits the approved painted-background art. Preserve explicit painted item handling. The new art itself contains no UI frame or overlays, so the existing live frame remains authoritative.

`heal_zone` is a special case: `herbIconUrl('heal_zone')` currently returns a dynamically generated canvas data URI (`zoneIcon()`) rather than the nominal PNG path. Resolve this one at its helper or kit-construction point using its known ID, so tree, hotbar, editor and creation all receive the proper new image. Do not globally reinterpret arbitrary data URIs.

Meaningful checks: exhaustive 65-ID mapping coverage and file existence, every mapped route including non-root BASE and query/hash, unknown/data/remote paths unchanged, painted wrapper selection, special heal-zone URL, raw-editor bypass removed, old gameplay definitions byte-equivalent except presentation metadata. Browser screenshots should show five class trees, five hotbars and the skill chooser on desktop/mobile; inspect locked tiles and 32/48/64 px art readability.

## Deliberate exclusions

The 24 older four-skill combat IDs remain mechanical basic-attack/fallback definitions. For ready classes their temporary legacy controller is replaced by the ten-skill kit. The four assassin skills are reachable only through debug `?classes=all` or legacy saves; assassin has no ready avatar and no ten-skill kit, so adding its artwork now would extend a locked future class. The 16 legacy rules-only passive/hybrid/extra IDs are not members of active trees or kits; hybrid learning is disabled by current passive configuration. Boss combat skills are separate encounter mechanics and have no learned-player icon consumer. Evolution A/B paths share each base skill icon.

## Validation and limitations

Read-only audit verified source definitions, all ready flags, kit memberships, passive tree entries and actual icon call sites. Machine inventory generator passed: 65 unique IDs, 65 nonempty semantic briefs, 50 active, 15 passive, 16 excluded rules IDs, 24 legacy fallback definitions. No runtime source, rules, Git state or game assets were edited. No build was run for this data-only audit; final implementation requires the usual art review, QA and build. Inventory and this report are ignored production-working artifacts, to be vendored into final tracked production docs by the owning integrator if useful.
