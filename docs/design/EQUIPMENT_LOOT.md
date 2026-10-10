# Equipment coverage and hunting choices

Every one of the 67 monster species has an additional equipment opportunity covering weapon, armor, head, cape, shoes and charm. A charm fits either existing charm slot. Sword, bow, wrap, dagger, talisman and book all remain eligible; this does not add equipment slots or class weapons.

The additional roll succeeds at 8% for ordinary monsters, 20% for elites, and 60% for bosses (boss takes precedence over elite). Success chooses exactly one item. Each slot kind has one sixth of the pool's probability; the weapon share is divided equally between the six weapon kinds. Within each category, current-region items have triple weight and older tiers decline with level distance. Item minimum level and the separate legacy loot tier must not exceed the monster's actual level. World-boss participation scaling belongs to the reward caller, not this content table.

The 108 new accessory bases fill head/cape/charm progression at levels 1, 6, 12, 18, 23, 30, 40, 50, 60, 70, 80 and 90. Each tier offers physical strength/HP, caster INT/MP and hunter DEX/evasion choices. All use authored base bonuses and existing equipment icons; no new art is claimed. Instance affixes are a separate system and do not replace these base stats or card slots.

Existing IDs, native bonuses, shop stock, retired status and legacy loot rows are preserved. The legacy equipment tier lookup only controls the new pool, so old equipment requirements do not change. Existing consumables, materials, cards and unique gear retain their old rolls. All active equipment bases are reachable somewhere; retired weapons and shields are excluded from the new pool.

## Expected equipment count per kill

The bounded extra roll adds at most one item, but old independent rolls can already produce several items. These totals deliberately retain that behavior:

| Example | Level | Legacy expected items | Additional expected items | Combined expected items |
| --- | ---: | ---: | ---: | ---: |
| Boar | 1 | 0.174 | 0.08 | 0.254 |
| Water ghost | 5 | 0.184 | 0.08 | 0.264 |
| Krasue elite | 7 | 2.15 | 0.20 | 2.35 |
| Pop boss | 10 | 4.05 | 0.60 | 4.65 |
| Marsh leech | 15 | 0.072 | 0.08 | 0.152 |
| Tani elite | 20 | 0.85 | 0.20 | 1.05 |
| Chalawan boss | 25 | 2.40 | 0.60 | 3.00 |
| Bamboo grave ordinary | 23 | 0.048 | 0.08 | 0.128 |
| Bamboo grave boss | 30 | 0.96 | 0.60 | 1.56 |
| Demon rift boss | 100 | 0.96 | 0.60 | 1.56 |

Expected count is not the chance of receiving gear. For an item present in both tables the bestiary displays chance of at least one: `1 - (1 - legacyChance) * (1 - additionalChance)`. It also reports a possible quantity of two when both equipment rolls can succeed. Equipment rows from the new pool are mutually exclusive within that single additional roll.

## Persistent random affixes and refinement

New equipment drops independently roll common (65%, no affixes), magic (27%, one or two), or rare (8%, three or four). Rolls contain at most two prefixes and two suffixes, with no repeated stat family. These roll rarities are separate from a base item's existing rarity, price and refinement formula. Existing equipment and shop purchases retain their original stats.

Affix tiers unlock at item levels 1, 21, 41, 61 and 81; in this implementation T5 has the largest range. Actual values are generated once, stored on the individual item, and shown separately from native, card and refinement bonuses. Moving, equipping, saving or refining a piece never rerolls it. Online rolls and item identities come from the server; client references cannot supply replacement bonus values.

Total equipment bonus is native stats + refinement + affixes + socket cards. Refinement scales only the native item definition, using the existing base rarity and +0 to +10 formula. For example, a wood sword with native ATK 3 and an ATK 6 affix has ATK 9 at +0 and ATK 11 at +1: the refinement adds 2, while the affix stays 6. Costs, ores, safe steps and failure rates stay unchanged. If a failed risky refinement destroys the piece, its cards and affixes disappear with it. Charms keep their existing refinement restrictions.

Distinct rolled pieces carry UUIDs through inventory, equipment, loadouts, stash, trades and saves. Equipment operations require the exact identity, so two swords with the same base name, cards and plus cannot be confused. Plain legacy equipment remains supported.

Content verification covers all 67 species, six slots, six weapon kinds, positive normalized weights, minimum levels, reachability of every active base, valid icon paths, and preservation/union of bestiary probabilities. Integration tests additionally cover exact identity, forged metadata, transfers, refinement and persistence. Browser playtesting is required separately for presentation.
