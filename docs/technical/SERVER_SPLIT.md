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
3. **Combat.**
   - Monsters live on the server, one set per map.
   - Clients send "cast skill X on monster Y" and "basic attack Y"; the server checks MP / cooldown / range / swing interval, rolls with `src/rules`, and broadcasts hits, deaths, EXP and loot.
   - Kit FX play on the hit events.
   - Parties share kills.
4. **Economy.** Shops, refining, trading and gold sinks on the server.

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
