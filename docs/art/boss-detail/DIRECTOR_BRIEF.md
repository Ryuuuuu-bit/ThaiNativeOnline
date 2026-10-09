# Map boss detail — director brief

The user requires Meshy for every new model and approved the first three missing
models by level: Chalawan (25), graveyard keeper (30), mine guardian (40).
This batch uses 105 credits and leaves 30; no further generation is included.
All twelve primary bosses receive skill ornament and impact effects. Preserve the
approved buffalo, Takian and Pu Som. The six higher-level missing boss models
remain pending Meshy generation; their existing bodies are not new assets.
The discarded procedural prototype is not used.

Follow GAME_VISION, ART_BIBLE and BOSS_ENCOUNTERS. Preserve stats, collision sizes,
spawns, loot, skill footprints, timing, damage and server authority. Prioritize
silhouette, broad cloth/armor color blocks and selective Thai details visible
from the game camera. No new lights, bloom or opaque screen fog.

| Boss | Meshy direction | Skill detail |
|---|---|---|
| Chalawan | Human crocodile king; two arms, two legs, scaled human face, fangs, continuous crocodile tail, Thai royal cloth | Swept fangs, water crests |
| Graveyard keeper | Thai elder spirit, bamboo crown, mantle, amulets, wrapped trousers, sandals; open hands without staff | Bamboo nodes, abstract ritual seals |
| Mine guardian | Thai stone yaksha, two arms/two legs, tusks, crown, stone armor, jade seal, wrapped trousers; open hands without weapon | Fissures, falling fragments |

Chalawan's hybrid is a deliberate game interpretation. Thai literature describes
his human and crocodile transformations: [SAC literature directory](https://thailitdir.sac.or.th/character-detail.php?n_id=921).

Inspect actual Meshy front, side, back, top and game views. Validate limb count,
continuity, face, palm/thumb direction, planted soles and tail attachment.
Preserve source fingers as rigid hand blocks; no individual finger posing.
Bind measured editable biped bones, explicit normalized weights (<=4 influences)
and planted-foot IK through registered Blender commands. Author five independent
idle/walk/attack/hurt/die clips. Chalawan's origin stays under his body rather
than at the combined body-and-tail bounding-box centre.

Other effects: buffalo earth/horns; Takian roots/leaves; Pu Som abstract seals;
Naga water/scales; dusk general blades/flames; giant earth/horns; Garuda feathers;
commander seals/blades; rift lord shards. Do not invent readable sacred text.
Use <=2 additional draws per active marker and no per-frame geometry allocations.
Red fill and gold boundary keep the shared circle/cone/ring footprint. Sample
terrain, keep ring centres empty, and subordinate ornament to danger warnings.
Only authoritative impact events show impact detail; visual clocks cause no damage.
Cancellation/expiry/map changes release geometry, materials and instance buffers.

Asset gates: one material/draw per body, <15,000 triangles and existing mobile
asset budget. Verify snapshot/export hashes, GLB reload, normalized weights,
deformation/feet/floor checks, desktop/touch screenshots, focused/full tests,
production build, Art/Tech review and a task-branch PR.
