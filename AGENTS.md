# Thai Native Online — Agent Instructions

## Source of Truth
1. docs/GAME_VISION.md
2. docs/world/*
3. docs/art/*
4. docs/technical/*

## Legacy Policy
The old ThaiNative project is a gameplay/design reference only: classes, monsters, progression, quests, economy, lore, server ideas.
It is NOT the visual authority.

ThaiNativeOnline is a visual reboot. If legacy visuals conflict with docs/art/ART_BIBLE.md, ART_BIBLE.md wins.

## Workflow
Game Director -> specialist agent -> Art/Tech review -> QA -> PR.

Before editing:
- inspect current implementation
- read role-relevant docs
- avoid unrelated rewrites
- preserve modularity
- run `npm run build`

Every task report must include summary, changed files, validation, screenshots for visual work, and known limitations.

## Git
Do not work directly on main. Use task branches and PRs.

## Where things connect

- Class coordination: rules `synergy` and `effect.taunt/armorBreak/weak` flow through `src/training/kitCombat.js` into offline `KitCaster` and authoritative `server/combatants.js`. Server cast accepts `{ world, player }`; `server/index.js` routes radial status events. Combat hooks are documented in `src/combat/README.md`.
- `src/combat/statusEffects.js` supplies bounded live status math and per-source status identity to combat, server monster AI and `src/net/NetCombat.js`; Character applies party utility buffs through `addBuff`, with no save-format change.
- `src/world/water-surfaces.js` supplies shared rendered water topology; `src/world/water-navigation.js` supplies the client World and server navigation predicate. The 0.22m wading limit applies only inside the exact static water triangles. Map bounds, solid collision, bridge decks and deep-water masks retain their precedence; shader ripples do not change navigation.
