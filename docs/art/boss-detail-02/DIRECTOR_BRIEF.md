# Meshy map bosses, levels 50–100 — director brief

## Scope and authority

Create six distinct Meshy bodies for the existing expedition bosses below. The
user authorized this batch after upgrading the credit balance to 2,080; the parent
owns references, paid generation, Blender authoring, runtime integration and QA.
This brief does not spend credits or approve an unseen asset. No procedural body
substitution counts as a completed Meshy model.

Follow [GAME_VISION](../../GAME_VISION.md), [world monster rules](../../world/MONSTERS.md),
[current progression](../../world/LEVEL_PROGRESSION.md),
[ART_BIBLE](../ART_BIBLE.md), [BOSS_ENCOUNTERS](../../technical/BOSS_ENCOUNTERS.md)
and [performance guidance](../../technical/PERFORMANCE_BUDGET.md), in that order.
Legacy art and existing procedural shape labels are not visual authority.

Implementation evidence: `src/world/expeditions.js`,
`src/combat/data/expedition-monsters.js`, `src/combat/data/monsters.js`,
`src/combat/data/boss-skills.js`, `src/combat/BossSkillVFX.js` and
`src/combat/MonsterModels.js`. The six identities are already level 50/60/70/80/90/100,
each with `boss: true`, `elite: true` and outer `size: 2`. The Naga retains its
water element, Dusk its fire element, and the other four their existing dark
element; visual earth/wind/stone motifs do not authorize a stat change.

Preserve server stats, summons, loot, maps, encounter sites, movement, collision,
attack footprints, timing and damage. Asset hashes/cache versions may change to
deliver the new models. All twelve deployed primary-boss VFX themes stay intact;
this batch supplies bodies for six of those themes and twelve existing attacks.

## Art gate and shared visual language

Target **Style Match >= 8/10, Readability >= 8/10 and Technical Usability >= 8/10**.
Previous night scores of 7 do not waive this target. Record body defects separately
from native fog, canopy or UI occlusion, but do not label an occluded view an 8/10
readability pass. An unobserved state remains untested. Compare like daylight
phases before attributing a visibility improvement to material fill.

Use soft stylized 3D consistent with the reviewed Meshy monsters: broad anatomy,
large costume blocks, restrained painted shading and selective Thai crowns,
cloth, scales, feathers and weapons. Prioritize the orthographic 2.5D camera and
390x844 touch view. Avoid photoreal skin, dense filigree, crushed-black bodies,
European dragon/knight silhouettes and ornamental detail that disappears in game.
Do not invent readable sacred text. Three or four major colour masses should
identify each boss before face detail becomes visible.

## Six body directions and scale goals

These are **initial art goals, not existing GLB measurements or collision sizes**.
World height includes the rest crest/crown/horns. All six currently have outer
scale 2, so the runtime normalizer is `worldHeight / 2`; do not multiply twice.
Measure imported geometry and swept clip bounds before final framing. Foot/coil
contact starts at lift 0; solve geometry and poses rather than adding lift to hide
floor penetration. Body origins sit beneath the planted stance or central coil,
not the combined weapon, wing or trailing-tail bounding-box centre.

| Runtime identity / existing habitat | Distinct Thai silhouette and painted blocks | Expected anatomy and prop count | Initial world scale goal / normalizer |
|---|---|---|---|
| `sunken_city_3` — นาคราชเฝ้าประตู, Lv50; นครบาดาล Lv40–50 | One upright serpent neck above a readable low coil, broad Thai flame-shaped crest, flowing brow and layered scale bands. Jade/teal `#3c8c83`, pale warm belly `#d9d2a8`, selective gold `#c9a34e`; keep the neck brighter than the teal ground. No dragon muzzle, humanoid torso or limb-like fins. | **1 head, 1 continuous serpent body ending in 1 tail; 0 arms, 0 legs, 0 wings.** Jaw and crest are identifiable; coil openings are genuine gaps, not disconnected rings. | Height **3.2 m**, normalizer **1.60**; rest coil footprint about **3.8 m** across. Tail length is measured separately, not used to enlarge collision. |
| `dusk_fort_3` — เจ้าอสูรสนธยา, Lv60; ป้อมอสูรสนธยา Lv50–60 | Upright Thai demon lord with an angular flame-crown profile, broad collar and red sash over compact armour. Vermilion `#a9362c`, gold `#d1a548`, warm charcoal `#443537`; keep fire-red distinct from the Rift's violet. Forearm sweep suggests a fire blade without requiring an extra physical weapon. | **1 head, 2 arms, 2 hands, 2 legs, 2 feet; 0 wings, 0 tail.** Five digits per hand: thumb plus four fingers. No added sword/club or extra limbs for the skill name. | Height **3.6 m**, normalizer **1.80**; shoulders about **1.45 m** wide. |
| `giant_valley_3` — ยักษ์เฝ้าหุบเขา, Lv70; หุบเขายักษ์ Lv60–70 | The widest grounded biped: Thai yaksha face, paired tusks, heavy square shoulders, short substantial crown and wrapped trousers. Moss/stone green `#647357`, sandstone `#b29a70`, muted gold `#c9a255`. One thick Thai-style club supplies an unmistakable diagonal mass. | **1 head, 2 arms, 2 five-digit hands, 2 legs, 2 feet; 0 wings, 0 tail; 1 club in the right hand.** Left hand remains visibly separate. Club grip, fingers and shaft must be independently legible. | Height **4.2 m**, normalizer **2.10**; shoulders about **1.9 m** wide; club about **2.3 m** long. |
| `himmapan_3` — พญาปักษาทมิฬ, Lv80; ป่าหิมพานต์ Lv70–80 | Thai Garuda interpretation: hooked bird head, upright chest, humanlike arms, claw feet and **two separate folded wings behind the shoulders**. Broad feather tiers rather than hair/fur or individual feather noise. Deep blue-teal `#365b70`, warm ivory `#dfd3ad`, gold `#caa34f`; pale wing bands break the forest silhouette. | **1 bird head, 2 arms, 2 five-digit hands, 2 legs, 2 avian feet, 2 wings.** Deliberate hybrid: hands are not wings. Each foot has **3 forward toes plus 1 rear toe**; no duplicate feet, wing-hands or extra shoulder arms. No long decorative tail required. | Height **3.8 m**, normalizer **1.90**; folded wing width about **2.8 m**, bounded cast spread about **4.2 m**. No airborne lift is assumed. |
| `fallen_city_3` — ขุนพลอาคม, Lv90; นครอาคมล่มสลาย Lv80–90 | Tall, disciplined Thai ghost general: narrow upright crown/helmet, clean indigo shoulders, white cloak/cloth panels and a single curved Thai dha. White `#ddd9c7`, indigo `#334873`, gold `#c9aa58`; silhouette slimmer than the Giant and more ordered than the Rift. No European plate knight, straight broadsword or generic skeleton soldier. | **1 head, 2 arms, 2 five-digit hands, 2 legs, 2 feet; 0 wings, 0 tail; 1 curved sword in the right hand.** Left palm gives the command gesture. No added shield. | Height **3.6 m**, normalizer **1.80**; shoulders about **1.35 m** wide; sword about **1.5 m** long. |
| `demon_rift_3` — เจ้าอสูรรอยแยก, Lv100; ประตูรอยแยกอสูร Lv90–100 | Thai cosmic demon with a high coloured crown framed by **one pair of substantial horns**, a diamond-shaped shoulder mantle and tapered waist. Dark amethyst `#604273`, bone ivory `#d9cfb5`, crown magenta `#ae537d` with restrained gold. Keep face, hands and chest panels readable against the violet terrain; no uniformly black body. | **1 head, 2 arms, 2 five-digit hands, 2 legs, 2 feet, exactly 2 horns; 0 wings, 0 dragon tail, 0 weapon props.** Crown points must not read as extra horns. | Height **4.0 m**, normalizer **2.00**; shoulders about **1.65 m** wide. |

Scale goals are subordinate to measured source anatomy and native-camera
readability. Keep the Giant broadest, Commander slender, Garuda recognizably
winged and Naga unmistakably serpentine; increasing every height is not a remedy
for missing silhouette separation. Report any proposed scale revision explicitly.

## Twelve existing attack presentations

The rows below are copied from current `BOSS_SKILLS`, not proposed combat changes.
All cones have angle `Math.PI * .65` (**117 degrees**), self origin and locked
facing: **1.8 s windup / 8 s cooldown / 1.5x power**. All listed circles are
target-aimed with locked origin: **2.0 s / 9 s / 1.35x**. All rings are self-origin:
**2.4 s / 11 s / 1.4x**. Preserve the existing recovery, phase cadence and damage
authority as well; a new body animation must not retime these systems.

| Boss / existing skill ID and Thai name | Authoritative footprint | Body gesture and retained production detail |
|---|---|---|
| Naga `breath` — ลมหายใจนาคราช | Cone radius **8 m** | Lift/brace the neck, open the jaw and direct a readable breath gesture along locked facing. Retain scale ornament and wave impact; do not make the painted breath imply a larger hit region. |
| Naga `undertow` — คลื่นนาคราช | Ring **3.5–10 m** | Compress and release the coil/neck to suggest water pressure. Existing scale lines/waves stay in the dangerous annulus; the safe centre remains visibly empty. |
| Dusk `blade` — ฟันสนธยา | Cone radius **7 m** | Broad forearm/body sweep with open hands and a bounded flame-blade gesture. Retain flame ornament and blade impact; avoid a thin frontal elbow silhouette. |
| Dusk `brand` — ตราเพลิงอสูร | Target circle radius **4 m** | Open-palmed command toward the already locked target. Retain flame ornament/impact without a persistent fire hazard or invented debuff. |
| Giant `club` — กระบองสะเทือนผา | Cone radius **8 m** | Readable club preparation and downward sweep; rigid shaft stays in the actual gripping hand. Retain earth ornament/impact; no arm stretching to reach the whole cone. |
| Giant `quake` — แผ่นดินยักษ์ | Ring **3.5–10 m** | Grounded body compression, stomp or club settling cue. Retain earth lines and stone fragments only inside the annulus; no false centre hit. |
| Garuda `feathers` — ขนปักษาสังหาร | Cone radius **9 m** | Hands remain distinct while the folded wings make a small deliberate spread/flick. Retain feather ornament/impact; no new projectile hit logic or flight requirement. |
| Garuda `gust` — ลมหมุนหิมพานต์ | Target circle radius **4.5 m** | Small wing/chest gathering gesture toward the locked circle. Retain feather detail; avoid an opaque tornado that hides the warning or a wing span that obscures the whole body. |
| Commander `command` — คมดาบราชองครักษ์ | Cone radius **8 m** | Clear dha sweep with visible hilt/hand contact and a stable edge. Retain blade ornament/impact; no cloth or sword deformation to fake reach. |
| Commander `mandala` — ค่ายกลนครล่ม | Ring **3.5–10 m** | Free palm commands while sword stays controlled beside the body. Retain blade ornament and abstract seal impact; keep the safe hole and avoid fabricated sacred writing. |
| Rift `rupture` — รอยแยกกลืนวิญญาณ | Target circle radius **5 m** | Both open hands gather, then release a compact chest/arm gesture. Retain shard ornament/impact; no new terrain crack collider, lingering damage or limb-like crystals. |
| Rift `eclipse` — วงสุริยคราสอสูร | Ring **4–11 m** | Crown/horns frame an outward arm command with grounded feet. Retain shard detail in the annulus; no opaque eclipse dome across the safe centre. |

Red danger fill and gold boundaries remain primary, including particles-off mode.
Terrain sampling, locked aim and the ring safe hole are mandatory. Preserve the
existing <=2 additional VFX draws per active marker, no new lights/bloom/global
fog, and no per-frame geometry allocations. Only authoritative impact events may
produce impacts; local visual expiry cannot produce an impact or damage. Cancel,
death, despawn, map changes and expiry release owned GPU resources.

## Static anatomy review before binding

Inspect the actual generated surface from front, side, back, top, underside and
game angles. References are intent; they do not prove generated anatomy. Preserve
the rejected candidate and provenance if any source fails. Diagnose it before a
new paid attempt; do not hide an extra limb, missing palm or disconnected tail
with camera choice, pose, cloth or binding.

- Count all heads, limbs, hands, digits, toes, wings, horns and props against the
  table. Check left/right shoulder, elbow, hip, knee and foot heights for unwanted
  asymmetry; intended costume/weapon asymmetry must not distort the skeleton.
- Capture both palm and back-of-hand views close enough to resolve **one thumb
  and four fingers**, webbing and wrist attachment. A small image is unresolved,
  not five-finger acceptance. Preserve source digits as rigid hand blocks unless
  a separately approved finger rig is needed; no corrective finger posing.
- Inspect pelvis/crotch, cloth inner seams and underarms for fused limbs, tunnels,
  stretched bridges or hidden duplicate branches. Check forward soles/toes, rear
  avian toes and knee bend directions independently of clothing.
- Naga: follow continuous neck–coil–tail volume from several angles, preserving
  genuine coil gaps. Reject disconnected loops, forked tail/extra head, an
  impossible flattened neck or self-intersection masked by the crest.
- Garuda: independently identify the two arm roots and two wing roots; inspect
  wing-shoulder continuity, folded-wing/body clearance and feather layering.
  Wings must not swallow a hand or read as two additional humanoid arms.
- Club/sword: inspect the actual palm, grip, hilt/shaft and blade edge. Preserve
  the entire prop's rigid shape, including blade tip and guard; avoid diffusion
  into forearm, thigh or crotch. A weight-label gap is not proof of a physical
  contact gap, and a shared pivot is not proof of actual surface contact.

## Rig, five clips and native acceptance

Use measured species-specific rigs and explicit finite normalized weights with
at most four influences. Biped IK and pole targets use actual joints and foot
rest bases; the Naga uses a continuous serpent chain rather than human retargeting.
Garuda wings have their own controls distinct from arms. Club/sword are rigidly
attached to the verified gripping hand. No baked correction may quietly replace
the original source used for anatomy/UV provenance.

Ship separate **idle, walk, attack, hurt and die** clips:

- Idle: readable living identity, balanced stance/coil and restrained secondary
  motion; planted soles do not slide. Naga jaw/crest and Garuda wings retain shape.
- Walk: in-place locomotion with plausible feet or coil travel, stable body mass
  and controlled props/wings. Do not claim terrain slope IK or world-speed matching
  unless implemented and measured.
- Attack: a cast arc visible from frontal and native camera views, with outward
  elbow separation and source volume preserved. The current controller shares
  one attack clip between a boss's two skills; VFX supplies skill identity. Do not
  promise new per-skill animation routing as part of this asset batch.
- Hurt: brief recoil distinct from both attack and death, without neck/collar,
  palm, crotch or wing-root pinching.
- Die: an unmistakable held defeated state before native hiding. Bipeds bow and
  crouch/settle with guarded IK; Naga lowers its neck onto a supported coil; Garuda
  folds its wings and settles. Keep sword/club and horns clear of the floor. Do not
  pull a tail or wing root away from its attached body to cancel root movement.

Review the exact delivered GLB through the native controller at authored keys and
24 Hz for all five clips. Preserve existing indexed-edge gates: edges >=5 mm fail
when **ratio >2 AND extension >1 cm**. Preserve 5 mm limb-length, 1 mm planted-foot
and 1 cm source-floor limits; record the native world-floor check separately after
normalizer and outer scale. Naga foot checks are not applicable, not fabricated
passes; substitute measured coil/neck/tail continuity and supported ground contact.
Record triangle-area contraction to diagnose pinches that extension checks miss.
Do not loosen tolerances to make the model pass.

For club/sword, retain **1 cm maximum physical rigidity drift and 8 cm maximum
actual surface contact gap**, sampling blade/shaft/hilt and the true palm across
all five clips. If semantic weights cannot identify those surfaces, use bounded
source samples with exact hashes, unambiguous UV provenance and separate hand/prop
sets; prove equivalent bone transforms where relevant. Do not substitute a pivot
distance or select only the nearest convenient vertex.

Capture idle and actual cast extremes plus hurt/death, front/side and native game
views. Log both requested time and actual action/clip time: an `attack` filename
or a near-idle frame does not prove the cast peak was inspected. Use correct pose
captions. Death material dimming is useful feedback, not a substitute for a
recognizably defeated pose.

## Delivery budgets and evidence

Default per shipped boss: **one opaque material/atlas, one skinned draw, <=15,000
indexed triangles and <=3,000,000 bytes (3 MB) for the complete packed GLB**,
including textures and five clips. Club, sword, crest and folded wings share the
budget. No alpha feather cards or microgeometry merely to simulate surface detail.
A Garuda wing exception needs a specific visual need, explicit revised totals and
measured native/mobile cost; wings are not an automatic extra-draw/size allowance.

Verify decoded base-colour textures, GLB reopen, exact source/export/public hashes,
clip names, weights, bounds and budgets. Keep editable Blender sources, immutable
job receipts and anatomy/UV provenance. Runtime instances own their skeletons,
materials and clocks; cached geometry/textures survive instance disposal. Scoped
painted emissive fill must preserve independent hit/status intensity and restore
its baseline map/colour/intensity; no global lighting workaround.

Provide a concise per-boss Art/Tech review with >=8 targets, failures and untested
states stated explicitly, numeric native report, genuine mobile-touch evidence
(`isMobile` and `hasTouch`), and bounded desktop/mobile actual-server captures when
natural bosses are available. Record boss server identity, loaded state and natural
clock/terrain; do not force spawns, time or player movement to manufacture proof.
Studio evidence does not establish online damage/authority or physical-device FPS.
Preserve night/fog/canopy findings rather than replacing them with a daylight pass.
Finish with required build/check results and a task-branch PR; this document itself
does not claim any generated body, animation, runtime or deployment acceptance.
