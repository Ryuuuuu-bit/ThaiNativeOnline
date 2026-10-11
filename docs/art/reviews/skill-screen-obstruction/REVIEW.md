# Skill screen obstruction — visual review

Status: APPROVED

Art Director scores: style match 8.5/10, readability 8/10, Thai identity 8/10, technical usability 8.5/10.

Final direct/high1/high06 cast frames retain local Shaman projectiles with readable terrain, targets and HUD. candidate-aoe-4.png and candidate-aoe-9.png preserve supernatural ritual motifs; character and dummy silhouettes remain visible through translucent effects. No blocking visual regression or opaque full-screen layer appears in the captures.

Storm still occupies much of the central playfield at zoom 3. Approval covers the rendering correction, not an overall effect-density reduction. QA's stable projected particle-size measurement was reviewed but not independently repeated by Art.

Evidence: baseline-cast-high1.png, baseline-cast-high06.png, baseline-cast-direct.png; candidate-cast-high1.png, candidate-cast-high06.png, candidate-cast-direct.png; candidate-aoe-4.png, candidate-aoe-9.png; candidate-zoom-1.png, candidate-zoom-3.png and candidate-remote-cast.png.

The exact user-reported full-screen opaque obstruction did not reproduce on SwiftShader. Physical GPU/mobile behavior remains unverified. No required visual changes for this bounded correction.
