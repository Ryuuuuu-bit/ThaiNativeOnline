# Map boss encounters

Branch `codex/boss-skills`, based on the deployed party-hunting revision
`49de5b2` / PR #28. This change has not been deployed.

## Design

One primary encounter per hunting map, rather than a boss in every ordinary
hunting pocket. The town stays safe. Existing boss/elite spawn sites, HP, loot,
cards, respawn times and CH1 restriction are preserved. No duplicate boss spawns.
Some regional map bosses retain their existing `elite` content flag so this
change does not silently alter their card probabilities.

| Map | Primary boss | Skill 1 | Skill 2 |
| --- | --- | --- | --- |
| ทุ่งนา | ควายป่า | กวาดเขา — cone | กระทืบคันนา — self circle |
| ป่าลึก | นางตะเคียน | รากพันธนาการ — aimed circle | วงคำสาปตะเคียน — ring |
| วัดร้าง | ผีปู่โสม | ยันต์พิทักษ์สมบัติ — aimed circle | คลื่นอาคมปู่โสม — ring |
| คลองหนองบึง | ชาละวัน | เขี้ยวชาละวัน — cone | คลื่นวังบาดาล — ring |
| ป่าช้าไผ่ดำ | เจ้าป่าช้า | ยันต์ป่าช้า — aimed circle | วงวิญญาณไผ่ดำ — ring |
| เหมืองอาคมร้าง | ผู้พิทักษ์เหมือง | ทุบศิลาผนึก — cone | ศิลาร่วง — aimed circle |
| นครบาดาล | นาคราชเฝ้าประตู | ลมหายใจนาคราช — cone | คลื่นนาคราช — ring |
| ป้อมอสูรสนธยา | เจ้าอสูรสนธยา | ฟันสนธยา — cone | ตราเพลิงอสูร — aimed circle |
| หุบเขายักษ์ | ยักษ์เฝ้าหุบเขา | กระบองสะเทือนผา — cone | แผ่นดินยักษ์ — ring |
| ป่าหิมพานต์ | พญาปักษาทมิฬ | ขนปักษาสังหาร — cone | ลมหมุนหิมพานต์ — aimed circle |
| นครอาคมล่มสลาย | ขุนพลอาคม | คมดาบราชองครักษ์ — cone | ค่ายกลนครล่ม — ring |
| ประตูรอยแยกอสูร | เจ้าอสูรรอยแยก | รอยแยกกลืนวิญญาณ — aimed circle | วงสุริยคราสอสูร — ring |

The existing pop, krasue and tani identities also receive two attacks each.
Names are thematic; the new attacks deal direct area damage. Names such as
“roots” do not imply a new root debuff or persistent hazard.

- First special becomes available after three seconds of eligible combat.
- Aim and cone direction lock when the warning starts. Boss movement and basic
  attacks stop during casting and for a 1.1-second recovery after impact.
- Windups are 1.8–2.4 seconds. Cooldowns are 8–11 seconds, counted between casts
  outside windup/recovery. Below half HP the next cooldown is 20% shorter; warning
  time, shape size and power stay unchanged.
- Circles: leave the marked floor. Cones: sidestep outside the fixed facing.
  Rings: stand inside the unpainted centre or outside the outer boundary.
- Skill power is 1.2–1.5× attack before existing defence/evasion/resistance.
  Special attacks do not receive the random additional elite-heavy multiplier.
- Stun, death, leash or loss of all valid targets cancels the pending attack.
  Returning while another contributor remains may retain that encounter and its
  fixed-area attack. Respawn resets sequence and initial cooldown.

## Authority and presentation

`src/combat/data/boss-skills.js` owns encounter/attack data. The pure shared
`bossSkills.js` owns area geometry, phases and timers for the server and offline
combat. `server/monsters.js` returns `mskill` events with `windup`, `impact` or
`cancel`, plus one `ma` for each living player currently in the area at impact.
Server routing checks line of sight from the attack origin before damage.
Signed-in HP is resolved by Combatants; guests keep their existing local HP model.
Starting a skill also requires server line of sight to its target.

`mlist` carries any current `skillCast`, including remaining warning time, so a
player arriving mid-cast sees the current warning. The client never schedules
online damage from its visual timer. Offline uses the same aim/timer/shape logic;
its existing movement/obstacle model is still separate from server navigation.

Warnings use subdivided, terrain-sampled meshes, readable outlines and Thai dodge
hints. They remain enabled when particles are off. Cancellation, map lists,
disconnect and monster despawn remove warnings and release their GPU resources.
Impact briefly flashes the same footprint; it does not expand the damage area.
The target frame shows phase and active skill. On touch screens it sits below
the top HUD cluster, away from thumb controls. A selected boss's duplicate world
label is suppressed on touch screens.

## Validation and limits

- 334 tests pass: 322 existing plus 12 encounter tests, including all 24 primary
  boss attacks, dodge positions, ring safe zones, stun/death/leash, respawn,
  late-join warning, special damage and geometry disposal.
- `npm run build` passes. Existing large bundle warning remains.
- Headless Edge / low quality / particles off: actual offline AI warning captures
  for circle, cone and ring; touch layout at 390×844.
- Local real WebSocket smoke: warning → impact → skill damage, with a second
  client joining 350 ms into the warning and receiving the same serial and 1.7 s
  remaining out of the initial 2 s.
- Browser connected to the local server: `Combat.remote === true`, real server
  boss warning received and rendered. Captured in the art review folder.

No independent Art Director score was obtained. Models and attack poses reuse
the current procedural assets. Unique boss animations, sound, persistent hazards,
new status debuffs, stagger resistance, physical mobile performance and real-party
balance still need separate work/playtesting. Bosses remain crowd-controllable.
