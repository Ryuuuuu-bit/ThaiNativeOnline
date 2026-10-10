# Class skill direction

The class overhaul makes skill investment change how a class prepares an encounter,
helps its party and spends an opening. It retains the five existing complete kits,
their Thai identities, skill IDs, ten active slots, three passives, prerequisite
graphs and A/B choices. RO is a reference for distinct builds and cooperation;
the gameplay camera and Thai visual language remain governed by GAME_VISION and
ART_BIBLE.

## Ownership and dependencies

| Piece | Owner | Files and dependency |
| --- | --- | --- |
| Build identities, early utility and A/B data | Content Designer, rules approved/applied by Game Director | `src/character/data/skilltree.js`, path design, class move descriptions; reviewed `src/rules/data` changes |
| Combat implementation | Gameplay Engineer | shared kit combat, offline caster, authoritative server, status handling and focused tests; consumes approved skill metadata |
| Rules direction and balance rationale | Game Director | rule tables, rules README and this document |
| Readability and technical review | Art Director / Technical Artist | updated skill UI and status labels, after runtime integration |
| Verification | QA | complete suite, production build, browser skill screen and party execution evidence after integration |

## Class decisions

| Class | Build identities | Party contribution |
| --- | --- | --- |
| Warrior | precise sword damage / sweeping blade / frontline protection | bounded provocation and nearby defensive support |
| Muay Thai | close combinations / sweeping kicks / defensive discipline | weakening and armor openings; exploit controlled opponents |
| Hunter | aimed shots / area traps / hunting companion | immobilize or slow encounters and expose openings for allies |
| Shaman | curses / ritual fire / ancestor protection | reduce enemy defenses or damage, control a pack for other casters |
| Herbalist | recovery and resurrection / herbal offense / restorative tonics | deliberate healing, cleansing and resource recovery choices |

Existing assassin content remains a legacy four-skill kit. Improvements must work
through its real execution path; a full kit, tree, new icons and animation set are
outside this revision.

## Interaction contract

Skills can advertise a small bonus against an already active enemy condition.
One matching condition is sufficient, several matches do not add bonuses, and
the maximum bonus is 25%. Ordinary attacks keep their existing formula. A damage
over time effect uses its initial source damage and does not repeatedly evaluate
or compound the opening bonus. A/B variants must preserve or deliberately replace
their preparation and payoff effects.

Armor break and weakening affect real defense and enemy attacks on both local and
authoritative execution paths. The strongest active effect is used rather than
adding every source. Provocation has limited duration and requires a valid nearby
living caster; it cannot overturn a boss attack that has already announced a fixed
aim. Supporting skills keep visible range and duration limits.

Solo characters retain attacks and useful control. Cooperation must provide an
advantage without making any particular class mandatory for ordinary hunting.
Basic damage multipliers, progression, economy and equipment formulas are retained
unless the rules README records an explicit balance reason.

## Deliberately excluded

No new classes, second jobs, maps, dependencies, new model production or forced
party composition. No global damage multiplier stacking or repeat bonus on DOT
ticks. This change does not claim live production party balance or device FPS;
those require playtests after functional verification.
