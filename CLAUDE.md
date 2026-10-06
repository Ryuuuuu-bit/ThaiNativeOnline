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
| `gameplay-engineer` | `src/core/**`, `src/main.js`, `src/entities/**`, `src/npc/**`, `src/quest/**`, `src/ui/**`, `src/character/**` (not `rig/`, `data/`), `src/combat/**` (not `data/`), `src/account/**`, `src/training/**`, forest page code (`src/forest/main.js`, `model.js`, `sprite.js`, `audio.js`) |
| `technical-artist` | `src/world/shaders.js`, `materials.js`, `Batching.js`, `Environment.js`, `Atmosphere.js`; `src/character/rig/**`; `src/forest/fx/**`; `tools/*-anims/**` |
| `environment-artist` | `src/world/Architecture.js`, `Vegetation.js`, `props.js`, `Terrain.js`, `Water.js`, `World.js`, `districts/**`; `src/forest/scene.js` |
| `world-designer` | `src/world/maps.js`, `CityMap.js`, `MapManager.js`, `Portals.js`, `Collision.js`; `src/data/landmarks.js`, `regions.js`, spawn placement; `docs/world/WORLD_MAP.md` |
| `content-designer` | `src/data/**` (content values), `src/combat/data/**`, `src/character/data/**`, `src/forest/*-moves.js`, `docs/world/*.md` (not WORLD_MAP) |
| `character-artist` | `docs/art/classes/**`, `public/models/**`, `public/fx/**` |
| `art-director` | review only; `docs/art/*.md` guides |
| `qa` | `tests/**`; small bug fixes anywhere, reported to the owner |

Every agent verifies with `docs/technical/VERIFY.md` (`npm test`, `npm run build`,
screenshots) and reports exact results.

## Important
Do not rewrite another agent's system without review (see the table above).
Do not introduce a new dependency without approval.
Do not change public interfaces without documenting it.

## Where things connect
- `src/core/Game.js` hosts every system. Character and combat plug in through
  `createGame()` from `src/combat/index.js` (interface: `src/combat/README.md`).
- The world is two maps split at the north gate, `city` and `wilds`
  (`src/world/maps.js`); `src/world/MapManager.js` keeps one in the scene and
  swaps them through portals (interface: `src/world/README.md`).
- `src/data/spawns.js` places monster zones (all in the `wilds` map); monster
  types come from `src/combat/data/monsters.js`.
- `src/training/` (interface: `src/training/README.md`) swaps a class's rig for
  its modelled GLB (`AVATARS` in `src/data/training.js`); Muay Thai also gets a
  straw dummy in the city to test skill damage from `src/rules`. It hooks into
  `Game` and `Player.useModel()`. `?rig` turns it off.
- `src/main.js` runs `src/account` first (login → character select → creation;
  interface: `src/account/README.md`). Per-character saves go through
  `slotStorage` from `src/core/SaveSlot.js`, never `localStorage` directly.
- Click-to-walk plans its route with `findPath(canStand, from, to)` from
  `src/core/GridPath.js`; combat's `moveTo` still walks straight and retries.
- `src/core/` (including `Game.js`) is where systems meet: its owner is
  gameplay-engineer, but other agents may add small, documented hooks there.
