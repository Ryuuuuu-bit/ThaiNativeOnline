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

- Historical card discoveries flow through `character/cardCollection.js` and
  authoritative `NetProgress` into the card journal; worn socket abilities use
  `combat/bossCardEffects.js` and guarded combat receipts. Character/Combat READMEs
  and `docs/technical/CARD_COLLECTION.md` describe the hooks. Live kit status
  snapshots use `net/combatState.js`; cleanse covers generic DOT and external
  movement conditions without serializing transient buffs.

- Loading readiness: `Game` awaits `createGame.readyPromise`, class avatar
  `ready`, visible interface images/fonts and the first usable render through
  `core/AssetReadiness.js`. `MapManager.prepare` waits only the destination's
  approved NPC models and active monster body cache; `MapCommit` retains the
  old world until render succeeds. Network connection is optional and starts
  afterward. Loading UI attempt handles guard stale callbacks. Hooks are
  documented in world, combat and training READMEs.

- Ordinary monster clip timing: `src/combat/monsterAttackTiming.js` is shared by offline Combat and `server/monsters.js`; targeted `mstrike` cues enter `NetCombat`/`CombatView`, while existing `ma` remains the only online damage release. `Game.leaveMap` clears offline strikes. See Combat README, "Hooks for ordinary monster strikes".

- Class coordination: rules `synergy` and `effect.taunt/armorBreak/weak` flow through `src/training/kitCombat.js` into offline `KitCaster` and authoritative `server/combatants.js`. Server cast accepts `{ world, player }`; `server/index.js` routes radial status events. Combat hooks are documented in `src/combat/README.md`.
- `src/combat/statusEffects.js` supplies bounded live status math and per-source status identity to combat, server monster AI and `src/net/NetCombat.js`; Character applies party utility buffs through `addBuff`, with no save-format change.
- `src/world/water-surfaces.js` supplies shared rendered water topology; `src/world/water-navigation.js` supplies the client World and server navigation predicate. The 0.22m wading limit applies only inside the exact static water triangles. Map bounds, solid collision, bridge decks and deep-water masks retain their precedence; shader ripples do not change navigation.
- GM authority flows from authenticated Accounts sessions and server-managed roles into the private `/gm` dispatcher. Server role changes commit before online privilege/catalog updates; client chat visibility is presentation only. Bootstrap `ADMIN_IDS`/`GM_ID` grants remain protected. See `docs/technical/SERVER_GM.md` for commands, storage and revocation behavior.
- GM title display: `data/titleAccess.js` supplies a transient WeakSet capability
  granted only by live server authorization/private metadata. Character and Social
  selection use it without changing earned achievements; storage excludes unearned
  worn selections while Combatants.me includes the live choice. Logout/revocation
  clears that choice and broadcasts it. See Character/Net README hooks and SERVER_GM.md.
- Account and Character UIDs are immutable server-owned metadata stored outside character save JSON. Own-account API/session metadata supplies display/copy UI; GM role targets may resolve Account UID to the existing account key without changing authentication or exposing email. Deleting and recreating a character produces a new Character UID.

- Equipment loot: offline Combat and authoritative MonsterWorld share `src/combat/lootDrops.js`; persistent roll metadata flows through Character instances, server progress/trade/stash and NetProgress. The combat README documents the hook; client actions reference owned `iid` values.
- Reusable flasks use server-owned instance UUIDs/charges across purchases, kill rewards, progress, trade and stash; town refill checks the actual city herbalist's proximity. Custom hotbar bindings resolve learned skill/consumable IDs; Q/E are dedicated flasks, R is AUTO, F interacts, Home resets the camera. AUTO uses `server/autoTargets.js` through NetCombat with rate limits and reply nonces, limited to the current map/channel. See `docs/design/EQUIPMENT_HOTBAR_FLASKS.md` and Combat README hooks.

- Stat persistence: CharacterUI build plans use atomic Character.allocateMany, mirrored by NetProgress as one alloc_batch and validated by server/progress. Multiplayer supplies authenticated session state; allocation/reset waits for server sync during reconnect. server/statOps acknowledges rate-limited stat predictions without applying them, and server/index sends a coalesced correction. Hooks are documented in src/character/README.md and src/net/README.md.

- Recall travel: MainMenu's recall tile and B route through Game -> social.pvp.recall. src/net/RecallCast.js tracks only transient channel UI; server/recall.js RecallCasts and server/index.js own the five-second completion, cancellation and revalidation. Party/NPC/world-boss warp timing is unchanged. See docs/technical/ONLINE_SAFETY.md and src/net/README.md.

- HUD and PK intent: `PvpPanel` creates the profile's `.hud-pk-toggle`, then
  `DynamicHUD` reparents it into the vitals footer. `PkMode` displays only
  server-confirmed `pvp_mode`/`pvp_state.mode`; public `pvp_state.pk` still means
  zone vulnerability. `server/pvp.js` guards free-PK attack intent independently
  of accepted duels. The final `ui/hud-theme.css` import unifies chrome across
  both skins and enlarges only player names/titles. See src/net/README.md hooks.
- Title prestige: `ui/titleAppearance.js` and `ui/titleTag.js` classify existing
  title metadata for presentation. `hud-theme.css` applies static ImageGen frames
  to player world labels, title previews and the selected HUD portrait; chat stays compact and server
  title ownership/unlocks remain unchanged. See docs/design/TITLE_APPEARANCE.md.
