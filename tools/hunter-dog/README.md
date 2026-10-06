# น้องหมาของนายพราน (hunter's dog)

`public/models/hunter-dog.glb` is the Tripo model (Thai Ridgeback, red collar), rigged by
Tripo (`tripo::Spine_*`, `tripo::Head_*`, `tripo::{0,1}_{Left,Right}_Limb_*`, tail `bone_2`,
`tripo::Tail_*`, ears `bone_14/15`). It has **no clips**: `src/classes/dog.js` poses the bones
from code every frame (trot ↔ gallop, bite lunge, idle, tail wag, spirit glow), so the same
dog serves the in-game pet (`src/combat/CombatView.js`) and skill 6 ลมใต้ปีกครุฑ
(`src/classes/fx/hunter-skills.js`). Leg indices: `0_` front, `1_` hind.

Export from Blender (armature `dog 3d model` + mesh `tripo_node_5704143b`, ~4.5k tris):
selection only, GLB, +Y up, skins on, no animations, WebP textures (≈320 KB).
The model faces −Y in Blender (= +Z in glTF/three).
