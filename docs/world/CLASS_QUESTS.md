# Class-master lessons

Each of the six current class masters offers one introduction at **Lv 5 / Job 3**, then one advanced lesson at **Lv 20 / Job 12** after that class's introduction is handed in. Other classes cannot accept or hand in these quests and do not see their offers. Existing learnt skills and skill-tree requirements are unchanged.

Every lesson asks for an actual NPC conversation, ordinary monster kills after acceptance, existing bag materials and a verified combat drill. Intro: four kills, two materials and three accepted uses of the first class skill while already fighting. Advanced: six kills, the materials below and one two-skill combo landing within 12 seconds. Different live monster targets and either skill order are allowed. Materials need not have dropped from those particular kills; unlocked materials already in the bag count and are consumed on hand-in. No exploration, client hit counts, dummy hits or rare bosses are required.

| Class / master | Intro target / material | Advanced target / material | Permanent advanced reward |
|---|---|---|---|
| มวยไทย / ครูมวย | หมูป่า / หนังสัตว์ ×2 | งูเหลือมดงอ้อ / หนังสัตว์ ×4 | ใจนักมวย: ATK +3 |
| นักรบ / ครูดาบ | ผีป่า / ขี้เถ้าธูป ×2 | กุมภีล์ / เกล็ดจระเข้ ×2 | ยืนหยัดพิทักษ์: max HP +30 |
| นายพราน / ครูพราน | ลิงกัง / หนังสัตว์ ×2 | จระเข้บึง / เกล็ดจระเข้ ×2 | สายตาพราน: ATK +3 |
| หมอผี / ครูหมอผี | ผีพราย / ขี้เถ้าธูป ×2 | ผีพรายน้ำ / ขี้เถ้าธูป ×4 | อักขระคุ้มขวัญ: MATK +3 |
| หมอยา / ครูหมอยา | งูเห่านา / หนังสัตว์ ×2 | ผีตายทั้งกลม / ขี้เถ้าธูป ×4 | ตำรับหมอหลวง: MATK +3 |
| โจรป่า / ครูโจรป่า | หมาไน / หนังสัตว์ ×2 | งูเหลือมดงอ้อ / หนังสัตว์ ×4 | ก้าวเงาพิทักษ์: ATK +3 |

Intro supplies: 100 gold, 120 EXP, ยารักษาแผลเล็ก ×3 and น้ำผึ้งป่า ×1. Advanced supplies: 350 gold, 1,500 EXP, ยารักษาแผลกลาง ×3 and น้ำผึ้งป่า ×2. `วิชาสำนัก` costs no skill points and does not multiply with stat allocation: apply its flat bonus after normal derived-stat computation. Each character has at most its own class's school bonus.

| Class | Intro drill ×3 | Advanced combo: both must land within 12 seconds |
|---|---|---|
| มวยไทย | หมัดแย็บ | หมัดแย็บ + เตะก้านคอ |
| นักรบ | ฟันดาบคู่ | ฟันดาบคู่ + แทงทะลวง |
| นายพราน | ศรคู่ฉับไว | ศรคู่ฉับไว + สั่งกัด! |
| หมอผี | กระสุนวิญญาณ | กระสุนวิญญาณ + โซ่ตรวนยมบาล |
| หมอยา | สายใยสมุนไพร | สายใยสมุนไพร + ขวดยาเด้งห้าทิศ |
| โจรป่า | จู่โจมเงา | จู่โจมเงา + มีดอาบยาพิษ |

Five kit classes learn the second offensive skill through their existing tree: warrior requires root Lv 3 / Job 5, the other four require root Lv 2 / Job 3. Advanced Job 12 leaves room for that learning. Intro uses the free root skill and cannot force a new purchase. Assassin uses its existing legacy offensive skills, whose availability is checked by its current server class kit policy. Herbalist's first two skills both deal actual damage as well as healing; healing alone cannot complete this combo. Basic/pet attacks, misses, DoT ticks, zero damage, expired casts, extra blows from one cast and dummy effects do not count. The sequence recommendation is instructional; the objective accepts either order.

Intro supply contact: ยายเพียร in the paddy village for muaythai/hunter; หมอแสง at the deep-forest entrance for the other classes. Advanced contact: แม่บัวผัน at the klong village. Four daylight masters return home at night; shaman/assassin masters remain. The village trader also works morning through evening. The interface shows NPC names, hunting areas, requirements, material consumption and the return master. It offers 44px quest action buttons and a scrolling card area; actual desktop, portrait and short-landscape screenshots passed review; see docs/art/warp-forge-qol/.

## Authority and persistence contract

The server must use its own character, stored quest state, accepted player position and `Combatants.reward` kill events. `server/class-quests.js` authorizes talks and hand-ins near known NPC sites. Six hall anchors come directly from `HALLS`, fixing the missing named class-master sites in the old shop registry. It uses the existing 12m NPC authorization radius; rendering/talk reach remains unchanged. Existing NPC authorization does not validate clock schedules, so the helper preserves that policy rather than claiming time-of-day authority.

The helper ignores client counts, class overrides, reward objects and mastery flags. `recordQuestCast` requires a real current accepted cast record, learned class skill and server combat state; `recordQuestSkillHit` requires that cast's live-target positive-damage server roll. Separate WeakSets count each actual cast once. `reconcileQuestMasteries` removes flags with no matching server-stored completed advanced lesson and backfills valid completed lessons. Browser/API saves are still reconciled against server character/quest snapshots. Local offline guests use validated local combat events; signed-in clients **must defer** practice and mastery until acknowledged server syncs.

The complete reward basket reserves distinct slots and combined weight before any material/gold/EXP/flag mutation. A rejected hand-in leaves both quest progress and materials intact. Locked materials are excluded. A completed quest cannot pay twice.

## Integrated hooks

`Character` filters mastery flags by class and applies their flat bonus after
normal derived stats; increased max HP does not heal current HP. `Combatants`
reconciles stored completion on load, authorizes lesson operations before generic
progress replay, and records accepted combat casts and positive skill hits.
The hit hook runs before damage so valid killing blows count; each cast is
counted once even when it hits several targets.

`NetProgress` adopts strict server mastery flags and retains practice/mastery
deferral for signed-in characters through disconnection. Server accept, talk,
hand-in, accepted-cast and hit hooks send current acknowledged quest state;
stale acknowledgements cannot overwrite newer actions.

Offline guest practice observes actual local combat-roster damage with a live
target, non-miss result and real cast token. Dummy, remote and repeated token
hits do not count. Anonymous connected guests lack skill provenance in remote
hit events, so advanced guest combos are unsupported in that mode rather than
awarded from predicted hits. Signed-in characters use the authoritative server
path.

## Validation scope

2026-10-09: **40/40** focused class-quest plus existing quest/shop/progress/combat tests pass, and **1/1** production signed-in HTTP/WebSocket integration passes. All edited JavaScript passed syntax checks. `npm run build` passes with **250 modules**; the existing large-bundle warning remains.

Tests cover all six classes, class/level/job/prerequisite rejection, complete rewards exactly once, bag/lock protection, forged rewards/flags/counts, near-NPC authorization, actual accepted/rejected server casts, actual production skill blows, two-skill timing, actual offline guest damage, and stored completion reconciliation. The WebSocket test uses trusted stored progress fixtures, rejects forged completion/count/reward packets, verifies exact legitimate rewards, protects API saves and reopens the signed-in character with its earned flag. Its legitimate hand-in starts with a stored completed drill; positive hit validation is separately exercised through the real Combatants/MonsterWorld path. This is not a claim of full natural playthrough for all six classes. Final full suite: 577 passed, 0 failed/skipped. Actual browser QA and Art approval are recorded separately in docs/art/warp-forge-qol/.

Changed files in this specialist's scope: `src/data/quests.js`, `src/quest/QuestSystem.js`, `src/quest/questPresentation.js`, `src/ui/QuestUI.js`, `src/ui/quests.css`, `src/character/data/masteries.js`, `server/class-quests.js`, the quest hooks in `server/combatants.js`, `tests/class-quests.test.js`, `tests/class-quests-online.integration.test.js`, and this document. Other parallel writers' combatants changes are retained.
