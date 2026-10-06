# หมอผี (จอมขมังเวทย์) — animations

Model: `public/models/shaman.glb`, built by `tools/shaman-anims/compose.mjs` from
`tools/shaman-anims/shaman-tripo.glb` (the owner's Tripo model and rig, see
`tools/shaman-anims/README.md`). The skull staff is parented to the right hand, skull end out
of the thumb side; the left hand is free for mudras and casting.

| # | Skill | Clip | Length (s) | Spell (s) | Pose |
| --- | --- | --- | --- | --- | --- |
| 1 | คาถาอาคม | `shaman_akom` | 1.0 | 0.40 | staff drawn back, the skull driven at the target |
| 2 | ยันต์ตรึงวิญญาณ | `shaman_yant` | 1.1 | 0.47 | left hand draws talismans from the right shoulder and flings them |
| 3 | เกราะยันต์เก้ายอด | `shaman_ward` | 1.4 | 0.70 | staff planted in front, left palm raised in a mudra |
| 4 | อัสนีบาต | `shaman_thunder` | 1.2 | 0.60 | staff thrust to the sky, then pointed at the target |
| 5 | เพลิงกัลป์ปราบผี | `shaman_kalp` | 2.0 | 0.80, 1.03, 1.27, 1.50 | both arms up, then the staff slammed down; the left palm pushes each wave |
| 6 | น้ำมนต์ธาราทิพย์ | `shaman_holy` | 1.8 | 0.90 | one-handed wai, head bowed; the hand opens and sprinkles |
| 7 | ไฟผีห้าทิศ | `shaman_ghostfire` | 1.2 | 0.50 | the staff swept across in a flat arc |
| 8 | คำสาปพรายตานี | `shaman_curse` | 1.4 | 0.63 | arms raised, then hunched forward, skull to the ground, left hand clawing |
| 9 | สมาธิกสิณไฟ | `shaman_meditate` | 2.0 | 1.00 | sits cross-legged, staff upright, left hand palm-up in the lap |
| 0 | พายุอัสนีเทพ | `shaman_storm` | 2.2 | 0.80 … 1.87 (×5) | staff held high, left hand open to the sky |

Also `idle` (staff upright at his side, forearm level), `walk` / `run` (the fighter's clips
retargeted onto this rig, the staff kept upright), `hurt`, `die`.
