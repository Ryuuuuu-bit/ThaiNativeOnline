# Thai textile direction for city NPCs

Status: artist direction for local texture work, not an asset acceptance receipt. Covers the existing 17 Meshy body families and their approved NPC-ID reuse. No extra Meshy stage, paid image generation, new gameplay marker or costume-body replacement is requested.

Source of truth: [Game Vision](../../GAME_VISION.md), [Art Bible](../ART_BIBLE.md), [family briefs](NPC_MODEL_BRIEFS.json) and the actual selected source revision. Historical prompts are not evidence that a requested garment exists. Preserve submitted requests and rejected revisions separately; this direction does not update paid-stage provenance.

## Main decision

Give clothing a readable Thai textile identity through a few broad woven borders and restrained prajam yam accents. Keep the face, garment silhouette and role colour blocks dominant. Most cloth should remain plain; aim for roughly 85–90% plain area rather than covering every panel with a pattern. This is an art starting point, not a new numerical asset test.

Use original simplified game motifs. These are Thai-influenced contemporary fantasy designs, not certified reproductions of a named regional textile, period uniform or sacred garment. A generic diamond alone is not sufficient proof of Thai identity; combine the selected motif with the actual wrapped clothing, palette and role props.

## Small shared motif vocabulary

| Code | Artist construction | Use |
| --- | --- | --- |
| W | Broad stepped or nested diamond repeat, with quiet horizontal separator bands; suggest weaving without drawing individual threads | Merchant, supplier, working clothes and waistcloths |
| P | Simplified ประจำยาม / prajam yam-inspired four-petal rosette, centred in a small diamond field; broad petals, open negative space, no tiny internal curls | Sparse cuff, hem or sash accents on keepers, instructors and guards |
| T | One or two plain stitched/woven edge bands, with low-frequency cloth shading | Practical workers and plain monastic robes |

Use one principal repeat and at most one supporting edge treatment per body. Align the repeat along the garment edge, not along the image's UV axes. A patterned cuff follows its circumference; a skirt border follows its hem. Keep repeats visually consistent across separate UV charts of the same seam.

Avoid imperial dragon roundels, dense cloud medallions, copied court insignia, Greek-key borders, pseudo-writing, glowing runes and modern sportswear graphics as substitutes for the specified motifs. No ornamental religious symbols, Buddha imagery, yantra or invented sacred text on the monks' robes. Gold is muted painted thread, not reflective armour or emissive light.

## Role palette and placement

All colours below are starting swatches; retain useful shading and tune against the actual texture and native lighting. Paint only garment surfaces that actually exist. Do not invent sleeves, shoulder cloths, trousers or sandals by painting them onto bare skin.

| Family | Main blocks | Restrained textile placement |
| --- | --- | --- |
| warp_keeper | Ivory #e8e0cc, jade #3f6956, muted brass #c9a35a | Pilot: jade cuff and lower-tunic bands with a few ivory/brass P repeats; small matching sash-edge accent. Keep headwrap quiet. The accent conveys a service uniform, not a new destination badge or gameplay state. |
| general_merchant | Ivory, indigo #3d4a6b, ochre #c19a52 | W on the actual indigo lower wrap's hem; narrow ochre sash-end border. Do not paint fictitious trousers over the robe. |
| gate_supplier | Ivory, terracotta #a8432f, indigo #34405c | W along the corrected full skirt hem and sash ends. Preserve the generated hat; keep its weave broad and low contrast. Existing duplicate hats remain suppressed by integration. |
| blacksmith | Slate/brown work cloth, crimson #a8432f | T or a small W strip on waistcloth/sash ends; apron stays mostly plain and work-worn. Retain the generated apron exception, with no duplicate procedural apron. |
| enhancer | Oxblood #5a2a22, charcoal #2b2622, muted brass | P on cuff edges and a short lower-shirt border; quieter than the sword master's trim. |
| herbalist | Cream #e3d8b8, sage #5f7a4a, brown #6b5a45 | Sage W/T on skirt hem and waist tie. Keep blouse centre and working forearms quiet. |
| occultist | Readable charcoal, crimson, aged brass | Sparse crimson W at sash ends and muted T at cuffs. Use the corrected wrapped source; borders do not excuse the rejected modern pocket-shirt. No skull ornament or invented sacred text. |
| master_muay | Warm skin, crimson shorts, cream wraps | W on shorts hem or waistcloth ends only. Chest/shoulders remain bare after the false-shirt texture repair; no chest pattern, tattoo or painted shirt. |
| master_sword | Indigo, crimson, muted gold | P along the real jacket/lower-panel edge and cuffs, with one plain gold separator. Preserve the actual dha and grip; no sword-shaped embroidery. |
| master_hunter | Brown #6b5a45, olive #536047, rust sash | Low-contrast W on sash ends; T at the lower wrap. Keep chest, aiming wrists and the pack area uncluttered. |
| master_herbal | Cream, jade, brown | Small jade W on waistcloth ends and restrained T at cuffs. Retain the older face; a border is not a remedy for the wristwatch-like texture detail. |
| master_shaman | Ivory, ochre, rust | Sparse muted-ochre P on robe edge/cuffs and a simple sash-end band. Keep large cloth folds readable and seated hand contact visible. |
| master_bandit | Charcoal, crimson, muted rust | Low-contrast W on sash ends and lower-wrap edge only. Correct the false athletic-top appearance first; keep actually exposed chest skin plain. |
| city_guard | Brick red, brown/charcoal, muted brass | Compact brass P along wrap edge/cuffs and sash ends. Reuse a consistent service uniform across posts; no invented military rank insignia or imperial robe layout. |
| monk_elder | Matte saffron #c98321 with tonal cloth shading | Plain robe with T only: subtle stitched/woven edge, not gold decorative rosettes. Preserve bare shoulder and clear prayer-hand silhouette. |
| monk_novice | Matte saffron/orange #db8b27 | Same plain T vocabulary, scaled for the smaller body. Do not compensate for small screen size with dense ornament; robe clearance remains a motion requirement. |
| boatman | Blue-gray #6f7f86, brown, quiet cream | W on sash ends; T at shirt hem. Paddle/headwear remain the main role cues. |

For reused vendors, vary existing cloth tint or one sash colour within the family palette. Do not assign a different dense motif to every identity. Six distinct masters should retain their distinct body/colour/prop silhouettes rather than become identical gold-trimmed uniforms.

## Scale at the 2.5D camera

Adult starting widths: cuffs about 3–5 cm, hem/sash borders about 4–6 cm, principal motif repeat about 5–8 cm. Fit these to the actual garment; they are not guaranteed screen sizes. Scale the novice's border to its smaller clothing rather than importing adult centimetres unchanged.

At the normal interaction/gameplay camera, aim for a visible border roughly 2–4 CSS pixels wide; where a rosette is intended to be individually recognisable, allow roughly 4–6 CSS pixels across its repeat. These are proposed composition targets, not claims about unmeasured captures. Record viewport, pixel ratio and zoom when judging screenshots. At farther distances it is acceptable for the motif to merge into a clean border while the role colour blocks remain readable.

If the border vanishes or flickers, simplify the repeat, enlarge its broad shapes or reduce its frequency. Do not add finer lines or sharpen the entire texture. A 1024-pixel texture does not by itself establish readable pattern size. Judge the final resized/compressed texture with normal mipmaps, not only a magnified 2K atlas or a posed thumbnail.

## Local texture contract

- Select actual garment faces by inspected geometry and garment/chart connectivity, then rasterise their UVs into the mask. Broad Y bounds alone can include skin, arms or another cloth layer; the coordinate frame must match the source/preparation transform.
- Exclude skin, hair, face, palms, fingers, toes, existing props and their contact surfaces. Muay and Bandit false-clothing repairs precede decorative borders. Pattern must not conceal a failed anatomy or costume gate.
- Handle overlapping/mirrored UVs explicitly. If a garment chart shares pixels with skin, stop and report the conflict; do not bleed motif onto another surface or silently alter UVs.
- Fit bands to actual cuffs/hem/sash edges. Use padding confined to the selected charts and seam-aware continuity; check opposite sides and inner folds for broken repeats or leakage.
- Preserve geometry, indices, normals, UVs, joints, weights, inverse binds, node hierarchy and animation data. Only texture data and its required container bookkeeping may change. A full GLB hash will change; preserve before/after hashes and verify the non-texture contract rather than claiming identical whole-file bytes.
- Retain the existing one-material/primitive and final 1024-pixel texture budget. No added normal map, transparent decal draw, emissive pattern or extra light is requested. The existing 16k triangle and under-800,000-byte shipping targets still apply; actual output needs measurement.

## Pilot and acceptance evidence

Begin with warp_keeper after the geometry/weight pilot is ready. Keep the same selected source and camera for plain/patterned comparisons; do not change rig, animation, lighting or gameplay scale to make the pattern look better.

Required bounded witnesses: front/back and a useful cuff/hem close view; actual gameplay desktop/touch at the intended body scale; then an existing native night view when available. State missing night or world evidence as untested, without forced clock changes. Record selected source SHA, texture input/output SHA, final GLB SHA, motif code, masked garment regions and capture context.

Accept when Thai textile treatment is recognisable through the restrained border vocabulary, the face and role remain primary, neighbouring families remain distinguishable, and the shipped texture shows no skin leakage, stretched motif, seam jump or noisy shimmering. Check idle plus an existing work/walk pose for cuff/hem behaviour; texture-only changes do not automatically certify the rig or cloth clearance.

Art Bible targets remain Style Match, Readability and Technical Usability at least 8/10. No score or PASS is awarded by this document. Do not waive a weak result because generation credits were already spent, and do not fix a weak garment silhouette by decorating it more heavily.

## Reference boundary

The game's selective-detail rule comes from the Art Bible. [SACIT's Thai textile design course](https://academy.sacit.or.th/courses/7/info) distinguishes cloth/pattern types and discusses contemporary applications of colour and textile design; this supports treating weave, colour and garment use together. [The Fine Arts Department's Thai-pattern examples](https://finearts.go.th/storage/contents/file/xMUgPwM90o4Pqr9RywlnSlxtDFVjp95O1yECZipZ.pdf) provide visual-study context for pattern families and borders. The role placements, simplified motif constructions and screen-size targets above are original game art direction, not requirements claimed from those sources. Do not copy a published illustration or ascribe a regional provenance to the game's simplified tiles without a separate review.

This direction was originally authored as a planning document before implementation.
The resulting per-family textiles and actual acceptance evidence are recorded in
[RELEASE_REPORT.md](RELEASE_REPORT.md); the planning-stage pilot status is historical.
