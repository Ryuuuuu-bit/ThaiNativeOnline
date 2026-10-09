# Lv50–100 Meshy bosses — static source review

Verdict: the six current prepared candidates pass the visible static style/anatomy check. Giant and Commander prop-v2 resolve the missing-prop blockers. Their original missing-prop revisions remain **REJECTED**; replacement acceptance does not rewrite that history. Static acceptance does not accept binding, animation, native world visibility or device performance.

## Current candidates and scores

Scores describe the bright isolated source camera and retain the >=8 style/readability target.

| Candidate | Style / anatomy / static readability | Inspected evidence and verdict |
|---|---|---|
| Naga `sunken_city_3` | 8.5 / 8.5 / 8.5 | All five source views. One head, Thai crest/hood, jade/ivory/gold, zero arms/legs/wings, visually continuous neck/coil/tail and genuine coil openings. No gross visible defect. |
| Dusk `dusk_fort_3` | 8 / 8 / 8.5 | All five plus six measured hand-camera views. Two arms/two legs, forward boots, balanced face/shoulders. **One thumb plus four fingers on each hand**, natural curl, no backward finger/wrist. Red/gold/white reads distinctly. |
| Giant prop-v2 `giant_valley_3` | 8.5 / 8 / 8.5 | All five plus six measured grip/free-hand views. Broad green Thai yaksha, two arms/two legs, forward sandals, intact visible pelvis/cloth. **Real club held in the right hand**, fingers surround handle; free left palm has thumb plus four fingers. No gross visible break. |
| Garuda `himmapan_3` | 8.5 / 8.5 / 8.5 | All five. Bird head, two arms/two five-digit hands independent of two wing roots, two legs/two claw feet. Three forward toes plus rear toe visible. Back/top distinguish both wing attachments from arms. No gross duplicate limb/fusion. |
| Commander prop-v2 `fallen_city_3` | 8 / 8 / 8.5 | All five plus eight measured hand/blade views. Thai white/indigo/gold general, two arms/two legs, forward boots, coherent face/cloth. **Real curved dha held in right hand**, palm/fingers surround hilt above guard; free left hand has thumb plus four fingers. Continuous blade, bevel/edge and pointed tip are visible from face/oblique cameras. |
| Rift `demon_rift_3` | 8 / 8 / 8.5 | All five. One Thai demon head, two prominent horns, two arms/two five-digit hands/two legs; no wings/dragon tail. Amethyst/ivory/gold clearly differs from Dusk. Natural hand/foot orientation and coherent face/pelvis. |

No confirmed gross anatomy P1/P2 remains in the current source views. Closed prop-gripping fingers overlap and merge at this stylized resolution: their exact individual five-digit count is **not fully resolved**, although the opposing thumb/curl/contact are visible and no missing-digit or backward-bend defect is established. Do not infer finger articulation from these fixed source poses.

## Exact prepared revisions

| Candidate | SHA-256 | Triangles | GLB bytes | Material draws |
|---|---|---:|---:|---:|
| Naga | `af16ed94ea1be4251fc91ab38cd934160bef5caa313a3f50ef5871d14ff6b4ef` | 12,548 | 1,525,800 | 1 |
| Dusk | `0a0fef1eb064eead5fa42a0675a184f71da481393eb51b89f032f4cfdcf66b08` | 12,495 | 1,513,996 | 1 |
| Giant prop-v2 | `59bbe3cc594674a293a78616da7805c972b9b3f258f468645a7e2a38d422481d` | 12,489 | 1,380,092 | 1 |
| Garuda | `a3990649a8ee5d798929485c41648eb869dc8150f9a26ac5def574f69f3733d5` | 12,528 | 1,522,740 | 1 |
| Commander prop-v2 | `4cffa6372241f1d7c0012dabc0b00f7af05c990318136c456e2adcc2740cdf8b` | 12,465 | 1,429,680 | 1 |
| Rift | `6d923f15c47b1e01a42b9a8ef59b66ee127096a63d044485832bcbe4475de60a` | 12,504 | 1,441,692 | 1 |

All six meet one material draw, <=15,000 triangles and <=3 MB **at static preparation**. Browser GLB responses matched prepared hashes, geometry positions were finite, and base 1024x1024 / normal 512x512 textures decoded. Animation/export budgets require separate checks.

## Rejected revisions preserved

- **Giant original REJECT — missing club:** `189d9bfb7dfe1a46450faad4ea32728bb1b2fe8ce8b86d063e369e35af0ade81`. [Immutable front](static-source/giant_valley_3/189d9bfb7dfe1a46450faad4ea32728bb1b2fe8ce8b86d063e369e35af0ade81/front.png); the same folder preserves side/back/top/game. All five showed empty hands. This P2 design blocker is resolved only by the new prop-v2 revision.
- **Commander original REJECT — missing dha:** `c58467d53ca2cff28a62c1d3a31e14a58f8571164e095de650f1554871abf107`. [Immutable front](static-source/fallen_city_3/c58467d53ca2cff28a62c1d3a31e14a58f8571164e095de650f1554871abf107/front.png); the same folder preserves side/back/top/game. All five lacked sword/grip/edge evidence. This P2 design blocker is resolved only by prop-v2.

## Close-camera witnesses

These are actual source renders with geometry and pose unchanged. Cameras target bounds of decoded source vertices, rather than enlarging whole-body screenshot pixels. Camera/ROI/bounds, prepared/GLB/PNG hashes and immutable revision paths are in [static-capture.json](static-capture.json).

- Dusk: [left outer](dusk_fort_3-handl-outer.png), [left inner](dusk_fort_3-handl-inner.png), [left thumb](dusk_fort_3-handl-thumb.png), [right outer](dusk_fort_3-handr-outer.png), [right inner](dusk_fort_3-handr-inner.png), [right thumb](dusk_fort_3-handr-thumb.png). Each hand ROI derives from the source anatomy wrist/tip coordinates transformed to glTF space, then measured decoded vertices. All six inspected; five digits each confirmed. Earlier three pixel crops remain historical unresolved evidence, superseded by these cameras.
- Giant: [grip outer](giant_valley_3-grip-outer.png), [inner](giant_valley_3-grip-inner.png), [thumb](giant_valley_3-grip-thumb.png); [free palm inner](giant_valley_3-free-hand-inner.png), [thumb](giant_valley_3-free-hand-thumb.png) and outer. Actual handle is surrounded by the closed hand without a visible floating contact gap; free hand count is clear.
- Commander: [grip outer](fallen_city_3-grip-outer.png), [inner](fallen_city_3-grip-inner.png), [thumb](fallen_city_3-grip-thumb.png); [free hand thumb](fallen_city_3-free-hand-thumb.png), inner and outer; [blade face](fallen_city_3-blade-edge-face.png), [oblique](fallen_city_3-blade-edge-oblique.png). Physical hilt/guard/blade are present and grip is plausible; silver bevel/edge and curved point continue without a gross break. Cutting direction under attack and quantified rigid grip are later rig gates.

Giant/Commander camera targets use actual decoded vertices projected into inspected source-front hand/blade regions; camera orbits separate dorsal/palmar/thumb sides. Fourteen prop detail views were inspected. Matching earlier immutable captures are skipped rather than overwritten when adding a missing angle.

## Limits and downstream gates

Hidden welds/watertightness, internal coil contacts, source self-intersections, prop skin rigidity/contact through motion and wing/arm motion clearance are untested here. Naga's gold tail ornament has no observed second face/jaw. Garuda rest wings remain broad and separate; folded-wing motion/mobile framing still need proof.

The six broad colour blocks read in bright source views; native daytime/night/fog/canopy readability is not scored from these images. Animation gates are separate. Parent reports Naga v2's previous hood-weight death failures are corrected with unchanged motions/gates; see the separate Naga animated review. **Dusk/Garuda old v1 posed captures remain unaccepted after raw QA failures. Corrected Dusk v2 is reviewed separately in ANIMATED_ART_REVIEW.md; no animation pass is recorded in this static review.**

## Validation and changed scope

The owned ignored `artifacts/meshy-boss-02/static-qa.cjs` uses the existing Vite 5186 static review page with headless Edge/SwiftShader. It polls GLB/prepared metadata before each capture and checks hashes before/after. Forty full source views (30 original plus 10 prop-v2), six measured Dusk hand views and fourteen measured prop views were visually inspected; capture errors/pending sources: zero. Generic enlarged-frustum digit frames are not additional acceptance evidence unless individually reviewed. Helper syntax check passed.

Only the ignored helper, capture PNGs/metadata and this review were changed. No source/model/rig mutation, Blender call, paid/API generation or build was performed for this review stage.
