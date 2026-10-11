# Realtime UI hooks

- `Multiplayer` handles private `welcome`/`gmAccess` metadata from the server.
  Only `admin: true` plus the server command catalog enables `ChatBox.setGmCatalog`.
  Disconnect, logout, revoked rights or a nonadmin welcome remove the help UI and
  private GM history. Local development controls are separate from GM authority.
- `ChatBox` renders catalog text safely, scrolls help, and clicking a command
  only fills the composer. Submission keeps Social's existing command routing.
- Authorization is exclusively server-side; see `docs/technical/SERVER_GM.md`.

## Hooks for stat persistence

Multiplayer passes `{ authenticated: !!session().token }` to attachNetProgress. Signed-in allocation/reset waits for the accepted server sync and an online connection; guests retain local allocation. Receiving a server sync also marks the link authoritative. Character emits `stat-connection` when a prediction cannot be sent. Build plans send one `alloc_batch`; server/statOps acknowledges rate-limited stat operations without granting points, and server/index coalesces one authoritative correction per burst. An accepted correction emits `stat-refused` for CharacterUI feedback. The 40-message budget and server-owned save remain unchanged.

## Hooks for recall channel

MainMenu's adventure recall tile calls Game -> social.pvp.recall; B shares the same handler in PvpPanel. RecallCast tracks pending/active UI state without granting travel. Server recall_cast starts the five-second countdown; recall_cancel, a map-changing authoritative position, a new connection identity and offline clear it. Same-map position corrections retain the countdown. Cancellation sends recall_cancel and waits for the server response. The cast indicator is hidden while idle. Server RecallCasts uses monotonic time and checks movement/combat/room state again at completion. Party, steward and world-boss travel keep their existing timing.
Starting recall stops walking, following, AUTO and pending attacks so automatic movement cannot immediately interrupt the channel. The online-actions shell hides when every contextual action is absent and karma is empty. DynamicHUD anchors quests below the minimap even while that shell is hidden.
