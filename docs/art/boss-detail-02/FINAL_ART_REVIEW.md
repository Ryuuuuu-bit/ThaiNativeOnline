# Boss art review — current quality revisions and historical findings

Reviewed 2026-10-09 on the task branch. **All six leading quality sections are current, bounded PASS verdicts for their exact hashes. No confirmed gross anatomy or body-readability P1/P2 was found in the inspected current samples.** The five earlier sections below them preserve historical findings. [ANIMATED_ART_REVIEW.md](ANIMATED_ART_REVIEW.md) also remains historical. Canonical PNG paths can be refreshed, so each verdict belongs to the asset identity and capture receipt at review time. Historical links may now display a newer image; the stored old scores/hashes are not a claim that those old receipts remain canonical.

**Art merge/deploy recommendation: proceed with the six exact current asset hashes below.** This bounded review has no remaining confirmed art blocker. The 30 fresh compression witnesses are complete; exact-surface occlusions and untested volume/continuous-motion claims remain documented limitations, not a demand for more Blender sessions or all-angle certification. No further capture or model revision is requested by this review. Parent reports the final full suite at **461 tests passing** and the build at **233 modules**; the full suite was not rerun by this reviewer.

The [ART_BIBLE](../ART_BIBLE.md) targets of Style, Readability and Technical Usability >=8 remain unchanged. The current broad body gate reaches those targets in representative studio and matching native views; numerical passes alone did not supply the visual judgment. Native scores describe the particular natural view, not a requirement that every side/back angle show a weapon grip or both wings. The failed first Commander skin-boundary revision and intermediate failing Garuda/Giant revisions remain rejected. This is bounded body art acceptance, not full animation, VFX, live combat or performance certification.

| Current model | Style | Anatomy | Sampled five-state readability | Native desktop / touch body identity | Tech |
|---|---:|---:|---:|---|---:|
| Naga final v4 | 8.5 | 8.5 | 8 | 8 /8, **night** | 8.5 |
| Dusk quality | 8.5 | 8 | 8 | 8 /8, **evening** | 8 |
| Giant quality-v2 | 8.5 | 8 | 8 | 8 /8, **day** | 8 |
| Garuda quality-v2 | 8.5 | 8 | 8 | 8 /8, **day** | 8 |
| Fallen quality | 8.5 | 8 | 8 | 8 /8, **evening** | 8 |
| Rift quality | 8 | 8 | 8 | 8 /8, **night** | 8 |

These are bounded observational grades, not measured FPS or all-frame/all-angle proof. Fine weapon/face detail and local triangle area/volume remain separately limited below. In particular, current Giant/Garuda daylight evidence does not establish their current night grade.

## CURRENT — Dusk quality revision

**Bounded Style/Anatomy/Pose/Technical PASS; no confirmed gross-anatomy or body-readability P1/P2 in inspected samples.** The stronger chin/upper-body recoil is now visible relative to idle, and the supported forward crouch remains clearly distinct at the die endpoint. This supersedes the earlier Dusk v4 sampled-hurt finding for this new hash only; it does not erase the historical 7.5 witness.

**Public GLB SHA-256:** `e570992477ed5a48f59382f333b6739f6b01dc0c1c82ddc29697b79b1ca9a36a`. Public bytes independently match [animated metadata](../../../tools/monster-models/meshy/dusk_fort_3-animated.json), all 29 [studio rows](dusk_fort_3-capture.json) and all 14 [direct rows](dusk_fort_3-extremes.json), with zero receipt errors. Representative current poses were visually inspected across all five clips, front/side/back/top/game: all five game states, direct side/game hurt and final die, both side walk samples, front hurt, back die and top attack. This is not a claim of inspecting all 43 pose images or a continuous timeline.

| Criterion | Current bounded score / result | Evidence |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Red/gold flame crown and shoulders, ivory sash and boots; same approved Meshy source identity. |
| Visible anatomy / sampled skin | **8 / PASS** | Two arms/hands and two legs/feet; no visible elbow needle, cuff/waist tear, reversed palm/foot or broken knee in inspected states. |
| Studio body identification | **8.5 / PASS** | Broad shoulders, crown and large red/ivory costume blocks remain recognizable. |
| Sampled five-state presentation | **8 / bounded PASS** | Small alternating steps, outward casting forearms, chin/torso recoil and endpoint forward crouch can be distinguished. Walk/recoil remain restrained; continuous timing and native combat distinction are untested. |
| Final defeat | **8 / bounded PASS** | Head/torso forward drop and bent knees separate the endpoint from idle without an observed gross skin break. |
| Native desktop / touch identification | **8 /8, bounded evening PASS** | New matching natural evening views retain crown/shoulder/sash/boot separation. Fine face/trim detail is fog-limited. |
| Technical usability | **8 / bounded PASS** | 12,495 triangles, one material draw, 1,581,120 bytes; supplied unchanged five-clip gates pass. |

**Actual pose witnesses:** [game idle](dusk_fort_3-game-idle.png) at **0.552632 s**; [game walk](dusk_fort_3-game-walk.png) at **.3 s** and [side .25](dusk_fort_3-side-walk-0_25.png)/[side .75](dusk_fort_3-side-walk-0_75.png); [game attack](dusk_fort_3-game-attack.png) at **.6 s**; [direct game hurt](dusk_fort_3-game-hurt-0_22.png)/[direct side hurt](dusk_fort_3-side-hurt-0_22.png) at **.22 s**; [side endpoint die](dusk_fort_3-side-die-1_3.png)/[game endpoint die](dusk_fort_3-game-die-1_3.png) at actual **1.0 s**, speed 1.4. Canonical die is .924 s; filename 1.3 is requested controller time. Hurt shows an upward chin and upper-body lean compared with idle, most clearly in profile. Frontal reaction is smaller; no facial/finger articulation or all-angle reaction visibility is claimed. The supplied whole-mesh source displacement for hurt increased to **.1090 m**, versus idle .0422 m; this complements the visual difference and is not a localized peak or perceptual score by itself.

**New matching native receipts appeared during this review and were inspected:** [native receipt](dusk_fort_3-actual-game-capture.json), SID **583**, natural `mlist`, `remote=true`, alive/model loaded, exact network SHA above, zero errors. Same desktop 1440x940 and genuine touch-emulation 390x844 native-angle camera-follow/zoom 1.6 helper; no player/monster/clock mutation. Both rows are **evening, night=0, natural fog .01275**. They supersede the canonical old-hash night images as current evidence; they do not establish night performance of this quality revision.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:17:37.623 | **17:28**, 17.482 h | [PNG](dusk_fort_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:18:04.569 | **17:59**, 17.98683 h | [PNG](dusk_fort_3-actual-game-mobile.png) |

PNG hashes at review: desktop `97747b49b8de4512469f28f096227d34b881e57207d236898a6f18858f336259`; mobile `bce3134b50df654d9f51cb317370c803a3dd3d8cd5bfe9be8843044940d153a3`.

**Supplied technical evidence, read-only:** [runtime report](dusk_fort_3-runtime-qa.json), all exported keys +24 Hz, actual indexed edges >=5 mm, unchanged failure conjunction ratio >2 AND extension >1 cm. All five clips report zero failures; maximum ratio **1.969579** (die), maximum arm/leg length error **.0136 mm**, worst flat clearance **-.310 mm**, normalized-weight sum error about 1.11e-16, decoded textures 1024/512 square. Rest world target **3.6 m**, fill .35 and fog scale .45. Minimum area ratio .023215 at die .8 s is still not an independently certified exact-triangle area/volume result; existing edge gates are not weakened. Fresh production VFX rows are pinned by the studio receipt but were not visually rescored in this body-focused slice. Continuous animation, night/native combat state distinction and physical-device FPS remain untested.

## CURRENT — Fallen commander quality revision

**Bounded Style/Anatomy/Pose/Sword/Technical PASS; no confirmed gross-anatomy or body-readability P1/P2 in inspected samples.** The valid new body preserves the curved Thai sword, coherent hilt grip and white/indigo/gold identity through the sampled clips. The former failed forearm-cuff/waist mask revision is not accepted or reclassified by this verdict.

**Public GLB SHA-256:** `6fc4a6fad3cb82d4ebfd85ac0e71e99f22598b4fb8e49355c3f748e2fb3c8e0e`. Public bytes independently match [animated metadata](../../../tools/monster-models/meshy/fallen_city_3-animated.json), all 29 [studio rows](fallen_city_3-capture.json) and all 14 [direct rows](fallen_city_3-extremes.json); receipts have zero errors. Current representative visual review covers all five game states, side idle/hurt/final die, paired side walks, front hurt/attack, back die and top attack. Static source grip and two blade-edge close-camera witnesses were also re-inspected separately, using their immutable source-hash folder. This does not claim all 43 pose images, every triangle or continuous animation were visually inspected.

| Criterion | Current bounded score / result | Evidence |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Thai crown, curved dha, indigo costume, white sash/leg blocks and gold trim; distinct ghost-general identity. |
| Visible anatomy / sampled skin | **8 / PASS** | Two arms/hands, two legs/feet, no wings; coherent face/spine/waist/cuffs and natural free-hand orientation. Grip hides some fingers as expected; source digit proof is separate. |
| Studio identification / sampled state presentation | **8.5 /8, bounded PASS** | Crown, white panels and sword identify the body; compact blade/forearm cast, backward chin/torso recoil and forward endpoint bow are distinguishable in representative angles. |
| Sword silhouette / visible grip / cutting edge | **8 / bounded PASS** | Continuous curved metal blade, narrow edge, intact guard/hilt and plausible source palm contact; no observed prop detachment or bent blade in sampled poses. |
| Final defeat | **8 / bounded PASS** | Pronounced forward torso/head slump with a supported stance distinguishes the endpoint. No fully kneeling/prone pose is claimed or required. |
| Native desktop / touch body identification | **8 /8, bounded evening PASS** | Crown/white-indigo costume remains readable in both natural orientations; phone sword/grip detail remains an explicit limitation. |
| Technical usability | **8 / bounded PASS** | 12,465 triangles, one material draw, 1,484,852 bytes; five supplied unchanged gates pass, including rigid sword/hand matrices. |

**Actual five-pose witnesses:** [game idle](fallen_city_3-game-idle.png) at **.868421 s**; [game walk](fallen_city_3-game-walk.png) at **.3 s** with [side .25](fallen_city_3-side-walk-0_25.png)/[side .75](fallen_city_3-side-walk-0_75.png); [game cast](fallen_city_3-game-attack-0_5.png) at actual **.5 s**, plus [front cast](fallen_city_3-front-attack.png)/**.6 s** and [top cast](fallen_city_3-top-attack.png)/**.6 s**; [direct game hurt](fallen_city_3-game-hurt-0_22.png)/[side hurt](fallen_city_3-side-hurt-0_22.png) at **.22 s**; [side endpoint die](fallen_city_3-side-die-1_3.png)/[game endpoint die](fallen_city_3-game-die-1_3.png) at actual **1.0 s**, speed 1.4. Recoil/cast are compact, most legible in profile and compared with idle; this is not a sweeping sword-strike or continuous timing proof. The supplied whole-mesh hurt/idle maxima are both about .1173 m source: the sword/hand contribution makes that scalar unsuitable as independent torso-recoil evidence, so the visual comparison supplies the bounded pose judgment.

**Sword/grip/edge source provenance:** static prepared source SHA `4cffa6372241f1d7c0012dabc0b00f7af05c990318136c456e2adcc2740cdf8b`, still matching [prepared metadata](../../../tools/monster-models/meshy/fallen_city_3-prepared.json). Independently re-inspected [thumb-side grip](static-source/fallen_city_3/4cffa6372241f1d7c0012dabc0b00f7af05c990318136c456e2adcc2740cdf8b/grip-thumb.png), [blade face](static-source/fallen_city_3/4cffa6372241f1d7c0012dabc0b00f7af05c990318136c456e2adcc2740cdf8b/blade-edge-face.png) and [blade oblique](static-source/fallen_city_3/4cffa6372241f1d7c0012dabc0b00f7af05c990318136c456e2adcc2740cdf8b/blade-edge-oblique.png). The palm wraps the hilt, the guard separates hand/blade, and the thin curved edge remains continuous to the point. These are actual source close-camera renders, not enlarged full-body pixels. Runtime top/front/back samples complement that source proof; no new close-runtime contact-distance measurement was run. Rigid matrix equality alone is not proof of physical palm contact. Side death overlaps sword and shin in projection; other inspected angles retain a separate blade silhouette, and this is not confirmed 3D penetration.

**New matching natural native evidence:** [receipt](fallen_city_3-actual-game-capture.json), SID **971**, first desktop observation `mspawn`, touch observation `mlist`, remote/alive/modelLoaded true, exact network SHA above, zero errors. Same native-angle camera-follow helper and genuine touch context; no forced combat, movement, spawn, clock or damage manipulation. Both rows are **evening, night=0, natural fog .01275**.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:17:52.642 | **17:48**, 17.81075 h | [PNG](fallen_city_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:18:16.371 | **18:09**, 18.15475 h | [PNG](fallen_city_3-actual-game-mobile.png) |

PNG hashes: desktop `2ea37440fdc105f62e790867de9b93edb8ec8c4852fcaa40b4541e09ee80b919`; mobile `e045662cca4fbc6966be7e739068d8cebb7a6b7d8367ef212a0521a85b29436b`. In the phone's natural near-edge-on orientation the narrow blade overlaps the legs and the grip/edge is too small to certify; retain a **7.5 weapon-detail witness** as a limitation of that view, not a body-identity failure or a demand that every side/back angle expose the grip. Fine face/trim detail is also fog-limited. Native combat pose distinction and night visibility remain untested for this exact revision.

**Supplied technical evidence:** [runtime report](fallen_city_3-runtime-qa.json), all keys +24 Hz, five clips zero failures under unchanged edge/arm/leg/foot/floor/rigid-prop gates. Maximum edge ratio **1.798669** (die), maximum arm/leg length error **.0153 mm**, worst flat clearance **-.185 mm**. Maximum sword/HandR skin-matrix difference is **1.0626e-7**, approximately 1.1e-7, within the existing **.0001** bound; do not round it into a stricter claimed <=1e-7 measurement. Normalized weights have about 1.11e-16 sum error; textures decode at 1024/512 square. Rest world height **3.8 m**, standing pivot [.091,-.275], authored facing -.325863, fill .35/fog scale .45. Minimum area ratio **.048131**, die .633333 s, remains outside independent exact-surface area/volume proof. No skin/collision/stat/threshold change was made by this review. Fresh production VFX were not visually rescored here.

## CURRENT — Rift quality revision

**Bounded Style/Anatomy/Pose/Technical PASS; no confirmed gross-anatomy or body-readability P1/P2 in the inspected new samples.** Backward head/torso recoil is now visible in profile and at the game angle, while the endpoint forward slump lowers the head/horns and changes the torso silhouette more clearly than the historical revision. The compact cast is retained; no sweeping arm action, kneeling/prone death or altered geometry is invented as a requirement.

**Public GLB SHA-256:** `5f622db6ac315aa0632e5ddc8f2a35a944daff830236fbc8872bb39a3316371a`. Public bytes independently match [animated metadata](../../../tools/monster-models/meshy/demon_rift_3-animated.json), all 29 [studio rows](demon_rift_3-capture.json) and all 14 [direct rows](demon_rift_3-extremes.json); receipts have zero errors. Current visual scope includes all five game states, side idle/hurt/final die and top attack. It does not claim all 43 pose PNGs, every transition or every local triangle were inspected.

| Criterion | Current bounded score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8 / PASS** | Thai crown/trim, paired ivory horns and dark-amethyst/bone-ivory blocks retain the approved wingless cosmic-demon identity. |
| Visible anatomy / sampled skin | **8 / PASS** | Two arms/hands, two legs/feet, two horns, zero wings; coherent elbows, palms, waist/cuffs and supported feet in inspected states. |
| Studio body identification | **8.5 / PASS** | Large ivory chest/shins and horn/shoulder outline remain legible. |
| Sampled five-state presentation / final defeat | **8 /8, bounded PASS** | Backward chin/torso recoil, compact raised casting palms and the stronger forward endpoint slump are distinguishable from idle in representative angles. Recoil/walk remain modest; continuous/native combat timing is untested. |
| Native night desktop / touch identification | **8 /8, bounded PASS** | Ivory silhouette/trim remains identifiable against blue night ground. Phone profile hides much of the front chest/face; small purple material detail is fog-limited. |
| Technical usability | **8 / bounded PASS** | 12,504 triangles, one material draw, 1,496,980 bytes; five supplied unchanged edge/arm/leg/foot/floor gates pass. |

**Exact pose witnesses:** [game idle](demon_rift_3-game-idle.png) at **.5 s**; [game walk](demon_rift_3-game-walk.png) at **.3 s**; [direct game attack](demon_rift_3-game-attack-0_5.png) at **.5 s**; [direct game hurt](demon_rift_3-game-hurt-0_22.png)/[side hurt](demon_rift_3-side-hurt-0_22.png) at **.22 s**; [side final die](demon_rift_3-side-die-1_3.png)/[game final die](demon_rift_3-game-die-1_3.png) at actual **1.0 s**, speed 1.4. The new direct receipt has exact requested .35/.5/.7 attack times; the historical .0769 s offset does not apply. Canonical die remains .924 s. Profile hurt shows the chin/upper body moving back with supported feet; endpoint die shows the inverse forward slump. Source maximum hurt displacement is **.1051 m**, versus idle .0653 m, complementary to the visual comparison and not a localized strongest-frame proof. The historical state-contrast 7.5 is superseded for this hash in the inspected studio samples, not erased.

**Matching natural night PNGs were inspected:** [native receipt](demon_rift_3-actual-game-capture.json), SID **777**, remote/alive/loaded true, natural server observation, exact network SHA above, zero errors. Same native-angle desktop/touch camera-follow helper, no player/monster/clock mutation. Both rows have **night=1, fog .01675**, with per-instance fog scale .45. The profile phone view limits front anatomy/face detail; this is not a demand that both horns and both hands be exposed at every angle.

| View | Capture UTC | Receipt natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:23:54.061 | **23:48**, 23.81658 h | [PNG](demon_rift_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:24:06.994 | **23:59**, 23.99118 h | [PNG](demon_rift_3-actual-game-mobile.png) |

PNG hashes: desktop `72d517ea399a61a760d14547eccdbb00f1da340ee9f40a3e3d490160a8bfb960`; mobile `af0ae4c135164750ed9f9b08b4337e160d064732ba3f8ec70b6bc9ae405272f7`.

**Supplied numerical evidence:** [runtime report](demon_rift_3-runtime-qa.json), keys +24 Hz, unchanged gates, zero failures in all five clips; maximum edge ratio **1.990100** (attack), **1.788576** (die), maximum arm/leg length error **.0182 mm**, worst flat clearance **-.288 mm**. This new report explicitly lists arm and leg segments, superseding the historical report's leg-only scope. Rest target **4.2 m**, fill .35/fog scale .45. Minimum area ratio remains **.067340** at attack .633333 s and is not a certified all-triangle area/volume pass. Fresh VFX were not independently rescored in this body-focused slice. Native combat reaction/defeat, continuous motion, exact foot-surface contact on unseen terrain and physical-device FPS remain untested.

## CURRENT — Naga final v4

**Bounded Style/Anatomy/Pose/Technical PASS; sampled recoil P2 CLOSED for this exact revision.** At actual hurt .22 s, the head/hood clearly lifts and moves back relative to idle while the coil outline and contact stay fixed. It is a readable reaction without observed hood/neck collapse. The already distinct forward defeat remains intact. No new gross anatomy defect was found in inspected current samples.

**Public GLB SHA-256:** `4fa20542ebb027ee11295de31a39892c332a4b1811e9460e2d628af84c965bea`. Public bytes independently match [animated metadata](../../../tools/monster-models/meshy/sunken_city_3-animated.json), all 29 filtered Naga [studio rows](sunken_city_3-capture.json) and all 14 [direct rows](sunken_city_3-extremes.json), zero errors. Current visual scope: all five game states, side idle, direct side/game hurt, final side/game die and both fresh native PNGs. Historical full v3 review is not substituted for unchecked v4 frames; this is representative bounded inspection, not all 43 pose PNGs or a continuous timeline.

| Criterion | Current bounded score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Gold Thai crest/hood trim, jade scale mass, ivory belly and continuous legless coil. |
| Visible anatomy / sampled skin | **8.5 / PASS** | One continuous head/neck/body/tail, zero arms/legs/wings; broad hood volume and coil openings remain coherent during the inspected recoil and defeat. |
| Studio identification | **8.5 / PASS** | Crown, pale upright belly and open coil silhouette remain clear. |
| Sampled five-state distinction / hurt | **8 /8, bounded PASS** | Recoil visibly straightens/lifts the upper neck and moves the head back; attack lowers/advances the hood; walk is a restrained neck sway over a planted coil. |
| Final defeat | **8.5 / bounded PASS** | Strong bowed head/hood over the fixed coil remains clearly distinct from idle. |
| Native night desktop / touch identification | **8 /8, bounded PASS** | Fresh exact-v4 views retain crown, ivory belly, coiled body and tail-tip identity in natural night fog; fine green scales/face remain dark. |
| Technical usability | **8.5 / bounded PASS** | 12,548 triangles, one material draw, 1,559,336 bytes; supplied unchanged gates pass with zero grounded-coil drift. |

**Current exact witnesses:** [game idle](sunken_city_3-game-idle.png) at **.657895 s** and [side idle](sunken_city_3-side-idle.png); [game walk](sunken_city_3-game-walk.png) at **.3 s**; [game attack](sunken_city_3-game-attack.png) at **.6 s**; [direct game hurt](sunken_city_3-game-hurt-0_22.png)/[side hurt](sunken_city_3-side-hurt-0_22.png) at **.22 s**; [game final die](sunken_city_3-game-die-1_3.png)/[side final die](sunken_city_3-side-die-1_3.png) at actual **1.0 s**, speed 1.4. Direct times now match their requests rather than the historical warm-up offset. Hood/head movement is visibly greater than in v3's historical near-idle witness; the sampled reaction reaches 8. Jaw/finger articulation is not claimed. Source maximum hurt displacement is **.3942 m**, versus idle .03365 m; the visual neck/head comparison supplies the readability judgment, not this scalar alone.

**Fresh exact-v4 native night evidence is now available and was inspected:** [receipt](sunken_city_3-actual-game-capture.json), SID **486**, remote/alive/modelLoaded true, exact network SHA above, zero errors, same native-angle camera-follow desktop/touch helper. Both rows have **night=1, fog .01675**, per-instance fog scale .45. No player/monster/clock mutation. These current v4 PNGs supersede v3's night witnesses for current identification; the historical v3 scores/hashes stay below.

| View | Capture UTC | Receipt natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:25:59.156 | **01:58**, 1.97883 h | [PNG](sunken_city_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:26:11.429 | **02:09**, 2.1515 h | [PNG](sunken_city_3-actual-game-mobile.png) |

PNG hashes: desktop `4d8200ef01aace421b2ce7f3e61a11f15f56f0814d7221f8cea6d2d2d3677c6f`; mobile `658532d030366fba06d0b13d215d66be6ac023067af11b5b0a808e3e6f93aadd`. **Clock precision limitation:** the desktop PNG HUD shows 01:49 while its receipt records 01:58. Both establish natural night, but the receipt clock is not certified frame-exact for that PNG. No forced clock is inferred, and the exact network model hash remains matched. Phone profile exposes a meaningful neck/coil silhouette while its face/scale detail stays fog-limited; the desktop includes another serpent whose pixel identity is not independently labeled.

**Supplied numerical evidence:** [v4 runtime report](sunken_city_3-runtime-qa.json), keys +24 Hz, unchanged indexed-edge conjunction, five clips zero failures; maximum hurt ratio **1.153002**, maximum overall ratio **1.630606** (die). All five clips report **7,820 grounded-coil vertices, zero maximum drift**, within the unchanged .0015 m source bound; flat clearance is approximately zero. Weight-sum error zero; decoded textures 1024/512 square, rest world height **3.2 m**. Minimum hurt area ratio **.756356**, minimum overall **.349539** (die), complements but does not replace independent local skin/volume judgment. Fresh production VFX were not independently rescored here; continuous transitions, native combat recoil, terrain/canopy elsewhere and physical-device FPS remain untested.

## CURRENT — Giant quality-v2

**Bounded Style/Anatomy/Pose/Technical PASS.** The club now gives a clear cast silhouette, the head/upper-body reaction is distinguishable from idle, and the endpoint torso/head slump is stronger than the historical shallow bow. No gross elbow needle, limb inversion, waist tear, missing prop or visible club bend/detachment was found in inspected current samples.

**Public GLB SHA-256:** `bbbb0fc757216a69b1fcfff649e300010e8bf4b007c9f85b6338a7d81d546915`. Public bytes match [animated metadata](../../../tools/monster-models/meshy/giant_valley_3-animated.json), all 29 [studio rows](giant_valley_3-capture.json), all 14 [direct rows](giant_valley_3-extremes.json) and both network-loaded [native rows](giant_valley_3-actual-game-capture.json); zero receipt errors. Visual inspection covered representative poses in every clip: game idle/walk/attack/hurt/die, front cast, side idle/cast/hurt/final die, and both current native PNGs. This does not claim all 43 pose images or continuous transitions were viewed.

| Criterion | Current bounded score / result | Basis |
|---|---|---|
| Thai style / consistency | **8.5 / PASS** | Broad green yaksha, gold Thai crown/tusks/trim, ivory sash/trousers and real gold club preserve a distinct Thai silhouette. |
| Visible anatomy / sampled skin | **8 / PASS** | Two arms/hands and legs/feet, broad forearms and coherent club contact; no gross broken knee, elbow or waist in inspected states. |
| Studio identification | **8.5 / PASS** | Shoulder breadth, tusked crown, ivory costume mass and club are immediately distinct. |
| Sampled five-state presentation | **8 / bounded PASS** | Modest walk step, forward diagonal club cast, visible profile chin recoil and supported forward defeat separate from idle. Continuous movement and native combat distinction are untested. |
| Final defeat / club presentation | **8 /8, bounded PASS** | Forward torso/head slump and bent knees are visible; club shaft/head remain continuous with the gripping hand. Closed-grip fingers are partially occluded in body views. |
| Native desktop / touch identification | **8 /8, bounded DAY PASS** | Green/gold/ivory blocks and yaksha outline remain recognizable in the current natural daylight views. Fine grip and face detail are limited. |
| Technical usability | **8 / bounded PASS** | 12,489 triangles, one material draw, 1,437,052 bytes; supplied unchanged five-clip gates pass. |

**Actual pose comparisons:** [game idle](giant_valley_3-game-idle.png) at **1.026316 s**, [game walk](giant_valley_3-game-walk.png) at **.3 s**, [front cast](giant_valley_3-front-attack.png) at **.6 s**, [game cast](giant_valley_3-game-attack-0_5.png)/[side cast](giant_valley_3-side-attack-0_5.png) at **.5 s**, [game hurt](giant_valley_3-game-hurt-0_22.png)/[side hurt](giant_valley_3-side-hurt-0_22.png) at **.22 s**, and [side endpoint die](giant_valley_3-side-die-1_3.png)/[game endpoint die](giant_valley_3-game-die-1_3.png) at actual **1.0 s**, speed 1.4. The club changes from near-vertical idle to a forward diagonal cast while the free hand opens. Reaction is clearest in profile; the endpoint head/torso lowers with supported knees. The club trails behind the body in the final profile, and its game-view occlusion is not a missing-prop finding. Whole-mesh displacement can be dominated by the club and is not a localized body-reaction score.

The approved prop-v2 Meshy source remains `59bbe3cc594674a293a78616da7805c972b9b3f258f468645a7e2a38d422481d`, with the source-camera grip/digit witnesses recorded in [STATIC_ART_REVIEW.md](STATIC_ART_REVIEW.md). Missing-club original source remains rejected. Current sampled grip continuity plus skin-matrix equality do not certify every dynamic hand surface or a new centimetre contact measurement.

**Fresh native evidence:** natural `mlist` SID **874**, remote/alive/modelLoaded true, exact network SHA, zero errors. Native-angle camera-follow/zoom 1.6, desktop 1440x940 and genuine touch-emulation 390x844; no player/monster/clock mutation. Both rows are **day, night=0, fog .01275**. The desktop includes overlapping naturally spawned Giants; the phone is mostly profile, with the shaft/grip partly behind the body. Isolated studio/source views provide limb counts and grip proof. This closes the bounded current body-identification grade, not current night or all-angle weapon-detail acceptance.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:35:03.418 | **10:59**, 10.99092 h | [PNG](giant_valley_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:35:30.695 | **11:29**, 11.48942 h | [PNG](giant_valley_3-actual-game-mobile.png) |

PNG hashes: desktop `c27194318b271c6c7329d22445a4b6b27f963157232fe75d8b958e905d299f63`; mobile `c64a5798ebd69963c8e4876995f28279812ea25185fd1b7aba8361c75a9363c3`.

**Supplied technical evidence:** [runtime report](giant_valley_3-runtime-qa.json), all keys +24 Hz, indexed edges >=5 mm, unchanged ratio >2 AND extension >1 cm conjunction; five clips zero failures. Maximum ratio **1.949622** (die), attack **1.923887**; arm/leg length error **.0198 mm**, worst flat clearance **-.169 mm**. Club/HandR skin-matrix maximum difference **1.1283e-7**, within the unchanged **.0001** bound. Decoded textures 1024/512 square, normalized weight sum error about 1.11e-16; rest world target **4.0 m**, fill .35/fog scale .45. **Local compression remains unproven:** minimum area ratio **.003322**, triangle **8114**, die **.766667 s**. Fresh target-neighborhood closeups are reviewed below; exact indexed-triangle visibility remains limited, and an edge pass is not an all-triangle area/volume pass. No arbitrary new area threshold or weakened edge gate is introduced. Fresh VFX, continuous transitions, unseen terrain, native combat animation and physical-device FPS were not independently certified here.

## CURRENT — Garuda quality-v2

**Bounded Style/Anatomy/Pose/Technical PASS.** The current reaction lifts the beak/head visibly relative to idle and the final torso/head slump is clearer than the historical standing bow. Separate hands/arms, a pair of wings and claw feet remain coherent through inspected cast/reaction/defeat views. No gross frontal elbow needle, reversed palm, broken wing root, waist tear or limb inversion was found.

**Public GLB SHA-256:** `87187a592ed037f2e3a394db3f8fe7fc484d8b0388eb2dd273ccffd3d80ffd45`. Public bytes match [animated metadata](../../../tools/monster-models/meshy/himmapan_3-animated.json), all 29 [studio rows](himmapan_3-capture.json), all 14 [direct rows](himmapan_3-extremes.json) and both network-loaded [native rows](himmapan_3-actual-game-capture.json); zero receipt errors. Visual inspection covered all five game states, side idle/hurt/final die, front/back cast and both current native PNGs. This is representative inspection, not all 43 images or a continuous timeline.

| Criterion | Current bounded score / result | Basis |
|---|---|---|
| Thai style / consistency | **8.5 / PASS** | Gold Thai bird crest/beak, teal and ivory feathers, gold costume trim and claw feet retain a distinct Garuda identity. |
| Visible anatomy / sampled skin | **8 / PASS** | Two hands/arms, two legs/claw feet and two separate wings; broad elbows, continuous wing roots and coherent forward slump in inspected views. |
| Studio identification | **8.5 / PASS** | Crest/beak, pale chest and long ivory-edged wing silhouette are clear. |
| Sampled five-state presentation | **8 / bounded PASS** | Modest stepping, outward/open casting hands, upward chin recoil and settled forward defeat differ from idle at the inspected times. Continuous timing remains untested. |
| Final defeat | **8 / bounded PASS** | Torso/beak forward slump with bent knees and supported claw feet is visibly stronger than the historical upright bow. |
| Native desktop / touch identification | **8 /8, bounded DAY PASS** | Bird head, ivory chest and wing silhouette remain identifiable; profile, fog and overlapping bosses limit fine face/arm detail. |
| Technical usability | **8 / bounded PASS** | 12,528 triangles, one material draw, 1,578,368 bytes; supplied unchanged five-clip gates pass. |

**Actual witnesses:** [game idle](himmapan_3-game-idle.png) at **1.026316 s** and [side idle](himmapan_3-side-idle.png); [game walk](himmapan_3-game-walk.png) at **.3 s**; [game cast](himmapan_3-game-attack-0_5.png) at **.5 s**, [front cast](himmapan_3-front-attack.png)/[back cast](himmapan_3-back-attack.png) at **.6 s**; [game hurt](himmapan_3-game-hurt-0_22.png)/[side hurt](himmapan_3-side-hurt-0_22.png) at **.22 s**; [side endpoint die](himmapan_3-side-die-1_3.png)/[game endpoint die](himmapan_3-game-die-1_3.png) at actual **1.0 s**, speed 1.4. Front cast resolves bent forearms and open palms separately from the wings without a needle silhouette. The side reaction raises/leans the beak/head back; defeat bows the torso/head forward and modestly bends the knees. Exact claw-surface contact throughout locomotion is not established by these stills.

**Wing scope:** the wings trail broadly in a semi-splayed rest silhouette and move with the body; they are not tightly folded in these witnesses. Two wing roots are coherent in isolated front/back views. No independently animated flap/fold or transition is claimed, and equality to the Body skin matrix is not proof of wing articulation. Source close-camera digit witnesses remain in [STATIC_ART_REVIEW.md](STATIC_ART_REVIEW.md); full-body hand views do not resolve all five digits at every clip time.

**Fresh native evidence:** natural `mlist` SID **680**, remote/alive/modelLoaded true, exact network SHA, zero errors; same native-angle desktop/touch follow helper. Both rows are **day, night=0, fog .01275**. The desktop has two overlapping naturally spawned Garudas, so apparent extra wings belong to separate characters; anatomical counts come from isolated source/studio views. The phone is profile with a dark trailing wing and ivory edge/chest plus the beak silhouette readable. Current broad identity reaches 8, while fine face, arm and wing-pair separation are angle/fog limited. Historical night 7.5 is retained; daylight does not establish current night 8.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:35:18.615 | **11:09**, 11.162 h | [PNG](himmapan_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:35:42.822 | **11:39**, 11.66117 h | [PNG](himmapan_3-actual-game-mobile.png) |

PNG hashes: desktop `c9f4f5c00759915bcfe2b5bb3a4b38a6550c7711de0621c1373e8398538033e6`; mobile `b767f4c212aefe5026613f99c97c814e41dc18e551794896f90fb7f964062d8c`.

**Supplied technical evidence:** [runtime report](himmapan_3-runtime-qa.json), keys +24 Hz, unchanged indexed-edge conjunction, five clips zero failures. Maximum edge ratio **1.682148** (walk), die **1.579033**; arm/leg length error **.0223 mm**, worst flat clearance **-.551 mm**. WingL/R versus Body skin-matrix maximum difference **5.5598e-7**, within unchanged **.0001** bound; decoded textures 1024/512 square, normalized weight sum error about 1.11e-16; rest target **3.8 m**, fill .35/fog scale .45. **Local area/volume remains unproven:** minimum area ratio **.020155**, triangle **5576**, die **.9 s**. Fresh target-neighborhood closeups are reviewed below; exact triangle-surface visibility and all-frame volume remain uncertified, and the edge gates stay unchanged. Fresh VFX, continuous locomotion/wing transitions, unseen terrain, native combat states and physical-device FPS remain untested.

## Current measured-compression closeups — all five bipeds

**All 30 freshly corrected PNGs were visually inspected:** walk/attack/die, front and normal-facing camera for Dusk, Giant, Garuda, Fallen and Rift. Only the current overwritten renders and their receipts are used; the faulty previous renders are not evidence. Every row's asset SHA matches the current public/animated identity above. Actual native action times match the requested measured raw-audit times, within floating-point precision. These are views of the actual textured scene around the deformed target centroid. The receipt explicitly notes native blending can differ from the raw audit, so this does not establish raw-pose identity or all-frame local volume preservation.

| Model / current compression receipt | Walk triangle / actual time | Attack triangle / actual time | Die triangle / actual time | Visible result and limitation |
|---|---|---|---|---|
| [Dusk](dusk_fort_3-compression-capture.json) | 4768 / .800000 s | 11866 / .666667 s | 4774 / .800000 s | Red elbow retains substantial width around its inner bend; thigh/knee cloth and armor remain coherent. The hand/cuff and layered knee armor obscure part of the normal-facing walk/die target. |
| [Giant](giant_valley_3-compression-capture.json) | 4565 / .800000 s | 10538 / .458333 s | 8114 / .766667 s | Ivory thigh cloth folds, rounded green upper arm and angular gold waist ornament remain recognizable. No torso/arm needle or gross belt break is visible. The ornament, sash and hand partly hide the exact die target. |
| [Garuda](himmapan_3-compression-capture.json) | 4840 / .900000 s | 7683 / .633333 s | 5576 / .900000 s | Feathered thigh, armpit/wing-root neighborhood and chest/belt retain coherent mass. Fine feather/trim facets remain angular. Wing, hand and overlapping trim limit exact target visibility, especially normal-facing die. |
| [Fallen](fallen_city_3-compression-capture.json) | 5588 / .800000 s | 9041 / .633333 s | 5588 / .633333 s | Indigo trousers have narrow faceted folds; the bent sleeve/elbow has a compressed inner crease but retains broad upper/lower-arm widths. Coat panels and hanging ornament partly conceal the thigh target. No confirmed cuff/waist tear or gross elbow collapse. |
| [Rift](demon_rift_3-compression-capture.json) | 7678 / .300000 s | 676 / .633333 s | 7678 / .583333 s | Purple upper arm/armpit and knee/thigh armor have sharp cloth/trim creases with continuous broad limb mass. Dark layered cloth strongly obscures the normal-facing walk target; it is not independently resolved as an exact triangle surface. |

Representative paired die witnesses: Dusk [front](dusk_fort_3-die-compression-front.png)/[normal](dusk_fort_3-die-compression-normal.png), Giant [front](giant_valley_3-die-compression-front.png)/[normal](giant_valley_3-die-compression-normal.png), Garuda [front](himmapan_3-die-compression-front.png)/[normal](himmapan_3-die-compression-normal.png), Fallen [front](fallen_city_3-die-compression-front.png)/[normal](fallen_city_3-die-compression-normal.png), Rift [front](demon_rift_3-die-compression-front.png)/[normal](demon_rift_3-die-compression-normal.png). All additional walk/attack filenames and camera centers are recorded in the linked receipts and were inspected.

**Bounded conclusion:** no confirmed gross localized limb/torso collapse was found in these closeups. Visible folds/facets are not enough to diagnose a newly introduced skin pinch without a matching rest comparison. The exact target triangle is not highlighted, and several surfaces are obscured; therefore no claim that every minimum-area triangle is fully visible, harmless, or volume-preserving is made. The existing edge/limb/floor gates remain unchanged. No new area-ratio threshold is invented, and an edge pass does not substitute for visual review. This additional inspection preserves the broad body PASS with these limits; continuous crease behavior and hidden surfaces remain untested.

## Durable technical evidence and asset provenance

The completed provenance-bound [consolidated runtime report](runtime-qa.json) contains all six species, five clips each, **errors=[] and failures=[] for every model**, with zero over-limit indexed-edge samples. Each durable individual report is content-identical to its corresponding consolidated row. They cover exported keys +24 Hz under unchanged thresholds; these audits were read, not rerun by this reviewer. Recorded maximum ratios match the measurements reviewed above. Current public GLB bytes independently match animated metadata and matching studio/direct/native capture SHA pins.

**Audit provenance limitation CLOSED by the fresh rerun.** All six consolidated rows and individual numerical reports now embed `asset.sha256` for the fetched/parsed audited bytes. Independently checked `asset.sha256`, `provenance.localGlbSha256` and `provenance.nativeLoadedGlbSha256` against the current public GLBs: all match the exact current hashes stated above. Every `provenance.rigReportSha256` independently matches the corresponding maintained `tools/monster-models/meshy/rigs/TYPE-rig-report.json`. Each report also records `provenance.capturedAt`. This supplies direct numerical-report asset attribution without changing the body verdict, thresholds or historical grades.

| Current audited model | Provenance capture UTC |
|---|---|
| Naga | 2026-10-09 11:58:56.341 |
| Dusk | 2026-10-09 11:59:02.719 |
| Giant | 2026-10-09 11:59:08.548 |
| Garuda | 2026-10-09 11:59:15.313 |
| Fallen | 2026-10-09 11:59:20.727 |
| Rift | 2026-10-09 11:59:26.711 |

**Historical truth retained:** the earlier numerical-report snapshot inspected during this review had no embedded GLB hashes; attribution then depended on adjacent metadata/capture pins and the supplied run identity. That observation applied to the earlier snapshot and is superseded by the verified provenance-bound rerun. It is no longer a current limitation.

Durable correction provenance is available for [Dusk](dusk_fort_3-weights-fix-proof.json), [Giant](giant_valley_3-weights-fix-proof.json), [Garuda](himmapan_3-weights-fix-proof.json), [Garuda reaction](himmapan_3-reaction-weights-fix-proof.json), [Fallen](fallen_city_3-weights-fix-proof.json) and [Rift](demon_rift_3-weights-fix-proof.json). These are supplied weight-repair records, not a new independent mutation or rerun. No paid regeneration, geometry repair, numerical weakening or additional model export was performed in this review.

## Historical findings — superseded revisions

The following five sections retain their original scores, hashes, measured limits and capture timestamps. All five are superseded by the corresponding valid current quality sections above. Earlier Commander skin-boundary failure and intermediate Garuda/Giant death-edge failures stay rejected; current acceptance applies only to the exact valid hashes above. Historical canonical image/receipt links may have been refreshed and must not be cited as current old-hash witnesses.

## Naga — sunken_city_3, final v3

**Visible style/anatomy and sampled attack/death PASS; complete five-state readability remains OPEN.** No gross hood/neck collapse, torn coil, extra appendage, discontinuous tail or visible floor penetration was found. The strengthened final bow resolves the earlier weak-defeat finding. Hurt remains too close to idle in the supplied witnesses to establish >=8 five-state distinction.

**Public GLB SHA-256:** `40fe0331f21bbdbc3ea2b607dc53f7b3a7dd4ea54ed28db9f163b187aecf83fa`. Independently checked against public bytes, [animated metadata](../../../tools/monster-models/meshy/sunken_city_3-animated.json), all 29 [studio rows](sunken_city_3-capture.json), all 14 [extreme rows](sunken_city_3-extremes.json) and both network-loaded [native rows](sunken_city_3-actual-game-capture.json). Receipts have zero errors. All 25 canonical pose PNGs, four VFX PNGs, 14 direct samples and both current native PNGs were visually inspected for this exact asset across the bounded review. All five named clips are present.

| Criterion | Score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Gold Thai crest and hood trim, jade scale mass, ivory belly and legless coil; distinct from a Western dragon or humanoid serpent. |
| Visible anatomy / sampled deformation | **8.5 / PASS** | One head, continuous neck/body/tail, zero arms/legs/wings. Front/back hood remains broad; top views preserve real coil gaps and continuous volume. |
| Bright studio body identification | **8.5 / PASS** | Crest, hood, pale belly and coil openings remain recognizable at the game angle. |
| Sampled attack / final defeat | **8 / 8.5, bounded PASS** | Forward neck/head gesture is stronger; final head/hood bows conspicuously over the coil without an observed pinch. |
| Full five-state distinction | **7.5 / OPEN** | Walk is a modest neck sway; sampled hurt is very close to idle. Strongest reaction/continuous transition is not established by the filenames or these stills. |
| Current native desktop / touch identification | **8 / 8, bounded night PASS** | Crown/hood/coil remain identifiable against the blue night ground, with visible ivory/gold separation. Small facial/scale detail and hidden front surfaces are not certified. |
| Production VFX footprint presentation | **8 / bounded PASS** | Breath cone remains bounded; undertow annulus leaves its inner safe area visibly empty at windup and impact. |
| Technical usability | **8.5 / bounded PASS** | 12,548 triangles, one material draw, 1,559,332 bytes; supplied unchanged five-clip gates pass. No FPS, sustained combat or resource-lifecycle acceptance is inferred. |

**Current body-state issue — P2 / reaction distinction.** Compare [game idle](sunken_city_3-game-idle.png), [game hurt](sunken_city_3-game-hurt.png) and [direct game hurt](sunken_city_3-game-hurt-0_22.png). Their actual clip times are idle 0.700795, hurt 0.2229 and hurt 0.253 seconds. The head/neck reaction is subtle at these times; this is a readability concern, not evidence of damaged skin weights. The direct hurt sample is not independently proven to be the clip's maximum recoil. Establish that peak/transition before deciding whether more reaction amplitude is required; retain the pinned ground coil and existing gates.

[Side attack](sunken_city_3-side-attack-0_5.png) and [game attack](sunken_city_3-game-attack-0_5.png) are actual attack time **0.533 s**, not filename time 0.5. [Side final death](sunken_city_3-side-die-1_3.png) and [game final death](sunken_city_3-game-die-1_3.png) are actual die time **1.0 s**, speed 1.4; the request at 1.3 is a controller time. The 1.0 final pose is clearly bowed compared with idle. Jaw articulation and every in-between frame remain untested visually; no open-jaw or continuous-frame claim is made.

**Current natural night evidence:** server SID **486**, `remote=true`, alive and model loaded, natural `mlist` observation, exact response hash above. Helper contexts use desktop 1440x940 and touch 390x844 with `isMobile=true` / `hasTouch=true`; camera follows the natural boss at native angle and zoom 1.6. No player, monster or clock mutation is reported by the capture helper. Both rows have `night=1`, natural fog density **0.01675**; the per-instance fog scale is 0.45, not fog removal.

| View | Capture time UTC | Natural clock / phase | Current evidence |
|---|---|---|---|
| Desktop | 2026-10-09 10:59:05.625 | **22:57 / night** | [PNG](sunken_city_3-actual-game-desktop.png) — two serpents in scene; reviewed loaded target identity comes from the receipt. |
| Mobile touch | 2026-10-09 10:59:47.242 | **23:39 / night** | [PNG](sunken_city_3-actual-game-mobile.png) — rear-facing hood/coil remain readable; face is naturally hidden by facing. |

Night PNG SHA-256 values at review: desktop `c3bb27f08f48b7f66783aef647524d17041c8cf64d6d24fff1cf1412980e2a4a`; mobile `510bb20454360aae96866d17e69394f87620579578f00d8b4d6bc03fa524785e`. These replace the canonical morning screenshots. The old v2 7/7.5 fog scores are superseded; this does not claim all night angles, canopy occlusion or live attack readability pass.

**Supplied numerical evidence, read-only:** [native report](sunken_city_3-runtime-qa.json) samples exported keys +24 Hz and actual indexed edges >=5 mm. All five clips have zero failures under ratio >2 **AND** extension >1 cm. Maximum ratio 1.630606 (die); all 7,820 grounded-coil vertices have zero reported drift; native flat clearance is approximately zero. Minimum local area ratio is 0.349539 at die 1.0; no new area threshold is invented. Decoded colour/normal textures are 1024/512 square; weight-sum error is zero. World target rest height is **3.2 m** (1.6 normalizer ×2 outer size). Numbers support technical acceptance within their scope, not native uneven-terrain or temporal visual proof.

## Giant — giant_valley_3, final v1 from corrected prop-v2 source

**Visible Thai style/anatomy/club grip PASS; full readability gate remains OPEN.** No gross broken elbow, inverted foot, cloth tear, detached hand or warped club was observed. The corrected source has a real club and replaces the rejected missing-prop source. Current cast/reaction/defeat signals remain modest, and the natural mobile evening angle obscures the club's separation from the body.

**Public GLB SHA-256:** `1cca398ece9529f655e0ab1ca6d57effc50971f8d2164cbaef6a2fb62ba6a641`. Independently checked against public bytes, [animated metadata](../../../tools/monster-models/meshy/giant_valley_3-animated.json), all 29 [studio rows](giant_valley_3-capture.json), all 14 [extreme rows](giant_valley_3-extremes.json) and both response hashes in the [native receipt](giant_valley_3-actual-game-capture.json). Zero capture errors. All 25 canonical poses, four VFX states and 14 direct samples were visually inspected for this exact asset; current idle/cast/reaction/final comparisons and both new native PNGs were rechecked for this report.

| Criterion | Score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Green yaksha face/tusks, substantial shoulders, gold crown/bands, broad ivory wrapped trousers and one gold club. |
| Visible anatomy / sampled deformation | **8 / PASS** | One head, two arms/hands, two legs/feet, no wings/tail. Coherent elbow and knee volume; fingers point naturally. Hidden gripping digits are not all independently countable in the posed full-body PNGs. |
| Bright studio identification / visible grip | **8.5 / 8, PASS** | Broad torso and club remain distinct. Right hand visibly encloses the handle; shaft/head remain continuous across sampled motion. |
| Sampled cast / five-state contrast | **7.5 / OPEN** | Club moves forward/down modestly; hurt is close to idle; final defeat remains a standing bow with only shallow supported knee bend. |
| Native desktop evening identification | **8 / bounded PASS** | Green/gold/ivory masses identify the foreground yaksha; another natural body overlaps behind it. |
| Native mobile evening readability | **7.5 / OPEN** | Almost edge-on body narrows the shoulder silhouette and hides club/hand separation against the leg/body. Recognizable yaksha does not establish clear weapon/action readability. |
| Production VFX footprint presentation | **8 / bounded PASS** | Club cone /quake ring boundaries remain readable; earth fragments do not fill the safe hole. |
| Technical usability | **8 / bounded PASS** | 12,489 triangles, one material draw, 1,436,688 bytes and five clips; unchanged native edge/limb/floor checks pass. Full contact/temporal/instance-lifecycle proof is outside this visual review. |

**P2 — body-state distinction.** Compare [game idle](giant_valley_3-game-idle.png), [game cast](giant_valley_3-game-attack-0_5.png), [game hurt](giant_valley_3-game-hurt-0_22.png) and [side final defeat](giant_valley_3-side-die-1_3.png). The direct cast samples are actual **0.382 /0.532 /0.732 s**, hurt **0.252 s**, final die **1.0 s** at speed 1.4. The club stays gripped but the body/swing change is modest; final stance remains standing rather than a clearly settled defeat. This is a pose/readability concern, not a skin-collapse finding. The hurt peak and continuous club preparation/sweep are not independently proven by three snapshots. Preserve current source/weights and gates if the parent chooses a supported motion revision; no paid source repair is indicated.

**Bounded mobile visibility limitation.** In [evening touch PNG](giant_valley_3-actual-game-mobile.png), the actual source club is largely hidden by natural facing/body overlap. Retain this particular view's 7.5 score. It is not a separate geometry/pose failure, proof of a missing/detached prop, or a requirement that every native side/back view expose the grip. It also cannot certify physical hand/shaft contact at phone scale. Source grip witnesses in [STATIC_ART_REVIEW.md](STATIC_ART_REVIEW.md) remain the independent source evidence; numerical rigid-matrix equality, where measured, is complementary and cannot substitute for physical surface contact. New bounded meaningful native angles can establish the revised body's acceptance without erasing this witness or relocating the spawn.

**Natural evening evidence:** SID **874**, exact loaded response hash above, alive/model loaded/remote true, natural `mlist`. Desktop and genuine touch contexts use the same native-angle camera-follow helper described above. No forced combat, player movement, clock, spawn or damage manipulation is claimed.

| View | Capture time UTC | Natural clock / phase | Fog / night blend | Current evidence |
|---|---|---|---|---|
| Desktop | 2026-10-09 10:55:00.604 | **18:57 / evening** (18.9588 h) | 0.0134036 /0.1634 | [PNG](giant_valley_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 10:55:12.922 | **19:08 / evening** (19.1342 h) | 0.0140526 /0.3256 | [PNG](giant_valley_3-actual-game-mobile.png) |

PNG SHA-256 values at review: desktop `b769d6827e8f18f214efb76a917b83b05cc85798b7d8de27a3677cc69f014fb6`; mobile `ebaba4945ef5bba5f78979717818b8474c0b31bb06c76599a6b983ff57ee3909`. These are evening observations, **not full-night evidence**. The earlier timeout is superseded by these successful captures, not erased as a historical failure.

**Supplied numerical evidence, read-only:** [native report](giant_valley_3-runtime-qa.json), exported keys +24 Hz, unchanged indexed-edge >=5 mm /ratio >2 AND extension >1 cm gate. Five clips have zero failures; maximum ratio 1.683229 (die), maximum limb-length error about **0.0214 mm** with arm and leg segments listed, idle foot-origin drift zero, worst flat clearance **-0.319 mm** within the existing -10 mm limit. Weight-sum error is about 1.11e-16; decoded textures 1024/512 square. Minimum area ratio **0.086260**, triangle 4565 at die 0.8333 s, remains a localized contraction measurement whose exact surface/time was not independently inspected; the edge pass is not every-triangle visual proof. Rest height is **4.0 m** (2 normalizer ×2 outer size), a measured revision of the brief's initial 4.2 m goal. No arbitrary lift or threshold change is accepted.

## Dusk demon lord — dusk_fort_3, reviewed v4

**Style/anatomy and final defeat PASS in the sampled historical v4 evidence; hurt distinction remains P2 /7.5.** The revised forward torso slump and visibly bent knees close the earlier weak-defeat finding. No gross elbow/cuff tear, hip separation, reversed hand/foot or visible floor intrusion was found in these samples. The separately rejected v3 is not accepted by this verdict.

**GLB SHA-256:** `3b57a77e99b078bf71236d61569f968f171fa83dd0039d35a37acda210c53bb2`. Public bytes, [animated metadata](../../../tools/monster-models/meshy/dusk_fort_3-animated.json), all 29 [studio rows](dusk_fort_3-capture.json), all 14 [direct rows](dusk_fort_3-extremes.json) and both [native rows](dusk_fort_3-actual-game-capture.json) matched at review; receipts have zero errors. Visual scope is bounded representative poses across front/side/back/top/game, including idle/attack/hurt, direct walk and the actual final die; all four VFX states and both night PNGs were inspected. This is not a claim that all 43 pose PNGs or every transition were visually inspected.

| Criterion | Historical score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Flame-shaped gold Thai crown/shoulders, red body/costume and ivory sash/boots; distinct demon-lord silhouette. |
| Visible anatomy / sampled deformation | **8 / PASS** | One head, two arms/hands and two legs/feet, no wings; preserved broad elbows and natural palms. Exact source digits remain the separate close-camera static proof. |
| Studio identification / attack / defeat | **8.5 /8 /8** | Outward forearms distinguish casting; final torso drop and knee bend distinguish defeat. |
| Full five-state distinction | **7.5 / OPEN** | Direct hurt remains very close to idle; modest walk is not continuous locomotion proof. |
| Native night desktop / touch identification | **8 /8, bounded PASS** | Red/gold mass, ivory sash and boots separate from the blue ground. Fine facial/trim detail remains obscured by night fog. |
| Production VFX presentation | **8 / bounded PASS** | Cone and filled-circle danger regions remain legible at windup/impact. The studio circle instruction banner hides the upper body, so it cannot certify facial cast expression. |
| Technical usability | **8 / bounded PASS** | 12,495 triangles, one material draw, 1,581,116 bytes, five clips, normalized weights and supplied unchanged gates pass. |

**P2 — reaction distinction.** Compare [game idle](dusk_fort_3-game-idle.png), actual idle **0.552632 s**, with [direct game hurt](dusk_fort_3-game-hurt-0_22.png) and [side hurt](dusk_fort_3-side-hurt-0_22.png), actual hurt **0.22 s**. The shoulder/head reaction is too small to read reliably at game scale. The canonical front hurt at **0.18 s** is also near idle. This is not evidence of missing animation or broken weighting: the numerical report measures maximum hurt displacement about **0.0412 m in source units**, close to idle's **0.0422 m**; that whole-mesh measure does not identify a joint-specific peak. The planned guarded torso/head recoil addresses the observed readability issue without requiring new geometry.

**Defeat P2 closed for this v4.** [Side idle](dusk_fort_3-side-idle.png) versus [side final die](dusk_fort_3-side-die-1_3.png), and [game final die](dusk_fort_3-game-die-1_3.png), show the forward slump and bent knees with planted feet. These final witnesses are actual die **1.0 s**, speed 1.4; 1.3 in the filename is requested controller time. This is a supported crouch/slump, not a claim of a fully kneeling or prone death. The reviewed attack sample is actual **0.5 s**; no elbow needle collapse is visible there.

**Natural night evidence:** SID **583**, `remote=true`, alive/model loaded, natural `mlist`, exact network SHA above, zero errors. Desktop 1440x940 and genuine touch emulation 390x844 use native-angle camera follow/zoom 1.6; no clock/player/monster mutation. Both have night=1, fog density **0.01675**, per-instance fog scale **0.45**.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 11:03:01.449 | **02:57**, 2.96508 h | [PNG](dusk_fort_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:03:13.524 | **03:08**, 3.14025 h | [PNG](dusk_fort_3-actual-game-mobile.png) |

PNG hashes at review: desktop `5a184358b63424bfe2267da48afc33c27fde9869eb1fc3e13b48d011a02e9e2e`; mobile `bdf8e2496012a5cf8d8984fdbebbcf6e7c02a5d51e78d063e4b91fba0dfbd8c9`.

**Supplied numerical scope:** [v4 runtime report](dusk_fort_3-runtime-qa.json), all exported keys +24 Hz, unchanged indexed-edge/limb/foot/floor gates, zero failures. Maximum edge ratio **1.969579** (die), arm/leg length error at most **0.0136 mm**, worst flat clearance **-0.310 mm**. Rest target height **3.6 m**; texture decode 1024/512 square, weight-sum error about 1.11e-16. Minimum area ratio **0.023215**, triangle 4774 at die **0.8 s**, remains a localized contraction measurement, not a certified all-triangle volume/area pass; that exact triangle/time was not independently visually inspected. No thresholds are changed or waived.

## Garuda — himmapan_3, reviewed v2

**Style/anatomy and sampled cast PASS; final defeat and hurt distinction remain P2 /7.5.** The supplied final die is already at the clip endpoint: more elapsed controller time cannot establish a stronger settled pose for this revision. No gross wing/arm fusion, torn wing root, collapsed elbow, reversed palm or broken claw-foot orientation was seen in the inspected states.

**GLB SHA-256:** `c959ec1ba4da4b9da312d4a77e17852dba062ad7a3859f15398d54688718a939`. Public bytes, [animated metadata](../../../tools/monster-models/meshy/himmapan_3-animated.json), 25 pose rows in the [studio receipt](himmapan_3-capture.json), all 14 [direct rows](himmapan_3-extremes.json) and both [native rows](himmapan_3-actual-game-capture.json) matched. All 25 canonical pose PNGs, 14 direct samples, four VFX images and both refreshed night PNGs were inspected across the bounded review. The four VFX receipt rows do not contain their own asset SHA; their visual presentation is reviewed, but independent exact-body-hash provenance is limited for those rows. All receipts have zero errors.

| Criterion | Historical score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8.5 / PASS** | Thai gold crest/costume, bird head, teal/ivory feather blocks and bird feet; separate wings, not an angel or European dragon. |
| Visible anatomy / sampled deformation | **8 / PASS** | Two independent arms/hands, two legs/claw-feet and one distinct pair of wings. Wing roots retain continuity; five source digits were established separately in static close views. |
| Studio identification / sampled attack | **8.5 /8** | White feather tips/chest frame the silhouette; casting forearms and palms remain visibly thick and coherent. |
| Final defeat / full five-state distinction | **7.5 / OPEN** | Endpoint remains a shallow standing bow; sampled hurt is near idle. |
| Native night desktop / touch identification | **8 /7.5, bounded** | Desktop wings and ivory feather blocks identify Garuda. Phone's edge-on facing merges body/arms/wings and hides the paired silhouette. |
| Production VFX presentation | **8 / bounded** | Cone/circle footprints remain legible in supplied stills; no ring safe-hole is required for the filled-circle skill. VFX row hash limitation above applies. |
| Technical usability | **8 / bounded PASS** | 12,528 triangles, one material draw, 1,578,248 bytes; five unchanged numerical gates pass, including reported rigid wing/body matrix comparisons. |

**P2 — final defeat.** Compare [side idle](himmapan_3-side-idle.png), [side final die](himmapan_3-side-die-1_3.png) and [game final die](himmapan_3-game-die-1_3.png). Actual die **1.0 s**, speed 1.4, shows a head/torso bow with the body still supported at nearly standing height and only modest knee change. It can read as a lowered combat posture rather than a settled defeat. A controlled torso slump and knee-supported drop would address the visible endpoint issue; retain grounded feet, separated wing roots and existing skin/floor gates. No prone pose or fully folded wing requirement is invented.

**P2 — sampled reaction.** [Game hurt](himmapan_3-game-hurt-0_22.png) is actual **0.2969 s**, not 0.22; it is close to [game idle](himmapan_3-game-idle.png). Whole-mesh maximum hurt displacement is **0.0410 m source**, versus idle **0.0414 m**. The supplied attack requests .35/.5/.7 are actual **.4269/.5769/.7769 s**; forearm/palm movement is visible and not a confirmed attack-anatomy failure. Direct stills do not prove every transition or a localized strongest hurt peak.

**Bounded native limitation, not a geometry/pose blocker:** retain the particular night touch view's **7.5**. Its natural edge-on facing exposes mainly one thin ivory wing edge, so the full pair is hard to separate. This does not require both wings or both hands to be visible at every side/back angle. Revised acceptance can use multiple meaningful natural views while retaining this historical witness; stronger death/hurt remains the independently confirmed body P2.

**Night receipt:** SID **680**, remote/alive/loaded true, exact network hash, natural `mlist`, zero errors; night=1, fog **0.01675**, per-instance fog scale .45, same native-angle desktop/touch helper.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 10:59:20.159 | **23:17**, 23.29317 h | [PNG](himmapan_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 10:59:59.594 | **23:57**, 23.96125 h | [PNG](himmapan_3-actual-game-mobile.png) |

PNG hashes: desktop `b76c7b71ae9e734cd12ae0356a533a13639c301ae0b6271caa8d526b207bd94b`; mobile `c6a52638f02ece8519947da6fbab6a1082ca369fe994fb300bb8d90d3f08a677`.

**Supplied technical scope:** [runtime report](himmapan_3-runtime-qa.json), keys +24 Hz, zero indexed-edge/arm/leg/foot/floor failures; maximum edge ratio **1.746544**, maximum limb-length error **0.0223 mm**, worst flat clearance **-0.420 mm**. Reported wing/body skin-matrix differences are at most **5.18e-7**, within the unchanged .0001 bound; matrix agreement complements visible root continuity and is not a surface-contact substitute. Rest target height **3.8 m**. Minimum triangle area ratio **0.036990** at walk .166667 s remains outside independent exact-surface visual proof. Tight wing folding, continuous wing motion, every toe contact and physical-device FPS are untested.

## Rift demon — demon_rift_3, reviewed v2

**Style/anatomy and bounded night identification PASS; full body-state distinction remains P2 /7.5.** No gross elbow pinch, reversed hands/feet, extra limbs/wings, torn waist/cuff or broken horn continuity was found in inspected samples. Final defeat remains an upright bow; the supplied game attack/reaction samples are modest relative to idle.

**GLB SHA-256:** `83482061417c291216065fd63e8b31bb57246bfc3237071dddaf8269c83a53b3`. Public bytes, [animated metadata](../../../tools/monster-models/meshy/demon_rift_3-animated.json), all 29 [studio rows](demon_rift_3-capture.json), all 14 [direct rows](demon_rift_3-extremes.json) and both [native rows](demon_rift_3-actual-game-capture.json) matched; receipts have zero errors. Visual review inspected all 14 direct samples, representative canonical front/back/top/game/side poses, four VFX states and both refreshed night PNGs; it does not claim all 25 canonical poses or every transition were independently inspected.

| Criterion | Historical score / result | Basis |
|---|---|---|
| Thai style / character consistency | **8 / PASS** | Thai crown/trim, paired ivory horns, dark amethyst costume and bone-ivory chest/shins; biped demon rather than a winged European dragon. |
| Visible anatomy / sampled deformation | **8 / PASS** | One head, two arms/hands, two legs/feet, two horns, zero wings; source five digits previously resolved by close-camera static inspection. |
| Bright studio body identification | **8.5 / PASS** | Horns, shoulder mass and ivory chest/shins provide large recognizable blocks. |
| Sampled attack / final defeat / five-state distinction | **7.5 / OPEN** | Game-angle attack arm movement is modest; endpoint death remains a standing bow; hurt is close to idle. |
| Native night desktop / touch identification | **8 /8, bounded PASS** | Ivory horns/chest/shins and paired-horn outline remain separable from the blue ground. No claim for fine dark-purple material detail. |
| Production VFX presentation | **8 / bounded PASS** | Circle and annulus are distinguishable; the ring's central safe hole remains visibly empty at windup/impact. |
| Technical usability | **8 / bounded PASS** | 12,504 triangles, one material draw, 1,496,956 bytes; supplied edge/leg/foot/floor gates pass. Current report lists leg segments, not the additional arm-length segments present in Dusk/Garuda reports. |

**P2 — final defeat / game-scale state contrast.** [Side idle](demon_rift_3-side-idle.png) versus [side final die](demon_rift_3-side-die-1_3.png) and [game final die](demon_rift_3-game-die-1_3.png): actual die **1.0 s**, speed 1.4, is a shallow forward bow at nearly standing height. There is no endpoint timing ambiguity to resolve before judging that specific pose. A more settled guarded torso/knee drop would give a clearer defeat while retaining the numerical gates.

Compare [game idle](demon_rift_3-game-idle.png), [game attack](demon_rift_3-game-attack-0_5.png), actual **0.5769 s**, and [game hurt](demon_rift_3-game-hurt-0_22.png), actual **0.2969 s**. Cast palms lift modestly; the head/torso reaction is very close to idle. Attack requests .35/.5/.7 correspond to **.4269/.5769/.7769 s**. A larger readable torso/head reaction addresses the sampled hurt concern; a localized strongest cast/hurt peak and continuous transition remain unproven. Whole-mesh maximum hurt displacement is **0.0690 m source**, versus idle **0.0653 m**; these values establish motion, not a visually distinct state by themselves. No geometry or weight change is inferred from these readability findings.

**Natural night evidence:** SID **777**, remote/alive/loaded true, exact network hash, natural `mlist`, zero errors; both night=1, fog **0.01675**, per-instance fog scale .45; same desktop/genuine-touch native-angle follow helper.

| View | Capture UTC | Natural clock | Evidence |
|---|---|---|---|
| Desktop | 2026-10-09 10:59:34.736 | **23:27**, 23.46533 h | [PNG](demon_rift_3-actual-game-desktop.png) |
| Mobile touch | 2026-10-09 11:00:11.638 | **00:08**, .134 h | [PNG](demon_rift_3-actual-game-mobile.png) |

PNG hashes: desktop `bcd4d5efe4764947e0ebc079d9392c0a5377725c8bf1beaf1cb9cfe28a95786e`; mobile `cdaa98b43829e7a28cee7acabf12605eef296631ade99f7dda75621b22d1a5bd`.

**Supplied technical scope:** [runtime report](demon_rift_3-runtime-qa.json), exported keys +24 Hz, unchanged gates, five clips zero failures; maximum edge ratio **1.990100**, maximum reported leg-length error **0.0182 mm**, worst flat clearance **-0.360 mm**, rest target **4.2 m**. Minimum triangle area ratio **0.067340**, triangle 676 at attack **.633333 s**, is not an independently certified local area/volume result. The edge limit is neither relaxed nor treated as full visual skin proof. Native reaction/cast/defeat readability is not established by the two identification screenshots.

## Scope and next revision

The leading six current sections complete bounded body art review of the notified valid hashes, including matching native identification captures and all 30 fresh measured-compression closeups. Style, sampled body readability and technical usability reach >=8 in the stated scope. No confirmed gross-anatomy or body-readability P1/P2 was found in inspected current samples; historical reaction/defeat findings are superseded only for those exact hashes. The five historical sections retain their old scores and revisions, and failed intermediate exports remain rejected. Current natural night proof covers Naga/Rift; Dusk/Fallen are evening and Giant/Garuda are daylight. No all-six night grade is claimed. Hidden exact-triangle surfaces/volume, continuous motion, full production VFX and sustained combat remain unproven; this bounded pass does not certify them. The completed provenance-bound consolidated six-model report was read and has zero failures; its current embedded asset/rig pins are verified and the earlier pin limitation is closed above.

Only this Markdown file was written in this review slice. No source, model, rig, pose, helper or other historical-report mutation; no Blender/paid/API calls or recapture/audit rerun. `npm run build` passed with **233 modules** and the existing large-chunk warning. Public/metadata/receipt pins and supplied numerical reports were read independently; those numerical runs were not rerun here. Continuous transitions, native attack/VFX synchronization, authoritative damage, physical-device FPS and unseen terrain/canopy remain untested. No extra demand that every natural side/back view expose the grip or both wings is added.
