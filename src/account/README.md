# src/account — login, character select, save slots

`src/main.js` awaits `enterGame(root)` before `new Game().start()`:

1. **Login** (`screens.js` → `showLogin`): log in, register, or play as a guest.
2. **Character select** (`showCharacterSelect`): a 3D stage (`src/ui/ModelPreview.js`) shows the class model of the slot under the pointer. `ACCOUNTS.slots` (4) slots per account. Each slot can be played, deleted (after a confirm), or filled with a new character.
3. **Creation** for an empty slot (3D stage of the chosen class; its ten-skill kit with icons, click one to see the move): the existing `showCreation` from `src/character`, which already locks unfinished classes.
4. The chosen slot becomes active through `SaveSlot.use(prefix)` (`src/core/SaveSlot.js`).

The session persists in `localStorage` across tabs and browser restarts, with migration from older `sessionStorage` sessions. Server tokens are validated on resume. The settings panel gets **เปลี่ยนตัวละคร** and **ออกจากระบบ** buttons; logout clears both stores. `?login` always shows the screens.

## Local only — not security

Accounts live in this browser's `localStorage`:

- passwords are stored only as a PBKDF2-SHA256 hash with a salt
- the check runs on the client, so this is a stand-in until there is a login server
- a server can later replace `AccountStore.register/login`; the game only sees `{ id, guest }` and a slot prefix

## Save slots (documented interface change in shared code)

Every per-character save goes through `slotStorage` (Storage-like, prefixes keys with the active slot):

| Save | File |
|---|---|
| `tno.character.v1` | `src/character/Character.js` (gameplay-engineer) |
| `tno.quests.v1` | `src/quest/QuestSystem.js` via its `storage` option, passed in `Game.js` |
| `tno.discovered.v1` | `src/core/Game.js` |
| `tno.location.v1` | `src/world/MapManager.js` (world-designer) |

- **Prefixes:** guest slot 0 = `''`, so saves from before accounts existed appear as the guest's first character. Every other slot = `tno.<account>.<slot>/`.
- **No slot chosen** (tests, other pages): the prefix is empty, so behaviour is unchanged.
- **Data:** `src/data/accounts.js` holds the slot count, id rules, minimum password length and PBKDF2 iterations.
- **Tests:** `tests/account.test.js`.

## UID hooks

ServerAccountStore reads private accountUid/characterUid metadata outside save JSON, with token/epoch guards against old login responses. Guest/logout/failed resume clear it. identity.js publishes presentation metadata from account initialization and private Multiplayer welcome/identity messages; it is not authentication and is never written into session or character saves. UidRow supplies wrapped selectable text, keyboard-safe copy and visible fallback in selection/settings/CharacterUI. SaveSync passes the selected incarnation UID as a compare-only guard; the server owns permanent UID columns. See docs/technical/ACCOUNT_CHARACTER_UID.md.

## Deletion and save acknowledgement

`ServerAccountStore.deleteSlot` returns a Promise of `{ ok, code?, msg? }`.
Signed-in slots, local saves and UID/rename metadata are removed only after an
HTTP success with `{ ok: true }`. A server `in_play` refusal or failed connection
keeps the card and displays a Thai explanation. Character selection disables
play/delete/logout while waiting; duplicate deletion requests share one pending
operation. Late responses cannot clear a different token, identity epoch or
character incarnation. Guest deletion remains local; the synchronous local
AccountStore interface remains supported by the same screen.

`startSaveSync` retains its `{ push(keepalive?), stop() }` interface. It captures
the token, account, epoch, slot prefix and incarnation UID at startup. Every
callback verifies those values before saving or acknowledging a response.
Only successful HTTP **and** successful JSON acknowledge the exact submitted
bundle; an unchanged failed bundle retries after 0.5–10 seconds of exponential
backoff. Changes during a request coalesce into the next write rather than being
acknowledged by the older response. Writes are serialized, including a replacement
sync waiting for the preceding request. Visibility/pagehide flushes retain
`keepalive`; when a request is already running, the latest flush follows it.
`stop()` cancels timers and unregisters both lifecycle handlers. An already-sent
request may still reach the server, but its old response cannot restart the sync.

The client cannot guarantee a queued final flush survives immediate process or
tab termination; authoritative disconnect/shutdown saving remains on the server.
Regression tests in `tests/account-network.test.js` use mocked HTTP, controllable
timers and lifecycle events without modifying live accounts.
