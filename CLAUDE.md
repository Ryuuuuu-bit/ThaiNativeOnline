# Thai Native Online Agent Rules

## Project Vision
Thai-inspired stylized 2.5D MMORPG.

## Art Direction
Stylized modern 3D MMORPG.
Thai / Ayutthaya-inspired.
Do not use modern architecture.

Mood: warm tropical daylight (markets, farmers, fishermen, many NPCs) versus a
darker supernatural night (fog, lanterns, dark forest, ghosts, magic, rare monsters).
Day and night should feel like two different games.

## Coding Rules
- ES Modules
- Three.js
- Data-driven systems
- Avoid large main.js
- Reuse shared systems
- Do not hard-code content data

## Agent Ownership

One set of owners. Each role is a Claude Code subagent in `.claude/agents/`
(ask for it by name, e.g. "ให้ qa ตรวจ"). An owner edits its files freely;
anyone else changes them only through a small, documented hook.

| Agent | Owns |
|---|---|
| `game-director` (lead) | `src/rules/**` (rules ported from ThaiNative: pure ES modules, no three, no DOM; change only via the lead), `CLAUDE.md`, `docs/GAME_VISION.md`, `docs/MILESTONES.md` |
| `gameplay-engineer` | `src/core/**`, `src/main.js`, `src/entities/**`, `src/npc/**`, `src/quest/**`, `src/ui/**`, `src/character/**` (not `data/`), `src/combat/**` (not `data/`), `src/account/**`, `src/training/**`, `src/audio/**`, `src/classes/model.js`, `src/classes/index.js` |
| `technical-artist` | `src/world/shaders.js`, `materials.js`, `Batching.js`, `Environment.js`, `Atmosphere.js`; `src/classes/model.js` clip handling; `src/classes/fx/**`; `tools/*-anims/**` |
| `environment-artist` | `src/world/Architecture.js`, `Vegetation.js`, `props.js`, `Terrain.js`, `Water.js`, `World.js`, `districts/**` |
| `world-designer` | `src/world/maps.js`, `CityMap.js`, `MapManager.js`, `Portals.js`, `Collision.js`; `src/data/landmarks.js`, `regions.js`, `halls.js`, `sites.js`, spawn placement; `docs/world/WORLD_MAP.md` |
| `content-designer` | `src/data/**` (content values), `src/combat/data/**`, `src/character/data/**`, `src/classes/*-moves.js`, `docs/world/*.md` (not WORLD_MAP) |
| `character-artist` | `docs/art/classes/**`, `public/models/**`, `public/fx/**` |
| `art-director` | review only; `docs/art/*.md` guides |
| `qa` | `tests/**`; small bug fixes anywhere, reported to the owner |
| `gap-auditor` | review only: finds what is missing or uneven across maps, classes, content, UI and docs; reports gaps with their owner (`docs/audits/` when asked) |

Every agent verifies with `docs/technical/VERIFY.md` (`npm test`, `npm run build`,
screenshots) and reports exact results.

## Important
Do not rewrite another agent's system without review (see the table above).
Do not introduce a new dependency without approval.
Do not change public interfaces without documenting it.

## Where things connect
- `src/core/Game.js` hosts every system. Character and combat plug in through
  `createGame()` from `src/combat/index.js` (interface: `src/combat/README.md`).
- Four maps, loaded one at a time and linked by portals (`src/world/maps.js`,
  loaded by `src/world/MapManager.js`, interface: `src/world/README.md`): `city`
  (นครอโยธยา, inside the walls, safe) and three zone maps beyond the closed North
  City Gate: `paddy` ทุ่งนาข้าว (Lv 1-3, reached by the warp in the gate passage),
  `deep_forest` ป่าลึก (Lv 2-5) and `wat_rang` วัดร้าง (Lv 4-7), joined by path
  exits. Class training halls sit in the city (`src/data/halls.js`);
  `src/data/sites.js` reserves ground for structures such as the วัดร้าง temple.
- `src/data/spawns.js` places monster zones on the three zone maps (the city is
  safe); monster types come from `src/combat/data/monsters.js`.
- The minimap and full map (`src/ui/Minimap.js`, `src/ui/minimap/`) paint each
  map from the built world and its data (`theme`, `levels`, portals, landmarks).
- Characters are Tripo GLB models only (`public/models/`, `AVATARS` in
  `src/data/training.js`; classes without one wear the fallback model).
  `src/training/` (interface: `src/training/README.md`) puts the class model on
  the player through `Player.setAvatar()`. The playable classes, มวยไทย and
  หมอยา, also get their ten-skill kit (`src/classes`) and a straw dummy in the
  city to try them on.
- `src/main.js` runs `src/account` first (login → character select → creation;
  interface: `src/account/README.md`). Per-character saves go through
  `slotStorage` from `src/core/SaveSlot.js`, never `localStorage` directly.
- One UI look on every page: layout and older rules live in `src/style.css` and
  the per-module CSS; `src/ui/theme.css` (loaded last) gives every in-game box
  the same skin (dark glass, gold hairline, corner brackets, flat buttons). The
  windows open from one menu button bottom-right (`src/ui/MainMenu.js`); the
  settings window is tabbed (ภาพ · เสียง · การเล่น · ปุ่มลัด) and holds the key
  guide. On "high" quality `src/world/PostFX.js` adds bloom, a colour grade and a
  vignette. Skill FX from `src/classes/fx/fx.css`. One action bar on
  every map: `src/ui/ActionBar.js` (owned by CombatHUD). Kit classes fill it through
  `src/training/KitCaster.js` (kit skills hit the Tab target or monsters through
  `Combat.damageMonster`, the dummy in the city); others through
  `src/combat/LegacyCaster.js`. Keys: 1–0 skills, G auto, Q/F potions, C, I, Tab.
  A page's own CSS (`training.css`) holds only what differs.
  Icons go through `src/ui/icons.js`: class portraits/emblems (`classBadge`),
  skill art (`iconHtml`, data `img`) and potion gourds. Skill art is framed by
  `tools/icons/normalize.py` (sources in `tools/icons/source/`); never use emoji
  where art exists.
- Sound: one engine, `Sound` from `src/audio/Sound.js` (music / sfx / ambience
  buses, unlocked on the first click). SFX recipes, event → sound mapping and
  the generative Thai-style music live in `src/data/audio.js`; call
  `Sound.sfx(id)` / `Sound.music(id)`, never create another AudioContext.
- Click-to-walk plans its route with `findPath(canStand, from, to)` from
  `src/core/GridPath.js`; combat's `moveTo` still walks straight and retries.
- `src/core/` (including `Game.js`) is where systems meet: its owner is
  gameplay-engineer, but other agents may add small, documented hooks there.
