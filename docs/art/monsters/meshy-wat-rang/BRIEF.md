# Wat Rang monster set

Date: 2026-10-09. Source of truth: GAME_VISION, current combat spawns and
ART_BIBLE. Original designs requested by the user; these images are design
references, not historical reconstructions or final runtime screenshots.

## Scope

Seven models: Headless (6), Pret (6), Krahang (7), Krasue (7), Phitaihong (7),
Soldier (8), Pusom (boss 10). Reuse the reviewed Pray/Winyan forest models.
Environment geometry, encounters, loot, collision and boss skill rules stay
outside this asset batch. Wat Rang's advertised travel band is 4–8; its boss
definition is level 10.

## Thai identity and readability

| Creature | Shape and Thai cues | Motion intention |
|---|---|---|
| Headless | Closed empty neck, ivory wrap vest, brick-red jong kraben, dark woven sash | Heavy two-handed shove; grounded walk |
| Pret | Narrow lilac silhouette, long coherent limbs, huge palms, tiny mouth, indigo waist cloth | Long-arm sweep; restrained planted idle |
| Krahang | Human body, two bamboo rice-winnowing trays, rice-pestle tail, teal cloth trousers | Hover and tray flaps; hands retain grips |
| Krasue | Floating Thai woman's head, black hair, compact stylized hanging heart/lungs/intestine loop | Hover, head lunge and soft trailing movement |
| Phitaihong | Lean ash-grey villager, white ritual thread, cream shoulder cloth with red woven border | Cautious gait and forward strike |
| Soldier | Thai pointed cloth helmet, ochre trousers, restrained bronze flame emblem, round shield and dha | Sword slash with guarded left side |
| Pusom | Broad elderly treasure keeper, white beard, ivory cloth, gold lotus/flame accents, jade trousers | Commanding open-hand attack/summon gesture |

The user's Krasue correction explicitly rejects the initial silk-ribbon/crystal
interpretation. It must not ship. A subsequent front-view generation became a
flat relief and also fails acceptance. The replacement reference shows a
three-quarter view to communicate a complete skull and rounded hanging forms.
Traditional folklore proportions are intentional; random joint distortion,
extra limbs or a flattened head are not.

Original procedural props are visual references only. The selected designs use
an empty sealed neck instead of a carried head, a dha instead of a spear, and
Pusom's command hands instead of a staff. This changes no combat parameters.

## Acceptance gate

- Front, side, back and elevated game views must preserve each creature's
  intended anatomy, costume, silhouette and correct hand/prop contact.
- No folded-back fingers or wrists. Whole source palms retain their authored
  shape; no unverified finger retargeting.
- Skull must have genuine volume; Krasue depth must exceed 20% of source height.
- Embedded textures, one draw per model, under 15,000 triangles and 1.8 MB.
- Five independent lowercase clips: idle, walk, attack, hurt, die; loop seams
  must match, all vertices and weights must remain finite and normalized.
- Grounded idle foot drift below 1.5 mm in exported source units; limb length
  error below 5 mm; grounded skin penetration below 1 cm on a flat plane.
- Hovering models retain explicit runtime lift. Validate their actual normalized
  ground clearance and outer monster scale; a raw source bob is not foot drift.
- Evaluate every actual indexed surface edge >=5 mm in every clip/keyframe and
  at 24 Hz: reject extension >1 cm combined with length ratio >2.
- Shield must remain visibly on the guarding side and face forward (+Z). Sword
  stays in its hand; rigid trays must not become rubber sheets.
- Art, readability and technical scores each >=8/10 before merge/deploy.

## Limits to report

No facial/finger rig, per-skill animation, cloth simulation or ragdoll. Standard
attack clips also serve casting. Flat-floor measurements do not establish
terrain foot IK or physical-phone performance. Boss warning footprints remain
grounded and independent of the model's height/lift.
