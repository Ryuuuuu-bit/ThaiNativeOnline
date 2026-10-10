# Equipment, custom hotbar and reusable flasks

## Wearing slots and existing characters

The inventory has ten equipment positions: one weapon, body armor, head, cape, shoes, gloves, belt, amulet and two ring/accessory positions. There is no offhand or second weapon set. The two accessories retain the saved keys `charm` and `charm2`; old charms keep their item ID, cards, plus, roll, lock and loadout references. New rings use the same accessory kind. Existing equipment is not silently moved or deleted.

The 144 new bases cover gloves, belts, amulets and rings across the same twelve Thai hunting bands, with physical, caster and hunter choices. Nine equipment kinds share the bounded extra equipment pool equally; the weapon share remains divided equally among six weapon kinds. All 67 species have level-appropriate entries for every kind. The extra equipment chance remains 8% ordinary, 20% elite and 60% boss, selecting at most one extra piece. Legacy rolls remain independent.

Gloves and belts use the native DEF refinement formula. Rings/accessories and amulets are not refinable by default. Gloves/belts accept armor cards; amulets accept accessory cards. Existing native stats, affixes, cards and refinement remain separate additive contributions. Refining never rerolls or multiplies affixes/cards.

## Custom action bar

The saved hotbar is a fixed ten-position array of `null`, `{kind:'skill',id}` or `{kind:'item',id}`. Legacy empty or string arrays migrate to their former effective order: preferred valid skills followed by the remaining learned skills. Typed empty positions stay empty, including through saves and equipment presets. Players choose actions in a slot chooser or drag from learned skills, bag consumables or another bar position. Duplicate bindings share the same skill cooldown; they do not grant additional casts. Material, card, equipment and reusable flask definitions are not consumable bindings.

Keys 1–0 activate these positions. A skill is resolved by ID to its current class controller, never by assuming the controller index matches the bar position. A consumable is resolved by owned item ID rather than a mutable bag index. AUTO casts skill bindings only; it does not consume arbitrary item bindings.

## Q/E reusable flasks

Q uses the equipped HP flask and E uses the equipped MP flask. These are permanent owned instances with `flask:{v:1,iid,charges}` metadata, equipped separately in `flasks.hp` / `flasks.mp`. Their charges travel through swaps, inventory sorting, saves, trades and storage. Equipping, reconnecting or loading a save never grants charges. New and migrated characters receive the basic pair once, marked by a migration version; old consumable potions remain usable from inventory or numbered bindings.

Normal flasks have 40 charges and cost 10 per use. Boss flasks have 50 charges and restore 20% more of their resource than the corresponding normal tier. Resource recovery is instant with a 2.5-second cooldown per kind. Dead characters, full resource, insufficient charges or an active cooldown consume nothing. The same-kind cooldown persists when changing flasks.

| Source | Charges restored to each equipped flask |
| --- | ---: |
| Credited ordinary kill | 1 |
| Credited elite kill | 3 |
| Credited boss kill | 10 |
| Validated herbalist service in the safe city | Fill to capacity |

The server owns online creation, use, recharge and transfers. The town service checks the actual character location, NPC proximity, life and combat state; client-supplied coordinates, amounts or `town:true` are not authority. Only worn flasks recharge from credited kills.

Normal tiers at levels 1, 10, 20, 30, 40, 50, 60, 70, 80, 90 and 100 are sold by city general, north-gate supplies and herbalist shops. Tier progression means obtaining and equipping a stronger bottle once its level requirement is met; there is no flask crafting or refinement system in this change.

Every species marked as a boss has a themed HP and MP flask. One separate 15% roll chooses at most one special bottle per credited kill, split equally between HP and MP. World-boss flask tiers follow effective encounter level. Participation scaling and eligibility follow the existing reward rules. Special bottles are not ordinary shop stock. The bestiary derives their probabilities from the same table.

## Controls and AUTO search

R toggles AUTO; F interacts with NPCs; Home resets the camera. The UI and touch controls use these labels consistently. Radius presets are measured around the player's current position each tick. The whole-map option searches the current map, with a server target locator refreshing distant positions; it does not cross portals or select monsters in another map. Ordinary navigation, collision and legal combat range still apply.

## Verification

Meaningful checks cover old-save metadata and hotbar migration, empty positions and shared cooldowns, all-species slot coverage, boss-tier tables, flask charge conservation, forged charge/identity rejection, town/kill recharge, exact-instance transfers and current-map isolation. Full-suite/build results and desktop/mobile screenshots are recorded in the task QA report. Economy and combat pacing still require playtesting because three new stat-bearing equipment slots increase total character power.
