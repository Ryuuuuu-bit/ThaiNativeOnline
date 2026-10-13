# Realtime UI hooks

- `Multiplayer` applies authenticated private `welcome`/`gmAccess` to the transient
  `data/titleAccess.js` capability, clearing it on disconnect. `SocialPanes` uses
  `availableTitles` for GM selection/counts; achievement toasts continue reading
  only earned `c.titles`. `NetProgress` accepts live selected titles only when
  `canWearTitle` permits them and never derives entitlement from a sync payload.
  The server refreshes live role authority for each selection and broadcasts
  removal of an unearned title on logout/revocation; GM-only selections are not saved.

- `Multiplayer` handles private `welcome`/`gmAccess` metadata from the server.
- `{ t: 'news' }` (sent to everyone when a GM posts or removes news with `/gm news`) makes
  the news window (`src/ui/news/NewsPanel.js`) refetch `GET /api/news` and light the menu dot.
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

## Hooks for PK attack mode and HUD theme

`PvpPanel` creates `.hud-pk-toggle` in the player profile before `DynamicHUD`
constructs its footer. `DynamicHUD` moves that same button into the footer;
its event handlers and confirmed state remain owned by `PvpPanel`/`PkMode`.
The final `ui/hud-theme.css` import supplies shared jade/brass tokens for both
saved skins and scales only self/remote character names and titles, leaving
NPC and monster nameplates unchanged.

A `pvp_mode` request carries an explicit boolean `on`. The server replies with
confirmed `on` and an optional refusal reason; a query retrieves current state.
`pvp_state.mode` carries attacker intent separately from `pvp_state.pk`, which
continues to describe vulnerability in the current zone. Mode OFF prevents
initiating free-PK attacks; it does not grant protection. Accepted duels bypass
the attack-mode gate. Mode resets on departure, death and a new connection.
The client never optimistically enables attacks; pending/unknown/offline states
are disabled, and a missing response triggers a state query.

Title presentation uses `ui/titleAppearance.js` to classify existing title IDs
and metadata. `titleTag.js` emits tier/theme attributes without changing achievement
ownership, unlocks, saved IDs or literal chat labels. `hud-theme.css` decorates
self/remote world labels, the dedicated title preview and the HUD portrait with
static ImageGen frames. `DynamicHUD` synchronizes the portrait's tier and theme
on character `titles`/`change` events, including temporary rank loss. Earned PK/sin
titles use the killer frame; merit/red-hunt titles use the guardian frame. Class
choice and attack-mode state do not select either theme.
Assets and generation receipts are in `public/ui/titles/imagegen-v1/` and
`docs/art/title-frame-assets/`. See docs/design/TITLE_APPEARANCE.md.

## Hooks for quest navigation

Multiplayer disconnect and identity logout cancel Game.questNav; reconnect never resumes a route. Entitlement, quest progress and server authority are unchanged. See src/quest/README.md and docs/design/QUEST_HUD_NAVIGATION.md.

## Temple fair transport hook

`Multiplayer` connects `Game.fair` to `fair_result`, link status and character
sync. `fair` messages carry intentions only; `server/temple-fair.js` owns timing,
random draws and atomic gold settlement. `Game` closes the panel on map leave.
After disconnect, an uncertain paid action must not be resent automatically;
wait for the server's current balance. See `src/fair/README.md` for the contract.

## Chat moderation (server/chat-guard.js)

- **World channel**: signed-in characters from Lv 5, one line every 5 s (GMs exempt). Guests and
  lower levels are told to use ช่องพื้นที่. Area, party and whisper keep presence's 0.8 s pace.
- **Rude words** are masked with ✱ on the server for world, area, party and whispers (`maskRude`:
  Thai inside words, English at word boundaries; spaced, dotted or stretched spellings too).
- **Blocks** live on the character (`Character.blocked`, max 100): the server does not deliver
  that name's public lines, whispers (the sender still sees an echo), party lines, party invites
  or trade requests (both answered as declined). Menu on a name plate, `/block` · `/unblock`, and
  the list in the friends tab. Messages: `block` · `unblock` · `blocks` → `{ t:'blocks', list }`.
- **Reports**: plate menu → reason, or `/report name note`; one per 30 s; stored with the
  reported player's last public lines (`chat_reports`), online GMs are told, `/gm reports [n]`.
- **Mutes** by account are stored (`chat_mutes`) and reloaded at start; a guest's lasts its session.
- **History**: the last 50 world lines and 30 lines of the arrival room (≤ 2 h old) are sent once
  per connection as `{ t:'chist', lines }`; ChatBox shows them dimmed above a divider. Tabs keep 100 lines.
- **Speech bubbles** (src/net/SpeechBubbles.js) over the speaker for area/world lines from this
  room, party lines and your own.
- **Announcements** (kind `announce`: GM `/gm say`, world boss, rare cards) go to the World tab,
  highlighted and not whisperable, with a copy in the System log (unread counted once). A GM
  ประกาศ also shows across the top of the screen (src/ui/AnnounceBanner.js) and is kept in the
  history replay. Personal lines (titles, loot, combat, buffs) stay in System.
