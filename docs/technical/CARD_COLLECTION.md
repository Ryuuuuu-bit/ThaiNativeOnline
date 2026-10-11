# Card collection and boss abilities

## Player surfaces

The main menu opens one journal in two modes: **สมุดการ์ด** and **คู่มือผู้เดินทาง**.
The catalog derives every card, compatible equipment slot, base drop rate and
active hunting location from current gameplay data. Search and map/type/slot/
collection filters do not change items or teleport the player. Location actions
use the existing atlas route selection; guide actions open existing game panels.

There are 65 card definitions and 63 species with active spawn locations. Entries
without an active source remain visible and explicitly say that no current
hunting location exists. New individual paintings cover only the 31 monsters
with designed production GLB models, as requested. The 34 procedural fallback
creatures retain existing icon/emblem presentation; no new designs are published
for them. The original item PNG files remain available.

The 24 ordinary expedition cards now have distinct combinations of precision,
critical damage, casting, SP reserves, race damage and defense. Their weapon
slots remain compatible with saved sockets. Flat ATK/MATK tops out at the former
fallback's +20; these cards introduce no new procs or level gates. Existing
curated card bonuses and eight expedition boss base bonuses remain unchanged.

The guide covers sockets, extraction costs and risks, drop ownership, base/job
progression, party sharing, refinement, travel and equipment presets. Numerical
facts use rule constants. The player resource is labeled SP in this journal;
the saved/runtime field remains `mp`.

## Historical collection

`Character.cardBook` maps recognized card item IDs to `true`. Successful card or
socketed-gear acquisition records ownership without consuming anything. Selling,
socketing, destroying or depositing a card does not erase its history. Collection
progress grants no combat bonuses and never substitutes for an actual equipped
card. Old characters reconstruct discoveries from their surviving bag and valid
worn sockets. Previously sold/lost cards cannot be reconstructed from absent
records.

The book is sanitized and serialized with the character. Online synchronization
replaces local history with the authoritative server book rather than accepting
client claims. Existing save/inventory synchronization gates and transactions
continue to apply.

## Boss cards

All 11 boss card definitions and the two early map guardians (buffalo and
takian) have an explicit ability separate from their existing flat bonuses.
The boss catalog filter includes all 13; map-role badges do not change monster
flags or drop rates. The two guardians retain their elite 0.25% card rate.
Abilities work from valid sockets on currently worn,
eligible equipment. Multiple copies of one boss ability do not stack. Collected
cards and cards on unequipped gear grant no abilities.

| Boss | PvE ability |
| --- | --- |
| ควายเจ้าทุ่ง | Deal 12% more damage to beasts; an elite map guardian. |
| นางตะเคียน | Deal 12% more damage to demons; an elite map guardian. |
| ปอบ | Heal 3% of actual landed damage; at most 2% max HP per activation, 2-second cooldown. Pets and DoTs do not trigger it. |
| ผีปู่โสม | Restore 2% max SP when receiving the monster's item reward, 5-second cooldown. |
| ชาละวัน | Take 15% less monster damage at 40% HP or below. |
| เจ้าป่าช้า | Deal 18% more damage to spirits. |
| ผู้พิทักษ์เหมือง | Take 10% less monster damage at 80% HP or above. |
| นาคราชเฝ้าประตู | Deal 18% more damage to water monsters. |
| เจ้าอสูรสนธยา | Deal 15% more damage at 50% HP or below. |
| ยักษ์เฝ้าหุบเขา | Deal 18% more damage to bosses. |
| พญาปักษาทมิฬ | Deal 18% more damage to wind monsters. |
| ขุนพลอาคม | Deal 18% more damage to dark monsters. |
| เจ้าอสูรรอยแยก | Deal 25% more damage and take 10% more monster damage. |

Combined conditional outgoing damage caps at +30%, and combined incoming
reduction caps at 30%, after existing race/resistance rules. The rift penalty
applies separately. Boss abilities add no new PvP effects. DoTs inherit their
source hit once rather than receiving a second conditional damage multiplier.
Proc cooldowns are transient combat state, not part of card equipment or saves.

HP/SP gains cannot exceed their maxima. Lifesteal uses actual HP removed, so
misses and excess overkill cannot inflate healing. Kill restoration requires a
real owner-bound reward receipt and cannot be repeated from the same receipt.
Guest clients require monotonically increasing `hitSeq` and `killSeq` receipts.
They consume each receipt before checking eligibility, preserve high-water
marks across same-player room/welcome refreshes and reset only on disconnect or
identity change. Old servers without these receipt fields grant no guest procs.
Signed-in characters receive authoritative server vitals. Restore conditions use
actual damage/deaths rather than client-reported HP removal or kill claims.

## Model-based artwork

The reference tool uses the actual production monster builders and current GLB
bytes, waits for model/motion readiness and captures a fitted idle pose. It uses
one headless Edge instance and one page, releases each model and closes the
browser. A full discovery capture included 31 GLB models and 34 fallbacks; only
the 31 GLB entries are admitted to the final prompt set, registry and assets.

Every selected painting was generated separately using built-in imagegen with
its actual model reference and the approved painted style reference. Species,
body form, clothing colors and existing weapons take precedence over interpreting
the monster's name. Anatomical changes or new model geometry are outside scope.
Packaging preserves composition in 384×480 portraits and 96×120 WebP thumbnails.
The list loads thumbnails lazily; the selected detail loads its larger portrait.
The inventory renderer also preserves the full composition rather than cropping
the old baked pixel-icon border. Per-image budgets are 90 KB / 9 KB.

`tools/card-art/spec.json` stores the prompt set. `reference-manifest.json` and
individual `receipts/*.json` bind portraits to captured model/source hashes.
`normalize.mjs` refuses procedural fallback entries; `publish.mjs` verifies the
complete 31-model set before generating the illustration registry.

## Validation and limits

Final local validation: **830/830 tests pass** with test concurrency limited to
two; `npm run build` succeeds with the existing large-bundle warning. Six browser
scenarios and ten refreshed screenshots pass with no page errors. Independent
Art/Tech review accepts all 31 paintings/icons and the refreshed responsive
layouts at or above the Art Bible's 8/10 target. The class-quest damage fixture
now constructs real Combat so its constructor-owned card state participates
while the existing verified-hit/combo assertions remain intact.

Tests cover catalog/spawn coverage, save migration and history, inventory/socket
lifecycle, authoritative synchronization, equipped ability conditions/caps and
offline/server combat parity. Art tests check the 31-model scope, distinct
generation/images, real WebP dimensions, budgets, registry mapping and reference
source hashes. Browser review covers four component viewport
sizes and the actual game's guest boot, menu integration, camera/input gating,
guide-to-bag action and focus return at desktop and portrait sizes (six scenarios,
ten screenshots). The lightweight review fixture is
`tools/card-compendium-review.html`; its sample holdings never enter player saves.

These checks do not establish physical-phone performance or long-term card
economy balance. Drop rates remain 0.02% ordinary, 0.25% elite and 0.5% boss.
Collection cannot recover old discoveries that were already sold or lost before
history tracking. Two catalog entries (pop and tiger) still have no active spawn.
Live PostgreSQL migration and physical-device performance were not exercised.
