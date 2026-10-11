# Committed branch consolidation — 2026-10-11

The user authorized integrating every committed branch into main and removing
other branch refs afterward. Integration was performed on
`codex/integrate-all-branches`, based on main `5023e31`; no other checkout or
uncommitted work was edited. The snapshot contains 105 local/remote refs and
58 distinct tips. All snapshot tips are ancestors of the integrated result;
40 previously nonancestor tips were admitted through ordinary Git merges,
including nested original merge history. No squash or blanket ours merge was used.

## Newly admitted behavior

- Class status authority from `cb67c74`: live and expired buffs, cleansing,
  revival protection, tether healing, bounded speed effects, authoritative
  combat-state snapshots and party recipient validation. The newer strongest
  positive defense policy remains; finite negative modifiers combine separately
  and flat defense follows proportional defense. Generic DOT cleansing retains
  the earlier contract. Tether healing pauses during inventory transactions.
- Authored outgoing player tuning from `01f6315`: shared `PLAYER_DAMAGE_MULT=1.2`
  after armor and critical scaling, once per player/pet/skill hit. Monster attacks
  opt out. Derived stats and healing are unchanged. Preview endpoints use that
  same factor; self/party buff duration previews use actual cooldown reduction.
  Integer rounding means an individual hit need not be exactly 20% larger.
- The same branch's regional loot recipe expands independent legacy equipment
  rows, alongside the current full-slot affix pool and separate boss flask roll.
  It does not replace those later systems or repeat their rewards.
- Card collection and socket abilities from `1c5a949`: historical discoveries,
  authoritative migration/sync, searchable journal and guide, 24 ordinary
  expedition bonus profiles, and 13 authored boss/guardian abilities. Current
  data has 67 definitions, 65 active hunting sources, 15 boss-filter entries and
  31 admitted illustration/icon pairs (62 WebPs). Later ghost-sister definitions
  keep their approved bonuses/icons; no invented special proc is added.
- Newcomer journey from `cccf019`/`1057ae5`: actionable early quests, journal
  progression and guide links using current map/menu/loading gates. Menu audit
  receipts and branch-specific review tools remain as historical evidence.

## Existing releases preserved

Many original branches were already shipped as combined/squashed main releases.
Their ancestry was retained while later approved behavior won conflicts:

| Original feature | Equivalent main release or later replacement |
| --- | --- |
| Skill paths / choice clarity | `677bab8`, `f9efb1e`; current canonical hit schedules, cast budgets and variant locks |
| Class cooperation | `c65073e`; strongest defense, bounded synergy and per-source status identity |
| HUD workspace/reset/boss notices | `03c1834`, `a5c1256`; unified current theme, readable labels/profile badge |
| Location music | `a4b86ee`; subsequent forgotten-city names |
| Menu navigation | `ba4f791`; persistent hotbar editing and nonmodal movement `ff4bd01` |
| Durable trades/object lifecycle | `0897168`; current critical readiness/two-phase map commit `7318c8d` |
| Walking/forest progression | `1585793`, then shared all-map `76141f3`; refreshed collision `cf3aef6` |
| Private GM/admin, UID, composer | `11f9c33`, `0b6e583`, `f41e0c2`; authenticated transient GM titles `bd419ec` |
| Chat drawer/whisper/scrolling | `0ac7021`, `cc572b3`, `0a5adf6`; current system-only private GM handling |
| Ranking | `b465f78`; actual earned titles, scores and holder checks unchanged |
| Affix loot / equipment / flasks | `eb8ddc9`, `47924a9`; owned instance metadata, Q/E flasks, R AUTO and F interaction |
| Bag capacity / equipment layout / city identity | `13432d2`, `31a0444`, `01d3065`; local-only merge tips also retained |
| Painted item / skill assets | `b494f4c`, `c721d6b`, `303e695`; production registry/assets preserved |
| Whole-screen flicker | `6c2d5f2`; later stable particle rendering `37a8801` |
| Stat persistence / minimap clock | `0beec5a`; old `d3cd78f` right-aligned/touch-hidden clock superseded |
| Recall | `9e18267`; five-second cancellation/revalidation retained |

The approved lean-runtime prune `8210f01` remains. Item/skill samples and preview
pages stay in `docs/art`; merges did not republish old copies under `public`.
The obsolete forest-only dry-ground exception was removed in favor of the shared
water topology. No production monster models or current painted icons were removed.

## Conflict evidence and validation

Ignored local audit files under `artifacts/branch-consolidation/` retain the
snapshot, main/patch history, 440 per-hunk decisions in class/card/newcomer/
equivalence ledgers, and explicit file-level restoration/prune overrides.
`final-proof.json` records the exact result SHA and ancestor result for every ref;
`final-audit.mjs` regenerates it. Ancestry alone is not feature equivalence:
source conflicts were compared to the actual main release and later replacement.

Source freeze is `1e0096c`. Its build passes: 349 modules, 564 ms, with the existing
large-chunk warning. QA's full suite at the initial freeze reports 1,256 tests:
1,254 pass, zero failures, two existing opt-in skips. Subsequent generic-DOT
compatibility checks pass 25/25; damage/critical endpoints and cooldown-reduced
buff preview checks pass 2/2. These later corrections add two meaningful tests.
Final browser/Art screenshots and the final test receipt are attached separately
by QA; old branch receipts are explicitly historical, not fresh validation.

Live PostgreSQL migrations, physical-phone performance and long-term economy
balance are not established by local checks. New card history cannot reconstruct
cards sold before tracking. Pop and tiger remain catalog entries without active
spawns. Branch deletion and final main promotion occur only after root review/PR.
