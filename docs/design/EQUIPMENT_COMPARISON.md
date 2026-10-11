# Equipment comparison

Selecting a carried equipment item, on desktop or touch, shows its real target
slot and a current → after table. Desktop hover shows the same table in the
existing bounded, scrollable tooltip. There is no new floating window.

Numeric rows use the existing Character stat getters, including the candidate's
native values, refinement, validated persistent affixes, socketed card numeric
bonuses, both accessories, active buffs, night bonuses, passives, masteries and
the existing stat caps. The preview replaces exactly the slot `equip` will use;
when both accessories are occupied, it replaces the first, rather than comparing
against whichever accessory scores lower.

Only changed numeric rows are shown; if none change, five core rows show equal
values. Signs and columns convey changes as well as color. Green means a benefit,
orange means a loss, with lower MP cost treated as beneficial. Ratios display
absolute percentages; delta ratios display percentage points. Item detail labels
native values, refinement, random affixes and card values separately. The bag's
score arrow explicitly remains an approximate class-oriented score, never a
claim that every stat improves.

Outgoing and incoming conditional card abilities and race/element bonuses are
available in a separate disclosure. Those effects depend on combat targets and
conditions, so they are not collapsed into a fixed damage number. Current
equipped item detail stays available in its own disclosure.

The preview never invokes Character construction, equip, RNG, saves, events or
online operations. It reads an isolated view with copied slot maps and returns
values only. Restrictions match existing equip: wrong weapon class, required
level and death block projection; an equipment lock does not forbid equip.
Explicit actions still use the existing Character/NetProgress operation.

Comparison values update when character state changes without rebuilding action
buttons, so HP ticks cannot swallow a pending click. Existing tooltip bounds and
inventory scrolling contain long tables and card descriptions.

## Validation and limits

`tests/equipment-comparison.test.js` checks actual isolated `equip` equivalence,
no live state/events/RNG writes, two-accessory destinations, mixed tradeoffs,
current buffs/night/passives/caps, class/level/death/lock behavior, conditional
effects, percentage-point wording and stale-buff projections. Existing inventory
tests retain selection/drag/stale-item/online-operation coverage. Full suite,
build, screenshot and browser gates are recorded in the task QA report.

The table predicts currently exposed numeric Character stats, not a target's
damage taken, conditional card triggers, pet damage, expected DPS or future buff
states. It does not predict current HP/MP restoration: equipping changes maximum
values and still uses the existing clamp, without granting resource refill.
