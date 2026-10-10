# Skill paths

Every active kit skill and every tree passive in the five ready classes offers A/B at learned skill level 5. The unselected base remains unchanged at all levels, including level 5 and above. Existing fifteen active pairs retain their current definitions.

First selection is free. Switching to the other path costs current Job Level × 10 ตำลึง. Selecting the already selected path costs nothing. All selections and switches require the character to be outside combat. Paths spend no skill points, do not change prerequisites, and do not reset learned levels.

The actual roster is **50 active skills** (ten in each class kit), plus **15 tree passives**. The legacy herbalist seed is not in its playable ten-skill kit. Legacy weapon passives and hybrid skills are outside this roster.

## Active design

[Machine-readable content](../../src/character/data/skill-path-design.js) defines the 35 added active pairs and all 15 passive pairs. Each active override is a replacement over the base rules record, including whole `buff` and `effect` objects. Unspecified fields retain the base. Descriptions explain the practical sacrifice rather than promising that one path is always stronger.

| Class | Purpose of added choices |
| --- | --- |
| Warrior | Large crowd coverage versus longer control of a small group; defensive recovery versus frequent attack-speed windows; party coverage versus concentrated offensive support. |
| Muaythai | Cheap repeatable jabs versus interrupt timing; broad impact versus longer stuns; resilient self-support versus short offensive windows. |
| Hunter | Ranged coverage versus slowing pursuit; sustained firing windows versus short critical windows; broad hunting zones versus narrow control. |
| Shaman | Wide and slower casts versus narrow control; range versus slowing pressure; HP-focused party recovery versus MP-focused recovery. |
| Herbalist | Healing strength versus frequency and MP efficiency; broad support versus fast rescue of a tightly grouped party; offensive pills versus restorative pills. |

These serve the existing wilderness progression: efficient small encounters, crowd hunting, holding enemies away from vulnerable party members, and recovery during elite/boss fights. They add no new areas or level gates. AoE choices may hit more monsters; they do not guarantee a particular monster count.

## Passive design

Passive path coefficients are supplied as `bonusPerLevel`. The binding multiplies each coefficient by learned passive level and replaces that passive's base bonus. It must not add the original bonus a second time. Before selection the current `KIT_PASSIVES[id].bonus` remains the authority.

Physical and magic mastery paths trade some attack multiplier for accuracy (physical classes), MP (magic classes), defense, evasion, attack speed or healing. Resource passives trade MP capacity for defenses or cooldown reduction. Support passives trade stronger healing for frequent casts. HP passives trade maximum HP against evasion or defense. Pet specialization trades dog damage against the hunter's defense. Flat and percentage stats intentionally retain their existing derived-stat units.

## Runtime contract

The added paths use fields read by `src/training/kitCombat.js`: `mp`, `cd`, `mult`, `castMs`, `range`, `radius`, `spread`, `splash`, `all`, `duration`, `heal`, `mpHeal`, `hmult`, supported buffs (`atkMul`, `def`, `defMul`, `critAdd`, `aspd`) and supported debuffs (`stun`, `slow`, poison). Existing base effects inherit unchanged unless a path replaces them.

Do not claim that overrides change animation hit counts, dog bite animation counts, projectile speed, seed trigger time, tether near-distance bonuses, resurrection immunity, movement speed, cleanse, armor break or weakness: the current shared kit rules do not express those consistently. Support healing currently aggregates tether ticks and bouncing heals; the added paths change aggregate healing strength and resource cadence. Visual effects retain the base identity.

All 65 skill pairs are bound to the director-owned rules: active paths register selected variants in `EVOLUTIONS`, and passive paths register coefficients in `PASSIVE_PATH_BONUSES`. UI previews, local combat, server casts and derived passive bonuses use the selected path through the shared rules API. Saved selections retain their learned levels. The content file supplies these registered overrides; it does not calculate separate balance formulas. Natural hunting and party pacing still require playtesting after implementation validation.

