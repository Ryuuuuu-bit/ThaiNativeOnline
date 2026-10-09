# World Bosses

Two world bosses, one for each half of the day, both a level band above the map
they live on so players gather to fight them. They sit between วัดร้าง (Lv 4-8) and
คลองหนองบึง (Lv 10-25), where the game has no boss yet.

Status (2026-10-09): **ผีชุดแดง + ผีชุดดำ are in the game**; ควายธนู is design only.
- Map `ruen_ho` เรือนหอร้าง (`src/world/maps.js`, built by `src/world/districts/RuenHo.js`): a
  closed instance far beyond the world's north edge (z -2900, past the expeditions), `nightOnly`, sized for a crowd: a gallery 29 × 8 m and a bridal hall 29.5 × 26 m with four pillars. It has no door on the map: the urgent world boss news (`src/ui/WorldBossBanner.js`) carries a button
  that sends `wbjoin`, and the server (`server/index.js` joinWorldBoss) warps the player in at night, unless fighting, duelling or trading; by day it answers `wbnews closed`. The room's own door leads out to วัดร้าง, and at dawn the server sends everyone back out.
- Monsters `ghost_red` / `ghost_black` (`src/combat/data/monsters.js`), loot `ghost_sisters`,
  cards, spawns `ruen_ho_bride` / `ruen_ho_sister`, models `public/models/monsters/ghost_*.glb`.
- Rules `src/combat/data/worldBoss.js`, after the old game's พระราหู: HP = one share × players
  online (cap 40), locked when they rise; one round a night; everyone with 0.5% of the damage
  is paid (EXP, gold, a loot roll by rank, the card to the top damager); the red thread
  (heal 1%/s, half damage within 8 m) and the 12 s revive run on the server (`server/monsters.js`).
- News to everyone (`wbnews`, `src/ui/WorldBossBanner.js` + chat): dusk, nightfall, a sister
  falls / rises, both down (with the MVP), dawn.
- Not yet: the phase skills and FX below (claw grab, shadow hands, hanging sister, merge, blood
  rain…) and the `raise` tell clip in game; offline (no server) the sisters fight as plain bosses.

| Boss | When | Where | Skill tested |
|---|---|---|---|
| ควายธนู | evening (โพล้เพล้) | ทุ่งนาข้าว, open field by the forest edge | positioning, dodging |
| ผีชุดแดง + ผีชุดดำ | night | เรือนหอร้าง, a boss room reached from วัดร้าง | splitting the group, balancing two HP bars |

---

## 1. ควายธนู

A black buffalo raised from earth and spells by a sorcerer (Thai black magic) and
sent to trample the fields at dusk.

- **Look:** huge black buffalo, no shadow, red eyes, glowing yant script on the hide,
  horns wrapped in broken sacred thread, black smoke trailing when it runs.
- **Stats:** Lv 9 · HP 18000 · ATK 55 · DEF 12 · demon / dark · size 2.8.
- **EXP / gold:** 2400 shared by damage dealt / 200-350.
- **Spawn:** evening only; walks back into the forest when night falls if still alive.
  A temple bell and a map-wide banner warn of it; farmer NPCs flee.

### Mechanics
1. **Yant shield.** Takes almost no damage while the sorcerer's three yant stakes
   stand around the field.
2. **Aimed charge.** A red lane shows for 1.3 s, then it charges down it. Stand behind
   a stake so the lane crosses it: the charge breaks the stake and stuns the buffalo
   for 2 s. Getting hit knocks the player back.
3. **Stomp.** Every third attack: a red ring around it, damage and a 1 s stun inside.
4. **Shield down.** All three stakes broken: full damage, ×1.5 while stunned.
5. **Enrage at 30%.** Aims faster, charges harder.

### Loot (`kwaithanu` table)
เขาควายลงยันต์ (material); rare ตะกรุดควายธนู (charm: charge power, knockback immunity).

---

## 2. ผีชุดแดง + ผีชุดดำ (twin boss)

Reference: [img/ghost_sisters_ref.png](img/ghost_sisters_ref.png). In the picture
the elder sister wears white; in the game she wears **black**.

**Story.** A bride was murdered on her wedding night in her red dress. Her jealous
elder sister did it, then hanged herself in black mourning cloth. One red thread binds
both souls, so they always fight together.

### Look (from the reference)
- Floor-length robe with long sleeves; no feet showing, so they seem to float.
- Long straight black hair covering the face front and back. **The face is never shown.**
- Pale, long, clawed hands with blood-red nails, raised as if about to grab.
- No modern clothing details; the cut should read as Thai cloth, not a costume.

| | ผีชุดแดง (younger, the bride) | ผีชุดดำ (elder, mourning) |
|---|---|---|
| Robe | bright red wedding cloth, hem stained with dried blood | black mourning cloth, frayed, a cut noose of red thread at the neck |
| Manner | arms high, rushes in, aggressive | stands still, arms forward, head tilted |
| In the dark | stays vivid red; easy to find | the body vanishes into the dark; **only the pale hands and red nails show** |
| Element | fire | dark |
| Stats | Lv 12 · HP 32000 a player online · ATK 62 · DEF 10 | Lv 12 · HP 28000 a player online · ATK 55 · DEF 9 |
| Style | chases and melees, claw sweep in a ring | stays in shadow, shadow hands rise from the floor under players |
| Weak point | **in light:** ×1.6 damage taken (×0.35 in darkness) | **in darkness:** ×1.3 (×0.35 in light, and she drifts out of light) |

Shared EXP 3200 by damage dealt; gold 250-400 each.

### Boss room: เรือนหอร้าง
- A small fifth map (`MapManager` loads one map at a time). The door is a teak house
  gate inside วัดร้าง that **opens only at night** and is barred by day.
- Layout after the reference: a long roofed corridor (Ayutthaya timber gallery with
  arched niches, not a modern hallway) leading to the bridal chamber.
- One wall has candle niches (the light side); the other is pitch dark.
- Entry shot: the camera looks past the player down the corridor; both sisters stand
  at the far end facing away, as in the reference, then turn. The hair still covers
  their faces.

### Mechanics
1. **Red thread.** Within 170 units of each other they are linked: both heal and take
   half damage. Crossing the thread hurts. The group must pull them apart.
2. **The elder follows.** Every 10 s ผีชุดดำ teleports beside ผีชุดแดง to relink.
3. **Split roles.** One team drags ผีชุดแดง into the candlelight; the other hunts
   ผีชุดดำ in the dark by her hands.
4. **Grab.** Raised claws for 1 s (the reference pose) are the tell: a lunge that
   leaves a bleed DoT.
5. **Die together.** When one falls the other screams; kill her within **12 s** or the
   fallen sister rises at 40% HP. Keep both HP bars level.
### Phases
| Phase | When | Room | New moves |
|---|---|---|---|
| 1 · สองพี่น้อง | start | candles lit, blue night | the grab, shadow hands (a dark vortex, then eight pale hands with red nails rise around the target), the elder's warp, the red thread |
| 2 · น้ำตาเลือด | both below 70% | dimmer, thicker fog | ผีชุดแดง weeps blood: pools that hurt to stand in. ผีชุดดำ draws the candle flames into her hand one by one, so the light shrinks. Die together (above) |
| 3 · คืนส่งตัว | both below 40% | red wedding curtains, red threads hang from the dark | **ร่างแขวนคอ**: ผีชุดดำ hangs from a red noose and swings across the corridor; a red band on the floor marks the sweep. **ผมคลุมทั้งห้อง**: ผีชุดแดง's hair creeps along the floor in five lines, then hair spikes burst up along them. **สายสิญจน์มัดตัว**: red threads shoot down and bind a player (rooted), then drag them to ผีชุดแดง for a grab; others cut the threads |
| 4 · วิญญาณผูกตาย | both below 15% | every candle out, a turning blood seal on the floor | **รวมร่าง**: the sisters fuse back to back, float, grow (×1.5), the thread coils around them; one HP bar from here. **ฝนเลือด**: blood rain, then a ring of red thread appears; everyone outside it when she screams takes a heavy hit. **คำสาปสุดท้าย**: both claw across the target at once (a big telegraph) and crack the floor. Enrage after 90 s |

On death the thread snaps and both turn to drifting ash.

### Loot (`ghost_sisters` table)
ด้ายแดงต้องคำสาป (material); rare ปิ่นปักผมเจ้าสาว (charm: ATK, fire damage) and
ผ้าไว้ทุกข์ดำ (armor: evasion in darkness).

---

## Work split

| Owner | Work |
|---|---|
| content-designer | `monsters.js`, `spawns.js` (evening / night windows), `loot.js`, new items |
| gameplay-engineer | telegraphed ground attacks, stun window, enrage, yant shield and stakes, twin link and revive timer, light/dark damage zones, shared reward by damage, spawn banner |
| world-designer | ควายธนู route and stake spots in ทุ่งนาข้าว; the เรือนหอร้าง map, its night-only door in วัดร้าง |
| environment-artist | the timber corridor, candle niches, bridal chamber |
| technical-artist | dusk dust and smoke for ควายธนู; candle light zones, shadow hands, blood pools |
| character-artist | Tripo models for ควายธนู and the two sisters (from the reference) |

Playable mechanic prototypes for both fights were made in chat (2026-10-08); they are
not part of the game code.

Ghost sisters models and look target (dev only, not in the build):
- `tools/meshy/meshy.mjs` + `prompts.json`: Meshy text-to-3D and auto-rig (key in `.env`).
- `tools/meshy/ghost-anims.mjs`: clips idle, walk (glide), raise, attack, hurt, die →
  `artifacts/meshy/ghost_*_anim.glb`.
- `tools/meshy/boss-showcase.html` (vite dev server): every move of the four phases with
  stand-in FX, for technical-artist to rebuild in `src/classes/fx/`.
