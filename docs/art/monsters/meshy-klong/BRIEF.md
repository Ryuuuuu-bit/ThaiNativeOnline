# Klong — phase 1 croc; full ten-identity director plan

Date: 2026-10-09. Director brief for `codex/meshy-klong`, based on
`origin/main` revision `8243754`. This document retains the full-map director
plan and defines the croc-only first implementation phase. It is not an asset
approval.

## Authority and scope

Authority, in order: `docs/GAME_VISION.md`, `docs/world/*`, `docs/art/*`,
`docs/technical/*`. Apply `ART_BIBLE.md`, `CHARACTER_GUIDE.md`, `CAMERA_GUIDE.md`
and `MATERIAL_GUIDE.md`. Carry forward the budgets and deformation gates in
`docs/art/monsters/meshy-wat-rang/BRIEF.md` and its final reviewed workflow.
Older designs may inform names and lore; they are not the visual authority.

**This PR completes only `croc`**, including its existing generated candidate,
anatomy, five clips, runtime integration and independent Art/Tech acceptance.
The other nine identities remain queued; completing croc does not complete the
map. Parent confirms 205 credits before the completed 35-credit croc generation,
with **170 remaining**. This sidecar performs no new generation and awaits fresh
captures of the actual GLB for art review.

Full-map plan: replace the ten existing identities of **คลองหนองบึง (`klong`, Lv.10–25)**
with original, stylized Thai-fantasy Meshy models and five runtime clips each.
Membership is verified against `src/data/spawns.js::combatSpawns()`,
`src/data/hunting.js`, `src/world/maps.js` and
`tools/monster-models/meshy/map-queue.json`. Gameplay values come from
`src/combat/data/monsters.js`; the separate legacy rules roster is not this
map's combat definition.

The habitat is reed beds, freshwater pools, klong banks, an abandoned stilt
hamlet, a banana grove and Chalawan's lagoon. The map has twelve marked hunting
pockets. Its creatures carry the route from ordinary marsh hunts to ranged
spirits, charging demons, a stationary elite and the primary boss.

Preserve IDs, names, levels, races/elements, stats, movement speed, attack range,
aggro, collision, picking IDs, target rings, spawn membership/counts/phases,
respawn, rarity, XP, drops, summons, progression and boss rules. This is an art
replacement. No swimming, underwater traversal, new debuffs, new encounters or
environment changes are implied. This sidecar writes only this brief; source,
tools, references and generated assets are outside its editing scope.

## Locked roster, purpose and scale

`size` is the existing outer multiplier in 3D mode. At base revision `8243754`,
Klong had **no entries in `MONSTER_MODELS`**. Height/lift targets below use the
existing `MONSTER_SPRITES` world-height anchors for initial comparison. Croc's
world-height target is **0.60m**: parent's corrected GLB setting is
`MONSTER_MODELS.height = 0.6 / 1.3`, followed by the locked 1.30 outer multiplier.
This records a presentation setting, not a validated loaded asset. The other
nine GLB settings remain queued. The initial 0.90m loaded target made the 5.5m
long animals overlap at the existing pack density; independent live-scene
readability was 6.5/10. The revised target gives about 3.67m length. The heel
repair passed the unchanged native flat-floor gate at 0.90m before this art
scale change; lowering scale does not replace a source repair. Final 0.60m
game/mobile readability passed the independent final review at 8/10. The other
nine identities are not approved by this Croc review.

| ID / Thai name | Level / locked size | World height / lift target (m) | Existing purpose and habitat |
|---|---|---|---|
| `croc` / จระเข้บึง | 13 / 1.30 | 0.60 / 0 | Armoured ordinary melee beast on `croc_bank`; 1.6m range, 30% knock chance; also Chalawan's summoned minion |
| `leech` / ปลิงควาย | 11 / 0.75 | 0.55 / 0 | Entry marsh/reed threat at `leech_reeds` and `hunt_marsh_edge`; contact attack, existing poison 4 HP/s for 4s |
| `wraith` / ผีพรายน้ำ | 12 / 1.00 | 1.80 / 0.20 | Water spirit at `wraith_pool` and `hunt_marsh_edge`; existing blue ranged bolt at 5m and 10 MP drain |
| `python` / งูเหลือมดงอ้อ | 14 / 1.25 | 0.90 / 0 | Reed-bed heavy melee snake at `python_grass`; 1.8m range and slow 2.4s attack interval |
| `phong` / ผีโพง | 15 / 1.00 | 1.90 / 0.20 | Fast melee spirit at `phong_marsh`; calls existing nearby spirits within 12m when combat starts |
| `klom` / ผีตายทั้งกลม | 17 / 1.10 | 1.90 / 0 | Melee spirit at `klom_reeds` and `hunt_south_spirits`; existing poison 10 HP/s for 5s |
| `kumphi` / กุมภีล์ | 19 / 1.55 | 2.10 / 0 | Heavy crocodilian demon at `kumphi_bank`; existing charge and 1.7m melee range |
| `nangram` / ผีนางรำ | 22 / 1.00 | 1.90 / 0 | Evasive ranged spirit in `nangram_field`, `hunt_south_spirits` and three additional Klong pockets; gold bolt at 5m, EVA 35 |
| `tani` / นางตานี | 20 / 1.40 | 2.20 / 0 | Stationary banana-grove elite at `tani_grove`; speed 0, 6m pull, 12 MP drain, existing circle/ring skills |
| `chalawan` / ชาละวัน | 25 / 2.40 | 2.00 / 0 | Primary lagoon boss at `chalawan_lagoon`; charge, 40% knock, summons two `croc` at 60%/30% HP; existing cone/ring skills |

The player is approximately 1.8m tall. Measure height from the visible neutral
surface; keep long animals readable through body width and length, not an
artificially raised neck. Chalawan must read as the largest **bulk/footprint**
and the boss despite Kumphi's taller height anchor. Review their side-by-side
silhouettes before generation approval.

The sprite path already carries its own height; the GLB path additionally
applies `def.size`. To reproduce these world targets with the existing GLB
loader, its future normalized height/lift must be world target divided by
`size`. Do not copy sprite numbers directly and multiply them again. Calibrate
actual visible bounds, planted contacts and hover clearance after decoding;
never change combat range or collision to compensate for oversized art.

Preserve the **effective** roster, including hunting-pocket overrides. Phong
currently appears in all phases through the regional hunt despite the older
dusk annotation; do not impose a new night-only rule. Klom has different
day/night base counts. Tani remains a night encounter with 420s respawn and an
elite content flag; Chalawan remains the designated primary boss, always active,
with 1200s respawn. Preserve the existing boss-area/channel treatment without
adding a `boss` content flag to Tani or changing card probabilities.

## Concrete identity and anatomy direction

Use soft stylized 3D forms, broad hand-painted colour regions, controlled
roughness and readable shadows with ambient fill. Human spirits use roughly
5–6-head proportions, coherent limbs and recognizably Thai cloth silhouettes.
Identity must survive the elevated 2.5D camera, night lighting and mobile
framing without dependence on captions, particles or tiny ornament.

| Identity | Selected shape, palette and Thai cues | Required anatomy and attack read |
|---|---|---|
| Croc | Low, broad freshwater crocodile; blunt elongated snout, olive back, cream belly, large rounded scute rows, heavy tapering tail. Thai marsh identity comes from local freshwater habitat and animal form; undecorated body. | Exactly four short, splayed limb chains, one continuous tail, separate upper/lower jaws and visible eyes. Neutral mouth slightly parted; readable bite with chest thrust and recoil. Must differ from the forest monitor in head width, jaw mass and back armour. |
| Leech | Thick curved olive-brown soft body, ochre underside, broad simplified annular bands, small front mouth disc and larger rear sucker. A readable enlarged marsh animal. | No legs, arms, horns or snake head/hood. Two distinct end suckers and a continuous rounded body. Low creeping compression and short mouth-first extension; no exposed anatomical gore. |
| Wraith | Pale turquoise Thai woman, dark hair in broad damp locks, blue-teal wrapped shoulder cloth and long indigo skirt with a simple woven border. Clear face and sleeves; one continuous human body. | Two arms and two legs beneath coherent cloth; hands remain visible outside hair. Hover/glide with a compact forward palm cast. Keep a distinct blue-water silhouette from the approved jade `pray` model. |
| Python | Heavy, low reticulated-pattern snake in ochre/earth brown, cream underside and broad dark geometric patches; shallow loose S-curve rather than an upright cobra display. | One uninterrupted tubular body with a defined head, neck and tapering tail; no hood or limbs. Rounded coils retain thickness, gaps and real depth. Slow head-first strike; no constriction/grab mechanic is added. |
| Phong | Lean Thai male villager, burnt-orange waist cloth/jong kraben, dark sash, grey-brown skin and a compact amber nose glow. Keep a full human figure and readable face. | Two arms/two legs, coherent wrists and palms. Restless hover, forward hand/claw strike and a broad calling gesture using the standard attack. Glow is a restrained identity cue; no flame body, detached head or point-light dependency. |
| Klom | Thai female spirit with an intentional pregnant abdominal silhouette, rounded shoulders, long dark hair, dusty rose shoulder wrap and muted plum sarong. A composed supernatural villager design. | Continuous torso, plausible abdomen/pelvis transition, two arms/two legs, balanced stance. Grounded cautious walk and restrained open-hand strike. Preserve pregnancy as identity without body rupture, exposed fetus, extra child geometry or accidental waist pinching. |
| Kumphi | High-chested, muscular crocodilian demon; dark moss skin, heavy jaw, broad shoulders, larger rounded scutes and a compact bronze brow accent. Its mass and ridge silhouette distinguish it from ordinary croc. | Four weight-bearing limb chains and one heavy tail; complete crocodilian jaw, no humanoid arm retargeting. Lower the chest into a forceful forward bite/charge read; paws and tail retain volume. No handheld weapon. |
| Nangram | Thai dance-inspired female spirit; tiered gold chada silhouette, ivory/gold fitted upper cloth, red-gold shoulder drape and deep red lower cloth. Broad costume blocks and controlled dance posture distinguish her from the other women. | Two arms/two legs with coherent elbows; fingers may retain a gentle authored curve, wrists must remain plausible. Grounded restrained stepping, deliberate palm-forward ranged cast. Use whole palms; avoid extreme finger bending, welded hands or sharp costume flaps obscuring joints. |
| Tani | Banana-grove guardian: Thai woman in a fresh leaf-green shoulder wrap and darker green sarong, black hair, pale face, restrained gold belt, broad banana-leaf shapes around a compact stationary base. | Two arms and a complete clothed lower body. Banana leaves have rounded thickness and stay distinct from teak roots/Takian's silhouette. Stable grounded base, gentle upper-body motion and open-hand pull/cast; base is model geometry, not new map collision. |
| Chalawan | Massive royal crocodile, deep jade/olive back, ivory jaw/belly, wide gold Thai-fantasy brow crest and two or three large flame/lotus accents. Broad head and shoulder mass, strong full tail; clear royal hierarchy over croc/Kumphi. | Four legs, one tail and a volumetric articulated jaw. Bite/forward command motion supports cone attack and summoning; tail/body recoil supports the existing ring cast. Crest remains solid and stable. No handheld prop, added human form or transformation requirement. |

These are original game designs, not historical costume reconstructions. Keep
Thai details selective and legible; no dense filigree, copied legacy sprite
costumes, photographic skin/scales, giant bloom or baked black shadows.
For every reference, show one whole creature against a plain background in a
three-quarter view that explains volume. Do not bake reeds, water, pedestals,
ground planes, labels or detached effects into the Meshy creature.

## Phased production priority

1. **Croc first, alone.** Approve its original reference, generate one candidate,
   then complete jaw/limb/tail anatomy, five clips, budgets and actual gameplay
   review before expanding the batch. This establishes the quadruped and summoned
   minion quality bar. A usable croc does not approve Kumphi or Chalawan by proxy.
2. **Marsh animals and water threat:** leech, python, wraith, then Kumphi.
   Reuse proven workflow and anatomical rig principles; preserve each identity's
   own geometry, UVs and validated weights.
3. **Humanoid spirit group:** Phong, Klom, Nangram. Check bright frontal attack
   extremes early to catch elbow/shoulder narrowing and cloth/hand fusion.
4. **Elite and boss:** Tani, then Chalawan, using the approved family language.
   Verify their existing grounded warnings, stationary/charging presentation and
   Chalawan's croc summons without changing gameplay rules.

A phase may deliver fewer identities while budget is resolved; keep the complete
ten-entry roster explicit and mark every ungenerated/unreviewed identity pending.
Do not report the map complete after only its ordinary crocodile passes.

## Resource constraint and provenance

The Wat Rang review records **205 Meshy credits at its last postgeneration
check**, not a live balance. Its successful Image-to-3D tasks cost 35 credits
each. At that historical cost, ten new tasks would need **350 credits before
retries**, 145 above that recorded balance. Five such tasks would cost 175;
this arithmetic is a planning constraint, not a current price or affordability
claim. Parent owns generation authorization, live balance and current task-cost
verification. This brief neither submits paid tasks nor authorizes purchases.

Select/review references before paid submission. Preserve exact reference,
task/source/runtime hashes, parameters and actual charged costs. Recover an
uncertain task outcome rather than submitting a duplicate. Keep original source
assets and packed editable final rigs so animation/weight fixes do not require
paid regeneration. No credentials, session descriptors or signed download URLs
belong in this brief or committed provenance.

## Five clips and motion constraints

Each delivered GLB has independent lowercase `idle`, `walk`, `attack`, `hurt`,
`die` clips. Idle/walk loop seamlessly; attack/hurt/die are finite one-shots
compatible with the existing controller and fades. Animate in place: server
movement, charge, knockback and projectile timing remain authoritative.

- Grounded models: planted idle, anatomy-specific walk and controlled death
  settle. Tani still supplies a valid five-clip contract; its walk is a restrained
  stationary variant because gameplay speed is zero.
- Wraith/Phong: authored hover/glide plus explicit runtime lift. Death settles
  within measured clearance; do not depend on source bob alone to avoid terrain.
- Crocodilians: separate jaw, neck/chest, four leg chains and segmented tail;
  opening jaws retain complete mouth volume. No generic human leg/arm rig.
- Leech/python: continuous axial deformation; no fabricated feet or humanoid
  skeleton. Grounded body/sucker contacts replace foot checks where appropriate.
- Humanoids: preserve whole source palms, relaxed fingers and continuous elbow,
  shoulder, hip and knee contours. Keep hair/cloth weights anatomically local.
- Standard attack also serves current casting. No new per-skill animation system,
  face/finger rig, cloth simulation, ragdoll or slope IK is required by this batch.

## Acceptance before integration approval, merge or deploy

- Independent Style Match, Readability and Technical Usability **each >=8/10**
  for every identity. A numerical skin pass cannot close a visible collapsed
  joint, flattened skull, fused limb or unreadable species silhouette.
- Static front, side, back, three-quarter and elevated game views show complete
  volume and correct anatomy. Inspect bright moving front/side views at attack
  extremes plus game/night/mobile views; include the full swept visible bounds.
- Preserve source limb/palm shape, joint width and coherent costume boundaries.
  No folded-back wrists/fingers, needle elbows, collapsed jaw interiors,
  flattened coils, missing legs or stretched armour/crest. Intentional species
  proportions do not excuse accidental deformation.
- Same Wat Rang delivery budget: **under 15,000 triangles, one material draw,
  under 1.8MB per runtime GLB**, embedded textures, no external image dependency;
  target 1024px colour/512px normal, four or fewer finite normalized influences.
  Use nonmetal organic surfaces and broad roughness; pack small gold accents
  into the same material instead of adding draws or transparent layers.
- Grounded idle foot/contact drift **<1.5mm** in exported source units;
  articulated limb-length error **<5mm** where applicable. Grounded skin
  penetration **<1cm on a flat plane**, validated again after runtime
  normalization and outer scale. Explicitly report axial-body contact checks
  and any criterion inapplicable to footless species.
- Evaluate every actual indexed surface edge initially **>=5mm**, across every
  clip/keyframe and a **24Hz** sampling grid. Reject an edge whose extension is
  **>1cm combined with length ratio >2**. Keep thresholds unchanged; inspect
  joint compression visually even when extension checks pass.
- Validate actual normalized hover clearance, complete limb/jaw/tail motion,
  idle/walk seams, finite vertices and bounded model motion. Rigid costume
  accents stay rigid. Any later added held prop needs explicit surface/contact
  evidence and visual grip review; none is required by these selected designs.
- Verify decoded textures, one visible surface draw per model, independent
  skeletons/mixers/materials, stable picking IDs, neighbour isolation, damage
  flashes, death restoration and disposal through the existing runtime loader.
- Actual Klong evidence must identify loaded authoritative monster IDs and
  artifact hashes, cover applicable phases including night Tani, and inspect
  existing combat, flat contacts, uneven terrain and mobile framing. Validate
  boss warning footprints independently of model bounds/lift; fixtures do not
  establish that live casts or summons were observed.
- Deliver a hash-verified packed editable source with all expected rigs,
  surfaces/actions and fresh reopen evidence; source/runtime screenshots and
  five-clip videos must correspond to the exact final exports. Run the project
  tests/build for implementation changes and retain exact results and failures.

## Limits that final reports must retain

Flat-plane acceptance does not establish terrain-following foot/body IK.
Record additional uneven-terrain contact failures without changing tolerances,
arbitrarily lifting grounded creatures or relabelling failed reports as passed;
assess their shipping significance against this explicit flat-plane scope.
Keep missing rare/night instances, unobserved live casts/summons and fixture-only
checks labelled separately. Mobile framing screenshots and software-rendered
browser timing do not establish physical-phone performance or crowd capacity.
Per-skill motion, precise individual finger articulation, cloth simulation,
ragdolls, swimming and historical costume accuracy remain outside this brief.
