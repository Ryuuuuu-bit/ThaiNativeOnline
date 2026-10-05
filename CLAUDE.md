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

World Agent:
src/world/**

Character Agent:
src/character/**

Combat Agent:
src/combat/**

QA Agent:
Tests and bug fixes only.

Lead (orchestrator):
src/rules/** — game rules ported from the original ThaiNative project
(stats, damage, progression, economy, content data). Pure ES modules: no
three, no DOM. Character and Combat consume it; change it only via the lead.

## Important
Do not rewrite another agent's system without review.
Do not introduce a new dependency without approval.
Do not change public interfaces without documenting it.

## Where things connect
- `src/core/Game.js` hosts every system. Character and combat plug in through
  `createGame()` from `src/combat/index.js` (interface: `src/combat/README.md`).
- `src/data/spawns.js` places monster zones in the city; monster types come
  from `src/combat/data/monsters.js`.
- Click-to-walk plans its route with `findPath(canStand, from, to)` from
  `src/core/GridPath.js`; combat's `moveTo` still walks straight and retries.
- `src/core/`, `src/data/`, `src/ui/`, `src/entities/` and `src/npc/` are shared
  and have no named owner yet: edit them only with small, documented hooks and
  tell the other agents.
