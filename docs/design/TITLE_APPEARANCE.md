# Title appearance

Title prestige is a client presentation choice. `src/ui/titleAppearance.js` classifies existing title metadata; `titleTag.js` emits `ttl-{tier}` and `data-title-tier`. Unlocks, progress, title ownership, ranking and stored IDs stay unchanged in `src/data/titles.js` and the server.

Priority is: a dynamic title with one holder → sovereign; legendary category or `glow` flag → legendary; explicit epic IDs → epic; explicit rare IDs → rare; everything else → common. Counts for healing, kills, sin and levels are not compared against one global difficulty threshold. Unknown future titles remain common unless their metadata explicitly identifies legendary or sovereign prestige.

| Tier | Existing titles | Appearance |
| --- | --- | --- |
| Common | Rookie, Lv10/Lv20, early hunting/PvP and social milestones | 14px IBM Thai inside the common ImageGen banner |
| Rare | Individual bosses, Lv30/50/75, hunt1000, medic, duel50, redhunt50, pk50, merit1000, sin2k, cp_top10 | 15px type inside the rare ImageGen banner |
| Epic | boss_all, lv99, hunt5000, duel200, redhunt200, pk200, merit10k, sin10k, cp_top3 | 15px type inside the epic ImageGen banner |
| Legendary | Legendary category or glow metadata | 16px type inside the legendary ImageGen banner |
| Sovereign | Dynamic one-holder ranks cp_top1, lv_top1, enh_top1 | 16px type inside the sovereign ImageGen banner |

Decoration applies only to player world plates (`.plate.is-self` / `.plate.is-player`) and the title preview (`.pv-plate`). Chat and list labels retain literal title text, existing colours, and existing bracket formatting; their markup gains classification attributes and a literal text span only. NPC and monster labels are unchanged. Original title colour remains in `--ttl`, including sin reds and purples. Player/preview text mixes this hue with warm cream for contrast; the source hue remains available in `--ttl`; raster tier frames retain their designed palette. Chat keeps the original literal colour.

Fourteen new ImageGen raster frames provide five prestige pairs and two title-fashion pairs. No new fonts, blinking/pulsing animations or PostFX are added. The existing IBM Thai UI font, a crisp single text shadow and zero glyph stroke protect Thai letterform clarity; ornament belongs to the static raster frame rather than the letterforms. Legendary type is 16/14 times common size. Tier banner heights increase modestly and retain the title above the unchanged character name and class, keeping the complete nameplate compact. The same static appearance applies under reduced-motion settings and daytime/nighttime scenes. Browser screenshots and contrast review are recorded with the HUD QA report.

## ImageGen frames and paired profiles

Raster banners are `/ui/titles/imagegen-v1/{common,rare,epic,legendary,sovereign}.webp`; matching circular profile ornaments are `profile-{tier}.webp` in the same directory. Image generation prompts and asset admission records are maintained with the production manifest. Text is rendered by the existing live DOM, never baked into a raster image.

The banner uses horizontal nine-slicing of the complete ImageGen image, preserving the emblem, jade field and original gold rails. Live `.ttl-label` text is transparent, with no extra background, border or padding. Each image has its own measured vertical text offset inside the quiet jade band. Cap width is reserved before text layout. Minimum banner widths are 180/192/208/220/232px and frame heights are 44/50/60/64/64px; killer/guardian frames are 64px. Natural title width is capped at 320px or the viewport minus 32px. The existing Thai catalog remains at readable 14/15/16px sizes. Image ornaments replace the earlier CSS diamond/crown pseudo-elements. Live text and its crisp shadow remain if an image fails to load; the original profile HP/brass ring remains underneath the transparent circular ornament.

`DynamicHUD.js` adds `.g-player-portrait` to the existing portrait and updates `data-title-tier` from the equipped title through `titleTier`. Character `titles`/`change` events update the frame, including losing a temporary rank title. No separate frame preference, unlock, portrait replacement or extra title is created. An unequipped/unknown title uses the common profile frame.

CSS fetches only banner/ring URLs applied to visible labels or the selected profile, rather than preloading all five tiers. Gallery examples intentionally display all tiers side by side. Reduced-motion remains static. The preview pairs each banner with its matching original portrait and allows viewing at the actual game size or a larger comparison size.

## Killer title fashion

The existing IDs `pk1`, `pk10`, `pk50`, `pk200`, `sin2k`, `sin10k` and `lg_sin50k` use the paired `killer.webp` / `profile-killer.webp` crimson/antique-brass frames. `titleTheme(title)` emits `killer` for those IDs, `guardian` for the explicit good-karma IDs below and `heroic` otherwise. The killer and guardian themes each add two ImageGen frames, bringing the total to fourteen. The original five prestige tiers and text sizes still apply; no title is granted or unlocked by the frame system.

`data-title-theme` is applied to title markup and the existing HUD portrait alongside `data-title-tier`. Class choice, PK mode, kill thresholds and unrelated PvP titles do not select this theme. Equipping, changing or losing the title changes both paired ornaments through the same character events. Chat/list text remains literal without frame ornaments. The gallery includes common and legendary killer examples in both lighting conditions.

## Guardian title fashion

The existing IDs `redhunt1`, `redhunt10`, `redhunt50`, `redhunt200`, `merit1000`, `merit10k` and `lg_merit50k` use `guardian.webp` / `profile-guardian.webp`: an ivory, gold and emerald lotus/sword pair. These seven IDs select presentation only. Unlocks, PvP rules, karma thresholds, class and current PK toggle remain unchanged. The gallery includes early and legendary guardian examples alongside killer and prestige examples, using the production sizing in both lighting conditions.
