# Item carry balance

Weights are abstract game units, not kilograms. Recovery supplies are weightless;
bulk farming materials weigh 1–2 units; equipment follows size and material rather
than rarity or price. Capacity remains `1000 + STR × 30`; at 70% natural HP/MP
regeneration stops. Bag slots still constrain weightless items. Cards remain 1.

## Per-item calculation

| Item | Before | After |
|---|---:|---:|
| ยาหม้อเล็ก | 7 | 0 |
| ยาหม้อใหญ่ | 15 | 0 |
| น้ำผึ้งป่า (MP) | 5 | 0 |
| หนังสัตว์ | 20 | 1 |
| เขี้ยวหมูป่า | 15 | 1 |
| แร่ศักดิ์สิทธิ์ | 10 | 2 |
| ทองคำเปลว | 2 | 1 |
| ขี้เถ้าธูป | 3 | 1 |
| เกล็ดจระเข้ | 8 | 1 |
| ผ้าพันมือมงคล | 10 | 3 |
| มีดสั้นคู่ | 40 | 20 |
| ไม้เท้าสมุนไพร | 60 | 15 |
| มงคลครูมวย | 5 | 1 |
| ดาบไม้ซ้อม | 50 | 20 |
| ดาบเหล็กลาย | 120 | 40 |
| ธนูไม้ไผ่ | 50 | 20 |
| ไม้เท้ากระดูก | 40 | 15 |
| เสื้อผ้าฝ้าย | 30 | 10 |
| เกราะหนังสัตว์ | 110 | 35 |
| ตะกรุดโทน | 5 | 1 |
| เขี้ยวเสือสมิง | 5 | 1 |
| ผ้าโพกหัว | 5 | 2 |
| งอบใบลาน | 10 | 3 |
| ชฎาทองเหลือง | 15 | 8 |
| โล่หวาย | 40 | 15 |
| มีดหมอ | 15 | 8 |
| โล่หนังควาย | 80 | 30 |
| ผ้าขาวม้า | 5 | 2 |
| สไบไหม | 5 | 2 |
| รองเท้าแตะหนัง | 10 | 4 |
| รองเท้าหนังสัตว์ | 20 | 8 |
| กริชคดน้ำ | 30 | 15 |
| ไม้เท้ารากโกงกาง | 50 | 20 |
| ธนูเขาควายบึง | 45 | 25 |
| เกราะเกล็ดจระเข้ | 150 | 50 |
| รองเท้าหนังจระเข้ | 25 | 10 |
| เขี้ยวชาละวัน | 5 | 1 |
| เบี้ยแก้ | 5 | 1 |
| ผ้ายันต์ห้าแถว | 5 | 2 |
| ลูกประคำไม้กฤษณา | 5 | 2 |

100 each of hide, tusk, ash and crocodile scales plus 20 sacred ores used to
weigh 4,800. It now weighs 440 (90.8% less). Adding 100 large HP potions adds
zero, previously 1,500. A starter shaman has capacity 1,060, a heavy threshold
of 742, and starting load 10; this farming load totals 450, below the threshold.
A full heavy set (iron sword, crocodile armor, brass crown, buffalo shield,
cloth cape, crocodile boots, two one-unit charms) totals 142 units.

## Implementation and validation

Only the live item table `src/character/data/items.js` and
`tests/weight.test.js` change. Client and server Character/shops/trades share
this table; weights are recalculated from item IDs, so existing saves need no
migration. The separate legacy rules item catalog is not used by this carry
system and has no weight enforcement; it is unchanged.

269 tests and production build pass. Regression cases cover partial weighted
pickup, regeneration cutoff, weighted shop refusal without charging, weightless
recovery purchases at capacity, bag-slot refusal, and a low-STR farming load.
No UI layout changed, so screenshots are not required. Existing build bundle
warning remains. These are initial balance targets; long-session loot economy
and multiplayer soak testing remain. Not yet deployed to UAT.
