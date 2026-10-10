# Skill paths and computed descriptions

The five ready class kits expose A/B choices for all 50 active and 15 tree passive
skills. Paths unlock at skill level 5. Existing skills remain on their original
rules until a choice is made; old A/B saves retain their choices. Experimental
assassin and legacy rules-only skills are outside the playable kit coverage.

`Character.evo` remains the saved choice map. Passive IDs are now accepted and
resolved through `passiveBonusAt` / `kitPassiveBonus(skills, evo)`. Switching
clamps HP/SP to their resulting maximum without restoring either resource.

First selection is free. A later change costs current Job Lv × 10 **ตำลึง**.
`evolutionSwitchCost` is shared by the browser and server; selecting the current
path does nothing and charges nothing. The skill window previews each path and
requires an inline confirmation showing the price and remaining balance.

Server `evo` operations require trusted combat context. Recent combat, PvP/trade
busy state, active casts, buffs and outstanding skill effects block changes.
Landed status effects extend `variantEffectsUntil` through their duration.
Cooldown maps are never cleared or shortened by choosing a path. Guest combat
uses the same Character guard with live caster/effect context. Numeric currency
and save/API fields remain `gold`; only displayed units change to ตำลึง. Gold
materials and costume color names retain their ordinary names.

`src/rules/skillPreview.js` supplies pure presentation data from the real
`skillStats`, `castInfo`, `selfEffects`, `supportOf` and `hitEffects` functions.
The panel uses current stats and shows normal/critical ranges, blow counts,
armor coefficients, rounding order, healing, effects, ranges and effective
SP/cooldown/cast costs. Without target defense, damage is explicitly before
armor. Totals assume every blow lands on the same target; target-specific card
bonuses, PvP modifiers, pet damage and extra area targets are not included.
Healing is the caster's potential amount, capped in actual play by missing
HP/SP; percentage party recovery uses each recipient's own maxima.

The reproducible review page mounts the production SkillPanel with its real
styles. `tools/skill-path-capture.mjs` checks three viewports, all 65 rendered
skills, first/free and paid choices, confirmation, passive selection, fight
locks and horizontal overflow. It does not simulate a natural complete build
or real-device touch. Visual skill FX retain each base skill's animation;
functional area changes come from the rules rather than new FX art.

`node tools/skill-path-online-check.mjs` starts an isolated production HTTP/WS
server with MemoryStore and a fixture account. It verified first selection
without payment, a Job 12 switch costing 120 ตำลึง, duplicate and cross-class
rejection, correction of forged API gold/choice saves, and saved balance/choice
on reconnect. Server combat/cast/DoT locking is additionally covered by the
focused runtime tests. This is not a production-database or live deployment test.

Balance requires class/party playtesting: the alternatives provide tradeoffs,
but equal win rates or EXP/hour have not been measured. No production deployment
or save migration is part of this change. Newcomer quests remain in their own PR.

Combat kit damage is scheduled independently of FX geometry. Each cast keeps
its original primary, effective skill id, level and range/area information;
late animation callbacks cannot change its target or path. The shared
`skillHitSchedule` supplies both runtime delivery and preview blow counts.
Focused volleys and repeated waves retain declared counts; wide fans hit their
primary once, the offensive tether has twelve ticks and the alternating bottle
has three enemy bounces. Support-only skills schedule no damaging blows.
The authoritative cast window is at least six seconds and extends to the
last scheduled hit plus 0.75 seconds of network allowance, so the tether's
final tick is accepted without admitting a thirteenth hit.
Visual burn/poison callbacks do not add duplicate direct damage; normalized
rules debuffs own those ticks. This also fixes elevated ghostfire endpoints
and long-range kalp casts failing their old visual-only collision checks.

`node tools/skill-damage-audit.mjs http://127.0.0.1:5199` runs against a local
dev server with an existing Playwright/Edge runtime. The sealed report covers
1,200 actual production FX/Character/Combat/KitCaster cases: all 50 actives,
base/A/B, close/maximum range, normal/tall monsters and stable/moving visual
target rebound scenarios. All passed with zero browser errors and no damage
to a rebound target. Each case advances eight seconds at 60 Hz with fixed
randomness and frozen monster AI; this isolates delivery and does not measure
natural combat balance or random physical miss frequency.
