# Naga v2 — independent animated art review

## Verdict and exact identity

**Thai style and visible anatomy PASS. Full readability acceptance remains OPEN.** No gross hood/neck/coil collapse, tear, added limb, tail discontinuity or floor intrusion is visible in the 25 posed states. The >=8 readability target is retained: the supplied body-state witnesses and foggy native mobile image do not all reach it. This is not a numerical QA failure or a reason for paid regeneration.

Expected/current public GLB SHA-256, independently checked: `58bafc209ee990448e15e8a96d42194981249c4116c1fe51be06b6d9dc3064be`. [Studio capture metadata](sunken_city_3-capture.json) records this hash on all 25 pose rows, loaded skinned geometry and no overflow; four additional rows record production VFX checks without a per-row asset hash. All 29 supplied studio PNGs and both actual-game PNGs were visually inspected.

| Criterion | Score / result | Evidence scope |
|---|---|---|
| Thai style / character consistency | 8.5 / PASS | Jade scales, ivory belly, gold Thai crest/hood trim, legless coiled serpent; no Western dragon silhouette. |
| Visible anatomy / sampled deformation | 8.5 / PASS | One head, zero arms/legs/wings; hood remains broad and continuous; neck/coil/tail preserve volume in all five clips and views. |
| Bright studio body identification | 8.5 / PASS | Crest, hood, pale belly and two coil openings remain legible at game angle. |
| Sampled body-state contrast | 7.5 / OPEN | Walk and hurt are subtle; attack at 0.60 s is close to idle; death at 0.66 s bows/dims while retaining a tall alert-looking coil silhouette. These stills do not establish >=8 distinct-state readability. |
| Production VFX footprint readability | 8 / PASS for supplied states | Cone boundary/wave arcs are readable; ring inner safe area is visibly unfilled at both windup and impact. Native combat timing/damage are not tested by studio images. |
| Actual desktop visibility | 7.5 / below target | Thai serpent silhouette, crest and ivory belly read; green scales/coil contour lose contrast in native fog. |
| Actual mobile visibility | 7 / below target | Body is present and recognizable, but native fog softens head/hood and dark coil separation. No gross anatomy issue is visible. |
| Technical usability | 8.5 / bounded pass | Supplied numerical report passes unchanged edge/coil/floor checks; current pose GLB hash matches. No device FPS, sustained combat or lifecycle test was run here. |

## Actionable P2 / unresolved readability

**P2 — supplied attack/death state evidence is too close to idle for the >=8 distinct-state target.** Compare [game idle](sunken_city_3-game-idle.png), [game attack](sunken_city_3-game-attack.png), [side idle](sunken_city_3-side-idle.png) and [side attack](sunken_city_3-side-attack.png). The attack neck/head displacement is visible but modest, particularly frontally. [Side death](sunken_city_3-side-die.png) and [game death](sunken_city_3-game-die.png) show a forward bow and darkening, while the upper body remains largely upright. This is a pose/readability finding, **not demonstrated skin pinching**.

Before re-authoring, show the current controller's strongest attack/death frame or a short continuous witness. The current pose helper creates a fresh runtime model and advances its native controller at 24 Hz; its attack flags are correct, so this is not a confirmed mislabeled-idle capture. A single late sample still cannot establish the clip's strongest signal or full transition. If the current clips remain this subtle at their extremes, strengthen the controlled upper-neck attack/bow silhouette while preserving the grounded coil and unchanged edge/area/floor gates. No source geometry or finger change is indicated.

**Actual fog visibility remains below target.** [Desktop](sunken_city_3-actual-game-desktop.png) and [mobile touch](sunken_city_3-actual-game-mobile.png) prove a visible loaded Naga in the native scene but do not prove an 8/10 readability pass. Separate native fog/lighting loss from source anatomy; do not waive the target or claim a night improvement from these frames. Desktop clock displays morning **08:15**; mobile clock phase is not recorded.

## All supplied studio poses inspected

| View | Idle 0.50 s | Walk 0.30 s | Attack 0.60 s | Hurt 0.18 s | Die 0.66 s |
|---|---|---|---|---|---|
| Front | [PNG](sunken_city_3-front-idle.png) | [PNG](sunken_city_3-front-walk.png) | [PNG](sunken_city_3-front-attack.png) | [PNG](sunken_city_3-front-hurt.png) | [PNG](sunken_city_3-front-die.png) |
| Side | [PNG](sunken_city_3-side-idle.png) | [PNG](sunken_city_3-side-walk.png) | [PNG](sunken_city_3-side-attack.png) | [PNG](sunken_city_3-side-hurt.png) | [PNG](sunken_city_3-side-die.png) |
| Back | [PNG](sunken_city_3-back-idle.png) | [PNG](sunken_city_3-back-walk.png) | [PNG](sunken_city_3-back-attack.png) | [PNG](sunken_city_3-back-hurt.png) | [PNG](sunken_city_3-back-die.png) |
| Top | [PNG](sunken_city_3-top-idle.png) | [PNG](sunken_city_3-top-walk.png) | [PNG](sunken_city_3-top-attack.png) | [PNG](sunken_city_3-top-hurt.png) | [PNG](sunken_city_3-top-die.png) |
| Game angle (studio) | [PNG](sunken_city_3-game-idle.png) | [PNG](sunken_city_3-game-walk.png) | [PNG](sunken_city_3-game-attack.png) | [PNG](sunken_city_3-game-hurt.png) | [PNG](sunken_city_3-game-die.png) |

Idle/walk preserve coherent hood, belly and coil mass. Hurt has a slight head/neck reaction without visible collapse. Attack advances/bows the neck modestly. Death visibly bows/dims with no observed hood seam stretch; side/top retain intact tail ornament and coil openings. The ornament has no observed second jaw/face and is not counted as a second head. Top death has little bottom framing margin, but the captured silhouette remains inside the frame.

## VFX and actual-world evidence

- Breath: [windup](sunken_city_3-0-windup.png), [impact](sunken_city_3-0-impact.png). Radius 8 cone, angle 117 degrees, three restrained teal arcs and scale motifs stay within the displayed footprint. No misleading filled area outside the visible cone is observed.
- Undertow: [windup](sunken_city_3-1-windup.png), [impact](sunken_city_3-1-impact.png). Outer radius 10 / inner radius 3.5 ring. **Inner safe hole remains visibly empty**; wave bands and decorative motifs occupy the annulus. These static studio stages do not verify server impact clocks, collision, damage or live attacks.
- [Actual-game metadata](sunken_city_3-actual-game-capture.json): desktop `mspawn` and mobile `mlist` observe server SID 486 / runtime `s486`, `remote=true`, `alive=true`, `modelLoaded=true`, errors zero. Native angle follows the naturally observed boss; report states player/monster/clock untouched. Mobile context is labeled `mobile-touch`. No combat event or device performance sample is recorded.

The actual-game metadata has no captured asset SHA/timestamp/clock field. The current public GLB matches the required v2 hash, but this review does **not** promote that to independently recorded per-capture hash provenance. Actual-game appearance is reviewed as supplied; night, natural attacks, moving terrain clearance and full death transition remain untested.

## Numerical evidence and limits

Read-only inspection of the supplied ignored `artifacts/meshy-boss-02/sunken_city_3-runtime-qa.json` shows five clips sampled at all exported keys +24 Hz, indexed edges >=5 mm. All five have zero edges over the unchanged ratio >2 AND extension >1 cm limits; overall maximum ratio 1.1838959141 (die). Grounded coil: 7,820 vertices, maximum drift 0 in all five, existing limit 1.5 mm. Flat native minimum clearance is effectively 0; normalized weight maximum sum error is 0. Minimum reported triangle area ratio is 0.7787011343 in die. Serpent has no invented feet/limb chains. These are inspected supplied results, not an audit rerun or proof of every visual/temporal state.

This review changed only this Markdown report. No source/model/rig edit, Blender/paid call, recapture, full build or numerical rerun was performed for Naga. Dusk/Garuda's old v1 poses remain unaccepted and are outside this Naga verdict.

# Dusk final v2 — independent animated art review

**Visible style/anatomy and sampled attack PASS; complete five-state readability remains OPEN.** Review is of the corrected final v2 only, not the previously failed v1. All 25 fresh poses plus four production VFX PNGs were visually inspected. Current public GLB and every pose metadata row match `e886585c38b28937da2fabd29dc39e628ff82e39ecbff08529629b1359054bd0`; [capture metadata](dusk_fort_3-capture.json) has zero errors and all pose models loaded. VFX rows do not record their own asset hash.

| Criterion | Score / verdict | Concrete observation |
|---|---|---|
| Thai style / Meshy consistency | 8 / PASS | Red/gold/ivory flame armour, Thai demon face/crown and two horns remain distinct from Naga/Giant/Rift. |
| Visible anatomy / sampled deformation | 8 / PASS | Two arms, two legs; coherent face, shoulders, elbows, wrists, pelvis, forward boots. No gross tear, needle arm, inverted palm or new duplicate limb in the 25 states. |
| Bright studio body readability | 8.5 / PASS | Broad red torso, pale sash/boots and gold armour remain distinct at game angle. |
| Sampled attack readability | 8 / PASS | Forearms open outward/forward, preserve thickness and separate hands from torso; front/side/top support a deliberate casting gesture. |
| Sampled five-state contrast | 7.5 / OPEN | Walk and hurt are close to idle at 0.30/0.18 s; death at 0.66 s is a standing bow plus darkening, with largely straight supporting legs. Full transitions/strongest state witnesses are not reviewed. |
| Supplied VFX footprint readability | 8 / bounded PASS | Cone and circular danger boundary are distinct; warm blade/flame accents stay in the shown footprint. Circle windup banner covers the body's head/upper torso in this studio capture. |
| Technical usability | 8 / bounded PASS | Supplied final report has zero unchanged numerical gate failures. Lower local triangle-area ratios are recorded below; screenshots are not every-frame skin proof. |
| Native desktop/mobile/night | UNTESTED | No Dusk v2 actual-game capture is included in this review. Naga's native fog score is not transferred to Dusk. |

## Actionable readability / evidence limits

**P2 — five-state distinction is not yet demonstrated at >=8.** [Game hurt](dusk_fort_3-game-hurt.png) is close to [game idle](dusk_fort_3-game-idle.png). [Side death](dusk_fort_3-side-die.png) and [game death](dusk_fort_3-game-die.png) visibly bow/dim but retain a standing stance. Inspect the current clip's peak reaction/final defeat or a short controller transition before altering motion. If those remain insufficient, a stronger controlled torso/head slump and supported knee bend can improve defeat identity while retaining floor, limb and source-edge gates. This is a readable-state concern, **not a confirmed anatomical collapse**; no weight/source/paid fix is requested from these images.

[Dusk circle windup](dusk_fort_3-1-windup.png) has a large studio instruction banner occluding the head and upper torso. Its danger boundary still reads; that frame cannot establish visible cast-face/upper-body readability. Treat it as a capture/UI occlusion, not a hidden accepted body pose or evidence that native combat has the same obstruction.

[Attack front](dusk_fort_3-front-attack.png), [side](dusk_fort_3-side-attack.png), [top](dusk_fort_3-top-attack.png) and [game](dusk_fort_3-game-attack.png) show stable arm volume and naturally directed hands. The six measured source-hand witnesses in [STATIC_ART_REVIEW.md](STATIC_ART_REVIEW.md) independently establish five source digits on both hands; small posed PNGs do not replace that proof or establish individual finger animation.

## All 25 pose states inspected

| View | Idle 0.50 s | Walk 0.30 s | Attack 0.60 s | Hurt 0.18 s | Die 0.66 s |
|---|---|---|---|---|---|
| Front | [PNG](dusk_fort_3-front-idle.png) | [PNG](dusk_fort_3-front-walk.png) | [PNG](dusk_fort_3-front-attack.png) | [PNG](dusk_fort_3-front-hurt.png) | [PNG](dusk_fort_3-front-die.png) |
| Side | [PNG](dusk_fort_3-side-idle.png) | [PNG](dusk_fort_3-side-walk.png) | [PNG](dusk_fort_3-side-attack.png) | [PNG](dusk_fort_3-side-hurt.png) | [PNG](dusk_fort_3-side-die.png) |
| Back | [PNG](dusk_fort_3-back-idle.png) | [PNG](dusk_fort_3-back-walk.png) | [PNG](dusk_fort_3-back-attack.png) | [PNG](dusk_fort_3-back-hurt.png) | [PNG](dusk_fort_3-back-die.png) |
| Top | [PNG](dusk_fort_3-top-idle.png) | [PNG](dusk_fort_3-top-walk.png) | [PNG](dusk_fort_3-top-attack.png) | [PNG](dusk_fort_3-top-hurt.png) | [PNG](dusk_fort_3-top-die.png) |
| Game angle (studio) | [PNG](dusk_fort_3-game-idle.png) | [PNG](dusk_fort_3-game-walk.png) | [PNG](dusk_fort_3-game-attack.png) | [PNG](dusk_fort_3-game-hurt.png) | [PNG](dusk_fort_3-game-die.png) |

Idle preserves broad symmetric armour and forward feet. Walk shows a modest stagger/lift without a broken ankle or reversed knee in these views. Attack reads as an outward cast. Hurt is subtle. Death has a coherent bowed spine/head with no observed collar tear or gross elbow/hip collapse. Hidden cloth surfaces and localized deformation between the witness times are untested visually.

## Four production VFX states inspected

- Dusk blade: [windup](dusk_fort_3-0-windup.png), [impact](dusk_fort_3-0-impact.png). Radius 7, 117-degree cone, warm segmented blade accents within the displayed cone.
- Demon brand: [windup](dusk_fort_3-1-windup.png), [impact](dusk_fort_3-1-impact.png). Radius 4 filled circle with flame accents; this attack has **no ring safe hole**, so its filled centre is appropriate.

Both footprints remain visible in the supplied studio states. No online damage, packet clocks, real cast/impact timing, safe movement route, device FPS or native night contrast was tested here. These are presentation witnesses of the existing VFX, not combat acceptance.

## Supplied numerical evidence inspected

Read-only `artifacts/meshy-boss-02/dusk_fort_3-runtime-qa.json`: all exported keys +24 Hz, actual indexed edges >=5 mm; unchanged ratio >2 AND extension >1 cm gate. All five clips report zero over-limit edges and failures; overall maximum ratio 1.5914756732 (die). Maximum limb-length error is 0.0000083608 m against the existing 0.005 m limit. Both idle foot drifts are 0. Worst reported native flat clearance is -0.0004117601 m (about -0.412 mm) in die, inside the existing -10 mm limit. Weight sum maximum error is about 1.11e-16.

Minimum triangle-area ratio is 0.1182076633, triangle 7127 at die 0.625 s; walk minimum is 0.2359116936 at 0.8000001 s. These are local area measurements, not the indexed-edge failure gate; their surface location and exact extreme frames were not independently inspected here. No gross visible failure is established by the 25 supplied states, and this review neither changes a threshold nor claims full every-triangle visual acceptance.

Only this Markdown report was changed for Dusk. No recapture, source/rig/model edit, Blender/paid/API call, build or audit rerun. Garuda/Rift old captures remain **UNAPPROVED** pending corrected final QA/evidence. Giant/Commander static prop-v2 approval does not accept their eventual rigs.

# Garuda final v2 — independent style/anatomy review

**Visible Thai style/anatomy PASS; full state-readability acceptance remains pending the planned strongest/final and continuous witnesses.** All 25 fresh poses plus four VFX states were visually inspected. Public GLB, animated metadata and all 25 pose rows match `c959ec1ba4da4b9da312d4a77e17852dba062ad7a3859f15398d54688718a939`: 1,578,248 bytes, 12,528 triangles, 18 bones, five named clips. [Capture metadata](himmapan_3-capture.json) records zero errors, loaded skinned geometry and no page overflow. Four VFX rows have no individual asset hash. This verdict replaces no failed v1 acceptance; it applies to corrected v2 only.

| Criterion | Score / verdict | Evidence |
|---|---|---|
| Thai style / Meshy consistency | 8.5 / PASS | Bird head/beak, Thai crown and gold collar/arm bands, indigo/teal feathers, ivory chest/wing tips and Thai cloth distinguish Garuda from the other five. |
| Visible anatomy / sampled deformation | 8 / PASS | One bird head, two arms/two hands, two legs/two claw feet and a separate symmetric wing pair. Front/side/top distinguish arm roots from wing roots; no gross tear, needle collapse, extra limb or reversed joint in the 25 states. |
| Bright studio identity readability | 8.5 / PASS | Broad ivory chest and wing tips identify the bird silhouette; gold crown remains distinct. Hands overlap feathers at some frontal/game angles but are separate in side/top evidence. |
| Sampled attack readability | 8 / PASS | Arms open outward/forward, retain volume and naturally directed open palms, independently of the two wings. |
| Sampled five-state contrast | 7.5 / PENDING | Walk/hurt are subtle at current witness times; death bows/dims while standing. Await current strongest/final/continuous evidence before further motion changes or a full >=8 state-readability verdict. |
| VFX footprint presentation | 8 / bounded PASS | Feather cone and circular gust footprint remain legible; no ring safe hole is expected for these two attacks. Circle windup banner hides head/upper torso in studio. |
| Technical usability | 8 / bounded PASS | Current model is below 15k triangles /3 MB. Supplied five-clip native audit has no unchanged gate failures; localized area contraction and full temporal visual acceptance remain qualified below. |
| Native desktop/mobile/night | UNTESTED | No corrected Garuda actual-world captures were reviewed. Future per-instance fog work is not accepted from these studio frames. |

## Reviewed anatomy and limits

[Front idle](himmapan_3-front-idle.png) and [front attack](himmapan_3-front-attack.png) preserve both five-digit source-hand silhouettes and coherent elbows. [Side attack](himmapan_3-side-attack.png) shows the arms in front of separate rear wing roots; no palm reversal is seen. [Top attack](himmapan_3-top-attack.png) separates all four appendage roots, with exactly two arms and two wings. [Back idle](himmapan_3-back-idle.png) and [back death](himmapan_3-back-die.png) retain symmetrical feather masses and intact visible spine/cloth, without a gross root split. Game/side views show three forward claw toes plus a rear toe on each foot; ankles/knees remain coherent in the sampled gait.

Rest wings are broad and lowered, rather than tightly folded. No gross arm/wing fusion is observed, but hidden contact seams, complete sweep clearance and native mobile framing are not established. Gold rings/feather overlap can obscure small arm details in a frontal view; side/top are needed for anatomy evidence. No source-model repair or paid regeneration is indicated by the inspected states.

[Game death](himmapan_3-game-die.png) and [side death](himmapan_3-side-die.png) bow the head/torso and carry wings rearward while both feet support the standing body. This differs from idle, but the current still does not establish a strong final defeat transition. The parent is supplying better current-clip witnesses; no new movement change is requested before those are reviewed.

## All 25 pose states inspected

| View | Idle 0.50 s | Walk 0.30 s | Attack 0.60 s | Hurt 0.18 s | Die 0.66 s |
|---|---|---|---|---|---|
| Front | [PNG](himmapan_3-front-idle.png) | [PNG](himmapan_3-front-walk.png) | [PNG](himmapan_3-front-attack.png) | [PNG](himmapan_3-front-hurt.png) | [PNG](himmapan_3-front-die.png) |
| Side | [PNG](himmapan_3-side-idle.png) | [PNG](himmapan_3-side-walk.png) | [PNG](himmapan_3-side-attack.png) | [PNG](himmapan_3-side-hurt.png) | [PNG](himmapan_3-side-die.png) |
| Back | [PNG](himmapan_3-back-idle.png) | [PNG](himmapan_3-back-walk.png) | [PNG](himmapan_3-back-attack.png) | [PNG](himmapan_3-back-hurt.png) | [PNG](himmapan_3-back-die.png) |
| Top | [PNG](himmapan_3-top-idle.png) | [PNG](himmapan_3-top-walk.png) | [PNG](himmapan_3-top-attack.png) | [PNG](himmapan_3-top-hurt.png) | [PNG](himmapan_3-top-die.png) |
| Game angle (studio) | [PNG](himmapan_3-game-idle.png) | [PNG](himmapan_3-game-walk.png) | [PNG](himmapan_3-game-attack.png) | [PNG](himmapan_3-game-hurt.png) | [PNG](himmapan_3-game-die.png) |

## Four VFX witnesses

- Feather attack: [windup](himmapan_3-0-windup.png), [impact](himmapan_3-0-impact.png). Radius 9 /117-degree cone with restrained pale-blue feather accents inside the displayed footprint.
- Gust: [windup](himmapan_3-1-windup.png), [impact](himmapan_3-1-impact.png). Radius 4.5 filled circle; filled centre is appropriate, since this is not a ring. Studio windup banner occludes the upper body, so it cannot certify cast-face readability. Danger boundary remains visible.

These captures establish bounded presentation only. No live damage, packet clocks, cast/impact synchronization, natural combat, night/fog visibility or device FPS was tested.

## Supplied numerical evidence inspected

Read-only `artifacts/meshy-boss-02/himmapan_3-runtime-qa.json`: all exported keys +24 Hz, indexed edges >=5 mm, unchanged ratio >2 AND extension >1 cm criterion. Zero failures/over-limit edges in all five clips; maximum edge ratio 1.7465438042 (die). Maximum limb-length error 0.0000223218 m, both idle foot drifts 0, worst native flat clearance about -0.420 mm; all inside existing gates. Weight maximum sum error about 1.11e-16.

**Numerical caveat for the forthcoming extreme witnesses:** local minimum area ratio is 0.0369897642, triangle 7774 at walk 0.1666667 s, and 0.0598568242 for the same triangle at die 0.6666667 s. The triangle's surface location and exact walk extreme were not independently identified here. Indexed-edge pass does not prove absence of localized triangle contraction. No gross visible collapse was observed in the supplied PNGs, so this is an unresolved location/visual check rather than an invented new gate failure. Preserve all existing limits.

Changed only this review document. No source/model/rig edits, Blender/paid/API calls, recapture, build or audit rerun. Rift remains unapproved while repose proceeds; Naga's pending stronger motion and native fog patch are outside the reviewed shipped revisions.
