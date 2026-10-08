# นักรบ (ขุนศึกดาบคู่) — animations

Model: `public/models/warrior.glb`, the user's `tools/warrior-anims/warrior-user.glb`
with legacy clips/weapons retargeted by `tools/class-models/retarget.mjs`
(see `tools/class-models/README.md`). Twin curved
swords, one in each fist (parented to the hands), blades out of the thumb side. Battle
stance from `warrior.webp`: wide and low, left foot leading, left blade out toward the
target, right blade cocked high by the shoulder.

| # | Skill | Clip | Length (s) | Blows (s) | Pose |
| --- | --- | --- | --- | --- | --- |
| 1 | ฟันดาบคู่ | `sword_twin` | 1.0 | 0.30, 0.47, 0.67 | left cut from over the right shoulder, right cut from over the left, both in an X |
| 2 | แทงทะลวง | `sword_thrust` | 1.0 | 0.40 | coil low, blades at the hips, long lunge with both points ahead |
| 3 | ดาบวายุ | `sword_wind` | 1.1 | 0.50 | blades crossed high behind the head, torn apart in a flat scissor cut |
| 4 | ตั้งการ์ดดาบคู่ | `sword_guard` | 1.3 | 0.60 | low and square, blades crossed in an X before the face |
| 5 | เพลงดาบพิฆาต | `sword_pikat` | 2.0 | 0.33 … 1.67 (×6) | six alternating diagonal cuts while turning a full circle |
| 6 | ธงชัยเฉลิมพล | `sword_banner` | 1.8 | 0.90 | right blade raised to the sky, then driven into the ground on one knee |
| 7 | ดาบบาทวงจักร | `sword_whirl` | 1.4 | 0.37, 0.67, 0.97 | arms flung out, blades level, three full spins |
| 8 | กระโจนผ่าปฐพี | `sword_leap` | 1.5 | 0.90 | crouch, leap with blades behind the head, smash both into the ground |
| 9 | โทสะขุนศึก | `sword_berserk` | 1.6 | 0.80 | chest out, head back, blades low and wide, then a crouching roar |
| 0 | ดาบประหารอสูร | `sword_execute` | 2.0 | 1.20 | both blades raised overhead (lightning), held, one cleave into a deep lunge |

Also `idle` (battle stance, breathing), `walk` / `run` (the fighter's Tripo locomotion,
retargeted to the replacement skeleton), `hurt`, `die`.
