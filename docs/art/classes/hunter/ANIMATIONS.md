# นายพราน — animations

Model: `public/models/hunter.glb`, built by `tools/hunter-anims/compose.mjs` from
`tools/hunter-anims/hunter-tripo.glb` (see `tools/hunter-anims/README.md`). The bow is
part of the model, parented to the left hand. Right-handed archer: bow in the left hand,
string drawn to an anchor under the jaw with the right.

| # | Skill | Clip | Length (s) | Release (s) | Pose |
| --- | --- | --- | --- | --- | --- |
| 1 | ศรฉับไว | `hunter_shot` | 1.0 | 0.40 | turns side-on, nock, quick draw, release |
| 2 | ศรพิษพรานไพร | `hunter_shot` | 1.0 | 0.40 | (same clip, green arrow) |
| 3 | ศรทะลวงเกราะ | `hunter_power` | 1.4 | 0.90 | down on the right knee, slow heavy draw, held |
| 4 | ตาเหยี่ยว | `hunter_hawk` | 1.6 | 0.80 | bow raised high, right hand shading the eyes |
| 5 | ห่าฝนธนู | `hunter_sky` | 1.3 | 0.60 | aimed ≈55° up, leaning back |
| 6 | ลมใต้ปีกครุฑ | `hunter_garuda` | 1.8 | 0.90 | arms spread like wings, up on the toes, wings beat down |
| 7 | ศรกระจายเจ็ดดาว | `hunter_volley` | 1.2 | 0.47 | full draw, the release sweeps across (arrows fan) |
| 8 | กับดักหนามพราน | `hunter_trap` | 1.4 | 0.60 | deep crouch, the right hand skids the trap away |
| 9 | ศรสังหารเหยี่ยวราตรี | `hunter_snipe` | 2.0 | 1.33 | long aim, breath held, recoil step on the release |
| 0 | ศรเพลิงอัคนีบาต | `hunter_meteor` | 2.0 | 1.10 | step back, leaning far back, arrow straight up |

Also `idle` (bow held upright at the left hip), `walk` / `run` (the fighter's Tripo
locomotion, same skeleton), `hurt`, `die`.
