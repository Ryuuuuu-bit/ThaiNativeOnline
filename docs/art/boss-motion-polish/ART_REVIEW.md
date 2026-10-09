# Boss motion polish — independent Art review

Reviewed 2026-10-09 on `codex/boss-motion-polish`, against [DIRECTOR_BRIEF.md](DIRECTOR_BRIEF.md), [ART_BIBLE.md](../ART_BIBLE.md) and the existing map-boss skill registry.

**Bounded Art PASS for the twelve current primary map bosses. No confirmed gross-anatomy, detached-grip, reversed-blade or presentation P1/P2 was found in the inspected frozen samples.** Style, visible anatomy, combined body/cast/VFX readability and technical usability reach at least 8 in this stated scope. These grades do not certify continuous motion, native online encounters or physical-device performance.

## Scope and evidence

[Capture receipt](capture.json), captured **2026-10-09T15:39:09.158Z**, contains **312 isolated production-controller/VFX PNG rows**: 36 idle, 120 windup, 132 impact (including 12 mobile images), and 24 footprint views. All 312 referenced PNGs exist. The reviewer visually inspected **46 image files**: the labelled gallery and all five angle sheets, plus 40 individual full-resolution captures. The five sheets cover the eight overlay bipeds' first-skill hold/release from front, side, back, top and game angles; they are overview witnesses rather than close hand proofs. Individual inspection includes both weapon holders, all twelve mobile studio images, both-skill examples, Naga idle/hold/release/coil, species-specific shapes, and selected whole-ring footprints. This is not a claim of visually inspecting every one of the 312 images.

These captures use actual shipped body models, the production phase controller and VFX in an isolated review scene. They use headless Edge/SwiftShader, desktop 1180×960 and genuine touch emulation 390×844. PNGs crop the review stage; they do not show the complete in-game mobile HUD or a natural server encounter.

The capture helper's route serves each frozen candidate motion GLB directly to its intended public motion URL; the mobile context uses the same route. Public bodies load through the normal loader. The eight currently published motion GLBs were independently hashed and exactly match the frozen manifest. Their bodies also match the manifest and final audits. Across all twelve bodies, all **300 explicitly body-hashed rows** match current public GLB bytes. The 12 mobile rows omit a per-row bodyHash; they are linked by type, the shared capture run/route and frozen manifest, rather than independently claiming a mobile network-byte hash.

## Scores and verdicts

Readability below means body identity and sampled hold/release **with the authoritative warning/impact presentation** at the supplied 2.5D and mobile studio framing. It is not an 8/10 claim for dramatic body-only choreography. Retargeted body movement is deliberately small; Mine and Rift rely more on phase/VFX cues.

| Boss / type | Style | Anatomy | Readability | Tech | Bounded visual finding |
|---|---:|---:|---:|---:|---|
| ควายป่า `buffalo` | 8 | 8.5 | 8 | 8 | Broad bovine torso, pale horns and four hooves stay coherent; head preparation/release remains species-specific. |
| นางตะเคียน `takian` | 8.5 | 8.5 | 8 | 8 | Rooted tree base, green costume and hair mass remain distinct; no imported human gait or invented legs. |
| ผีปู่โสม `pusom` | 8.5 | 8.5 | 8 | 8 | White elder mantle, open empty hands and planted feet remain coherent; no introduced staff. |
| ชาละวัน `chalawan` | 8.5 | 8 | 8 | 8.5 | Wide arms and continuous tail distinguish the body; release opens the upper-body silhouette without a visible tail-base break. |
| เจ้าป่าช้า `bamboo_grave_3` | 8 | 8 | 8 | 8.5 | Bent forearms/open palms are readable in profile and mobile; no observed frontal elbow needle or reversed palm. |
| ผู้พิทักษ์เหมือง `sealed_mine_3` | 8.5 | 8 | 8 | 8.5 | Stone shoulders, crown and open hands stay coherent. Cast motion is restrained; stone VFX carries much of the phase cue. |
| นาคราชเฝ้าประตู `sunken_city_3` | 8.5 | 8.5 | 8 | 8 | Continuous hood/neck/coil/tail, no legs or wings; forward neck release remains distinct from the upright idle. |
| เจ้าอสูรสนธยา `dusk_fort_3` | 8.5 | 8 | 8 | 8.5 | Red/ivory/gold blocks and outward hands remain clear; no observed armor/waist tear or invented held sword. |
| ยักษ์เฝ้าหุบเขา `giant_valley_3` | 8.5 | 8.5 | 8 | 8.5 | Right-hand club contact remains plausible; shaft/head stay continuous and change angle visibly in release. |
| พญาปักษาทมิฬ `himmapan_3` | 8.5 | 8 | 8.5 | 8.5 | Bird head, two arms, two claw feet and separate wings remain readable; arms are distinguishable from wings. |
| ขุนพลอาคม `fallen_city_3` | 8.5 | 8.5 | 8.5 | 8.5 | Right-hand dha hilt contact and continuous curved blade remain coherent; white/indigo blocks and blade angle read clearly. |
| เจ้าอสูรรอยแยก `demon_rift_3` | 8 | 8 | 8 | 8.5 | Amethyst/ivory armor and two horns remain clear; restrained palms/torso and ritual VFX provide the phase cue. |

All rows are bounded PASS. Approved source fingers are preserved as hand blocks; no individual finger animation or new five-digit recount is claimed. Front/profile/game/mobile samples reveal no gross extra/missing limb, inverted foot, visible joint separation or prop detachment. Anatomy scores complement the supplied numerical audits; neither proves every hidden triangle or all-frame local volume.

## Grip, coil and footprint witnesses

- **Giant:** [front hold](giant_valley_3-0-windup-front.png), `slash-meshy` at .34s, clearly shows the anatomical right hand (viewer-left in front) enclosing the club shaft. [Side release](giant_valley_3-0-impact-side.png), .60s, keeps that contact as the club projects forward. The other hand is open and is not misidentified as the gripping hand. Mobile retains the club silhouette. No two-handed grip or complete physical-contact trajectory is claimed.
- **Commander:** [front hold](fallen_city_3-0-windup-front.png), `slash-meshy` at .28s, shows the right-hand hilt/guard relationship. [Side release](fallen_city_3-0-impact-side.png), .58s, raises the same continuous curved dha. Guard, blade curve and narrow edge remain coherent; no detached hilt, rubber blade or visible grip reversal was found. Blade bevel/contact throughout every transition remains untested.
- **Naga:** [idle](sunken_city_3-game-idle.png), [hold](sunken_city_3-0-windup-game.png), and [release](sunken_city_3-0-impact-game.png), body `attack` at .40/.62s for hold/release, retain a continuous grounded coil while the upper neck changes pose. [Top second-skill release](sunken_city_3-1-impact-top.png) shows the uninterrupted source coil/hood/tail. The receipt marks the .62s image as recovery; it is not relabelled as a sampled instantaneous strike peak. Zero coil drift remains supplied numeric evidence, not a measurement made from a PNG.
- **Other species-specific bodies:** Buffalo preserves four legs, horns and tail; Takian preserves its rooted base; Pu Som preserves empty palms and his elder body. Their original clips receive phase timing rather than humanoid donor retargeting.
- **Ring safety:** selected [Chalawan](chalawan-1-footprint.png), [Giant](giant_valley_3-1-footprint.png) and [Rift](demon_rift_3-1-footprint.png) whole-footprint views show a visibly unpainted inner safe area and ornament on the annulus. A boss standing inside the hole is not danger fill. No visual claim of exact damage geometry or all 24 whole-footprint inspections is added.

Recorded first-skill hold/release source times are Buffalo .20/.62, Takian .34/.60, Pu Som .32/.60, Chalawan .32/.58, Bamboo .36/.63, Mine .34/.60, Naga .40/.62, Dusk .28/.56, Giant .34/.60, Garuda .26/.56, Commander .28/.58 and Rift .36/.64 seconds. These are receipt action times, not wall-clock windup lengths or proven continuous-frame maxima. Impact capture uses each type's `BOSS_MOTION_PROFILES[type].releaseSeconds`, **.22–.35s after the staged impact**, recorded in each row's `requestedTime`; .35s applies to Giant, not every boss.

## Technical evidence and earlier failures

[Final asset audit](asset-qa.json) reports **PASS**, stable hashes, 5,192 samples and 24Hz sampling. The eight asset pins match the currently published files. The unchanged eligibility/failure rule is actual indexed edges at least 5mm, failing only when ratio >2 **and** extension >1cm. Reported limits remain arm error 5mm, foot drift 1.5mm, floor -10mm, rigid transform error .0001 and protected transform error 1e-6.

The separately supplied [production controller audit](controller-qa.json) was read: **PASS**, stable hashes, **1,599 samples**, all eight candidate body/motion pins matching the files reviewed here. The durable copy was independently hashed and exactly matches the originally reviewed audit. Parent reports 16 cycles; the numeric audit was not rerun by this Art reviewer. Its SHA-256 is `478a220dd6909aa5a223ca10507fe262677d8a8fbe12551ba0a6b9e10e17471b`. It complements the frozen phase screenshots; it is not a continuous visual or FPS certificate.

Earlier Mine/Giant/Rift transfer failures documented in [TECH_REVIEW.md](TECH_REVIEW.md) remain valid historical rejection evidence. Current passing audits supersede that publication hold **for these exact replacement motion bytes**. The frozen manifest's retained `pendingDeformationQA` list is an earlier staging field; it is closed by the matching final asset/controller audits, not silently treated as current failure. Gains were reduced for the affected donor transfers; the current scope remains restrained motion, not unrestricted full-strength retargeting.

The reviewer ran `npm run build`: **PASS, 251 modules**. The existing large-chunk warning remains. No numerical audit, browser capture, paid request, generation or Blender process was launched during this review.

## Exact asset pins

Full public body and optional motion SHA-256 values independently checked at review time:

| Type | Public body SHA-256 | Public motion SHA-256 |
|---|---|---|
| `bamboo_grave_3` | `b068b44f7159ec28acc3d2a0b96b88539ddd2aed6e5b78db97dcb4e595161b79` | `4df1f8505cb38a5eb8e073b24b25738661a71219b7811763464aae7e25e46f0d` |
| `buffalo` | `7d9edf0dfe5bf860ba167b7e3e1420965f14e6a9c2aa69495d857d0c2e371735` | Original body clips; no overlay |
| `chalawan` | `1d44ccc84b13b8698390207ddf72bf474252d24ddbe704cbe308dec4ae3afc55` | `4ce5729d87b1264991f566d5148a54b1e784013d5bd71734b9ff64582e9a238f` |
| `demon_rift_3` | `5f622db6ac315aa0632e5ddc8f2a35a944daff830236fbc8872bb39a3316371a` | `03fbbbe88d3c206466ce663db886765c66aa64f6b064eb38b7be73a95e88bfe5` |
| `dusk_fort_3` | `e570992477ed5a48f59382f333b6739f6b01dc0c1c82ddc29697b79b1ca9a36a` | `0f834062414177bdf28dc65cf56b498fa32e7e2ff4ac57c035c0db078046422e` |
| `fallen_city_3` | `6fc4a6fad3cb82d4ebfd85ac0e71e99f22598b4fb8e49355c3f748e2fb3c8e0e` | `7080a45db16eefb9865944969bce7a9c06b570b344655e9bab00d67df290fc69` |
| `giant_valley_3` | `bbbb0fc757216a69b1fcfff649e300010e8bf4b007c9f85b6338a7d81d546915` | `507c9950426aed0bae1e156d4bb7bdebd5e8fdd545424f9faf4c1dba122aedbd` |
| `himmapan_3` | `87187a592ed037f2e3a394db3f8fe7fc484d8b0388eb2dd273ccffd3d80ffd45` | `fa14a242189c80d913d0442b9ce68cde244d0fd9c7419226937d0a226a11f79b` |
| `pusom` | `02ac2f11849d70ef2bb84c08e3d25dc1b40d603c3b0d83407c1efc54fdc67f58` | Original body clips; no overlay |
| `sealed_mine_3` | `eac366b7efad407cd2201b36c49265ab852acd7fdccb1c2317df4deabfc532dd` | `0d124a3f5a61d45073533245779566e62ae999a5c051c6c73a40ba5e11fb9195` |
| `sunken_city_3` | `4fa20542ebb027ee11295de31a39892c332a4b1811e9460e2d628af84c965bea` | Original body clips; no overlay |
| `takian` | `208770e56e70395f34acc0d0cb1b14e58f3139735a0d151de6098bbe10243004` | Original body clips; no overlay |

The four original-species bodies have no optional humanoid motion file in this delivery. The eight overlay files derive from the four Meshy source-library actions recorded in the [frozen manifest](delivery-manifest.json), donor SHA-256 `a1dc3dd947907f1d3b14fa905eedda60cd67fcbc83dd14497a607f10fbcb807b`. They are retargeted upper-body rotational micro overlays with approved lower-body/hand/prop data retained, not wholly Meshy-authored full-body animation.

## Frozen PNG and receipt pins

- [capture.json](capture.json): `b7013ebaf0406c720b5979d807bcae5b2dd4b75308b2abfc909a898398a27db6`
- [delivery-manifest.json](delivery-manifest.json): `4ce951857ead5bebe1f8b28bd2f5af0e3857fca8cc0ad6741fee98c2aa93c4bd`
- [asset-qa.json](asset-qa.json): `09c7442491b3cd316f0a4392f1ea4bac21d8221bb938b2995f3610c6554396f1`

All 312 isolated PNG files were independently hashed. SHA-256 of the UTF-8, ordinal filename-sorted index of lines `filename|lowercase-sha256\n` (one final newline) is `f8d0a2eb8abae957e3fb345e04f1e58f0d6b502a963a05e20fa76c35204c7e62`. Hash coverage does not mean every PNG received visual inspection.

| Inspected PNG | Actual controller sample | PNG SHA-256 |
|---|---|---|
| [giant_valley_3-0-windup-front.png](giant_valley_3-0-windup-front.png) | slash-meshy 0.34s; hold | `96eb8dc12f1c20c0624210b1a3267e046f278b84212d0e5b58214de757c01732` |
| [giant_valley_3-0-impact-side.png](giant_valley_3-0-impact-side.png) | slash-meshy 0.60s; release | `740c72d2d187e6f9cd38ff0a6e53155c2680e54db290290089546e5aaacd3c49` |
| [fallen_city_3-0-windup-front.png](fallen_city_3-0-windup-front.png) | slash-meshy 0.28s; hold | `ceb7c16f4089108c5339d99aeafc40b68cc445ed0c12e06e9128995c3c924bcb` |
| [fallen_city_3-0-impact-side.png](fallen_city_3-0-impact-side.png) | slash-meshy 0.58s; release | `6def246a5435dd70938504ee8d9f8dd5ba3f1d4b05b9a1390c8d400c478cc296` |
| [sunken_city_3-0-impact-game.png](sunken_city_3-0-impact-game.png) | attack 0.62s; recovery | `d1aba89532d281ac3bf51491d8c8b09e2faa4b258685cd485bfedae98b409ddd` |
| [sealed_mine_3-mobile.png](sealed_mine_3-mobile.png) | cast-meshy 0.60s; release | `a04a542cd00ce9516fffba9f4333957446315137b3573d7d3f8ce09e41ca64b6` |
| [demon_rift_3-mobile.png](demon_rift_3-mobile.png) | cast-meshy 0.64s; release | `d38317a6be543368906cc8d0ff85924035a36e04f52d5595a00e1035976cffec` |
| [chalawan-1-footprint.png](chalawan-1-footprint.png) | ritual-meshy 0.32s; hold | `9a418c019782a8647a9d2ee152d879aa03cda914fc7ae2d0dee10cdf6f73a1ca` |

Overview screenshots: [labelled gallery](eight-bosses.png), [front](angles-front.png), [side](angles-side.png), [back](angles-back.png), [top](angles-top.png), [2.5D game](angles-game.png). Gallery sizing is presentation-only; the verdict is anchored to the isolated pinned captures and asset bytes.

## Limits and changes

Body gestures are intentionally modest, with fixed fingers, retained foot animation and rigid props. Fine hand/contact details can be occluded in individual views. The warning hint overlaps some top-view subjects; those hidden surfaces are untested in that frame, not certified by their captions. Close shots may exclude the outer footprint; the selected whole-ring witnesses address only the inspected rings. Mobile body framing is clear in the studio, but full HUD fit, native night/fog/canopy readability, live server impact timing, continuous transitions, unseen compression surfaces/volume and physical-device FPS remain outside this review. Existing numerical tolerances are not relaxed.

Only `docs/art/boss-motion-polish/ART_REVIEW.md` was written. Source, tests, models, motion files, capture helpers and screenshots were not changed. New map-boss icon UI is separate work and has not been visually reviewed here.
