# Server / client split

The rule: anything that touches **items, gold, EXP or fairness** is decided on the
server; anything that is **look, feel or responsiveness** stays in the browser.
`src/rules` is plain JavaScript with no DOM, so the server runs the same formulas the
client uses for prediction.

| Area | Server decides | Client does |
|---|---|---|
| Accounts / login | password check, character saves (Postgres) | login screens |
| Position | walk-speed check, refuses teleports, relays to the same map | moves at once (prediction), eases other players (interpolation) |
| Monsters | spawn, HP, aggro, chase, death, respawn — one shared monster per map | models, animation, HP bars |
| Damage | rolls with `src/rules` (crit, evasion, armour) | FX, floating numbers |
| Skills | MP, cooldown, range, buff/debuff effects | moves, FX, action bar, instant feedback |
| Basic attack / AGI | minimum swing interval (anti speed-hack) | sends the swing |
| Loot / gold / EXP / level | server only (loot goes straight into the bag) | display |
| Bag / shops / equipment | server only | UI, sorting, search, compare arrows |
| AUTO | validated exactly like manual input; online only | chooses what to press |
| Chat / party | relay, filtering, rate limits | chat box |
| Settings, camera, sound, AUTO settings | — | stored per browser |

## Phases

1. **Presence — done.** See other players on the same map, with their class model, walk and skill moves, name plate (class, level), and global chat.
   - Combat, saves and the economy still run in each browser.
2. **Accounts and saves — done.** Postgres in the Railway project (UAT has its own, `Postgres-byq9`, linked as `DATABASE_URL`).
   - Login on the server (scrypt hashes, 30-day session tokens, 10 tries a minute per address).
   - The character lives in the database, so it plays from any device; the browser keeps a copy and sends it back every 20 s and when the page closes.
   - Old local-only accounts move across on their first login (the local password is checked, then the account and its characters are created on the server).
   - Presence shows the character the server has saved (name, class, level).
   - Still trusted from the browser until phase 3: what is *in* the save (stats, items, gold).
3. **Combat**, in three steps:
   - **3a. Shared monsters — done.**
     - The server runs one set of monsters per map (`server/monsters.js`) and owns the world clock.
     - Everyone on a map fights the same monsters.
     - Hits go to the server, which takes HP off for everyone, ticks damage over time, applies stuns and slows, and shares kills: EXP to everyone who did at least 15%, gold and loot to the top damager.
   - **3b. Damage rolled on the server — done.**
     - The browser sends only "I cast skill X" and "skill X / basic attack / the dog landed on monster Y"; the server rolls every blow with the same rules (`src/training/kitCombat.js`, `src/rules/stats.js`) from its own copy of the character sheet, and everyone (the attacker too) sees the server's number.
     - Checked: the skill is in the player's class kit, cooldowns (with the DEX cut, 15% + 0.3 s slack for lag), a cast's blow budget for 6 s, basic-attack and dog-bite speed (attack speed, 2 saved up), and reach from the player's last accepted position.
     - Area skills: the browser names only the main target; the server finds who else is in the circle / line / fan. Stuns, slows, damage over time and self buffs are applied on the server.
     - Still trusted from the browser in 3b (fixed for signed-in players by 3c): the character sheet itself (level, stat points, gear — sanity-checked: stat points no more than the level gives, real items only), MP, and the player's own HP and defence. Skill level is 1 for everyone.
   - **3c. Progress written by the server — done** (signed-in characters; guests stay in their own browser).
     - The server's copy of the character is the real one: loaded from the save on join, it earns the kill rewards (EXP, level, gold, drops), pays MP for casts, loses gold on death, and is saved to the database every 30 s and on leaving.
     - The player's own actions (buy, sell, use, equip / unequip, stat points, reset, sort) still happen at once in the browser and are mirrored as `op` messages that the server replays with the same code (`Character`, `ShopSystem`); one it cannot replay brings the server's copy back (`sync`).
     - The save sync can no longer change the character: the server's copy (in play, else stored) replaces it; a new slot starts as a fresh character of the chosen class (old local-only characters move across without their progress).
     - One tab per character: opening it elsewhere closes the older connection after saving it.
     - Still the browser's: the player's own HP (monster swings are resolved there), and which shop the player stands at.
4. **Economy and the player's own state** (signed-in characters):
   - **4a — done.** HP is the server's: a monster's swing at a signed-in player is resolved on the server (dodge, defence, elite heavy hits, ghost power at night) and sent with the swing; deaths are the server's call (no respawn, and no gold loss, without one); regen follows the server once a second.
   - Quests run on the server with the same `QuestSystem` (kills counted from the server's kills; accept / hand in / talk mirrored as ops); rewards are paid there, and the save's quest key is the server's.
   - Buying needs a shop of that kind on the player's map (from `src/data/npcs.js`) and no fight in the last 5 s. Selling from the bag stays allowed anywhere (half price), as designed.
   - Still open: the exact spot of the shop NPC (the server has no road graph), whether a `talk` objective's NPC is really near, refining / trading / gold sinks when those systems arrive.

## Phase 1 details

- **`server/index.js`:** serves `dist/` (the built game) and the WebSocket at `/ws`. Railway runs `npm run build`, then `npm start`; local dev runs `npm run dev` + `npm run server` (vite proxies `/ws`).
- **`server/presence.js`:** pure rooms/validation logic, tested in `tests/presence.test.js`.
  - Names and chat are cleaned.
  - Numbers must be finite and inside the world.
  - Moves faster than 9 m/s are refused.
  - Each socket gets 40 messages/s.
  - Chat allows one line per 0.8 s.
  - The server holds 300 players at most.
- **`src/net/`:**
  - `NetClient` connects and reconnects with backoff, and stays offline quietly when there is no server.
  - `RemotePlayers` draws other players' models eased toward their latest spot.
  - `Multiplayer`:
    - sends the position about 10×/s (only when it changed, plus a 1 s keep-alive);
    - mirrors every move clip the local model plays (`Player.onAnim`);
    - runs the chat box (Enter to type).
- **Messages:** JSON objects with a type `t`. The list is in the header of `server/index.js`.

## Phase 2 details

- **`server/store.js`:** Postgres via `DATABASE_URL`, or memory without it (local dev, tests).
  - Tables: `accounts (id, salt, hash, created)`, `sessions (token, account, expires)`, `characters (account, slot, data jsonb, updated)`.
  - Created on start if missing.
- **`server/accounts.js`:** register / login / sessions / save validation, tested in `tests/accounts-server.test.js`.
  - Only the known save keys are accepted, and each must be parsable JSON.
  - The save must contain a character, and it is capped at 256 KB.
- **`server/index.js` `/api`:** `health`, `register`, `login`, `logout`, `slots` (GET), `slots/:n` (PUT / DELETE).
- **`src/account/ServerAccounts.js`:**
  - `ServerAccountStore` has the same interface as the local `AccountStore`, so the screens are unchanged.
  - `startSaveSync` keeps the slot on the server.
  - `src/account/index.js` picks the server store whenever `/api/health` answers.
- **Guests:** they stay in their browser.

## Phase 3a details

- **`server/monsters.js` `MonsterWorld`:** pure; tested in `tests/monsters-server.test.js`.
  - It is the same behaviour as `src/combat/Combat.js` (wander, aggro, chase, attack, leash, respawn by phase), but with many players.
  - The server has no terrain, so monsters may walk through rocks or houses while chasing.
- **`server/index.js`:**
  - Runs a `WorldClock`, broadcast every 10 s and on arrival.
  - Steps each map's monsters 10×/s and sends what changed (`mt`).
  - Routes `ma` (a swing at one player) and `kill` (one player's share).
- **`src/net/NetCombat.js`:**
  - On the first `mlist` it sets `combat.remote`. Combat then skips its own monster AI, and the hunter's dog bites go through `damageMonster`.
  - It replaces `combat.damageMonster` / `debuff` with messages to the server.
  - It eases monsters between updates and applies kill rewards.
  - Offline, Combat is untouched.

## Phase 3b details

- **`server/combatants.js` `Combatants`:** pure; tested in `tests/combatants-server.test.js`.
  - One entry per player: a server-side `Character` built from the sheet (`sane()`), its skill cooldowns, open casts and two rate buckets (basic attacks, the dog).
  - `cast(id, skill)` opens a cast (blow budget = the skill's hits × 3 + 4, for 6 s) and applies its self buff; a refused cast answers `nope` (the browser shows "สกิลยังไม่พร้อม" for a cooldown).
  - `blow(id, world, players, msg)` rolls and applies one blow, its splash and its effects (once per cast per monster).
- **`server/monsters.js`:** the trusted `hit` / `deb` messages are gone; damage only comes in through `damage()` from `Combatants`.
- **`server/index.js`:** `ch` (sheet; logged-in players start from their saved character), `cast`, `blow`; buffs tick with the server loop; night crit follows the server clock.
- **Browser:**
  - `KitCaster` emits `kit-cast` and names the skill on every blow; online it leaves area splash to the server.
  - `Combat` names `basic` / legacy skills, and online the dog sends `pet` blows without rolling.
  - `NetCombat` sends `cast` / `blow` / `ch` and shows hits and misses only from the server's `mh` (the local roll only drives the animation).

## Phase 3c details

- **`server/progress.js`:** `fromSave` (a stored character, unknown items dropped), `applyOp` (replays one action), `reconcileSave` (a browser save with the server's character in it). Tested in `tests/progress-server.test.js`.
- **`server/combatants.js`:** `load()` a signed-in character in full; `op`, `reward`, `respawn`, `me` (its JSON + `ack`, the number of actions replayed), `live(account, slot)`; MP is paid on cast and regenerates in `tick`. The `ch` sheet is ignored for these characters.
- **`server/accounts.js`:** `save(id, slot, data, live)` keeps the browser's other keys and the server's character; `putCharacter` stores the server's copy.
- **`server/index.js`:** `op` / `resync`; `sync` on join and after a refused action; `me {mp, ack}` once a second; level-ups broadcast from the server; saves every 30 s and on leaving; a second connection to the same slot kicks the first (`kicked`).
- **`src/net/NetProgress.js`:** mirrors the character's own actions (wrapping `useAt`, `sellAt`, `equip`, `unequip`, `allocate`, `resetStats`; the `bought` / `sorted` events from `ShopSystem.buy` / `sortBag`), adopts `sync` when no action of its own is still in flight (else asks again), and follows the server's MP when it drifts.

## Phase 4a details

- **`server/combatants.js`:** `swing(id, def, power)` → `{ dodge }` | `{ dmg, hp, dead }` for signed-in players (guests still resolve their own); `respawn` only after a death the server saw; buying checked in `op(id, msg, map)`; each signed-in character has `quests` (`questsFor`, the browser's `QuestSystem` over an in-memory store), counted from `reward` kills (kill events now carry the monster `type`).
- **`server/progress.js`:** `SHOP_MAPS` / `shopOn`, `questsFor`, quest ops; `reconcileSave(data, server, quests)` replaces both the character (HP included) and the quest key.
- **`server/accounts.js`:** `save(…, live = { c, quests })`, `putCharacter(…, quests)`, `quests(id, slot)`.
- **`server/index.js`:** `ma` carries `res` for signed-in players; `dead` from the browser only asks for a respawn; `me` carries HP.
- **Browser:** `Combat.monsterAttack(m, res)` lands exactly on the server's HP; `NetProgress` mirrors quest actions, adopts the server's HP and quest state.
- Tests: `tests/progress-server.test.js` (swings and deaths, shops, quests); e2e on a real server: a tampered local HP is replaced on join, swings arrive resolved, a city shop bought from the paddies and a village purchase mid-fight are refused, and the stored HP is the server's.
