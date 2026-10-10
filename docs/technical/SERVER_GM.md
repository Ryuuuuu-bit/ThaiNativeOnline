# Admin commands

The server exposes the existing 24 gameplay/moderation commands plus `admin`:
`/gm admin add <accountId>`, `/gm admin remove <accountId>`, `/gm admin list`.
Account IDs are trimmed and lowercased; character names are not role identifiers.
`ADMIN_IDS` and `GM_ID` supply protected bootstrap accounts that commands cannot
remove. There is no hardcoded privileged username. Configuration changes take
effect when the server starts with that environment.

`server/gm-catalog.js` is the single catalog/parser for `/gm help [command]`,
private discovery metadata and the chat help button. The namespace and command
names are case-insensitive; `level` aliases `lv`, `points` aliases `stat`.
Help lists required arguments and optional defaults. Selecting a help row only
fills the composer; sending is explicit. Numeric `gold` fields remain unchanged;
currency messages use ตำลึง. Existing item/currency caps and gameplay stay intact;
gifts report the quantity actually accepted by the recipient.

Every privileged dispatch revalidates the server-held hello session token and
fresh effective role. It requires the exact live presence object and persisted
character account; forged packet tokens, flags and IDs confer no authority.
Logout clears the token binding and private catalog immediately. Local role
epochs and a post-await token/identity check prevent delayed reads from restoring
revoked privileges. Trade/stash busy state is checked again after authorization.
Revocation clears the online god toggle. All welcome paths refresh authorization;
precomputed privilege metadata is stripped before merging the fresh result.
Authentication/storage errors fail closed. Development-mode controls never
authorize GM operations. `runGm` remains an internal synchronous compatibility
utility and is not a network dispatcher.

Successful role writes commit before online metadata changes. PostgreSQL startup
idempotently creates `admin_roles` and `admin_role_audit`. A global advisory lock
and transaction recheck the actor's current role and target account, update the
role and audit together, and commit before publishing the result. Bootstrap IDs
are protected. MemoryStore preserves dynamic roles only within its running
instance; PostgreSQL preserves them across process restarts. Role add/remove use
durable audit records; command dispatch/list and gameplay mutations are logged
without session tokens or passwords. Help/catalog/list responses are private;
announcements and intended target notifications remain visible to their recipients.

Validation covers direct denial, delayed logout/revocation and transfer races,
normal/guest forged packets, private help/list, online grants/revocations, god
reset, same-map welcomes and persisted character changes after reconnect. Role
transactions/restart/rollback use MemoryStore and a SQL test harness. A live
PostgreSQL database and production GM accounts were not tested.

UI evidence: [admin and regular chat review](../art/admin-gm/review/README.md), covering desktop, portrait and landscape.
`tools/gm-review.html` is a local component fixture using actual chat styles and
the server catalog, with no connection to the GM dispatcher; its query flag is
not authorization. Six browser cases verify normal users have zero help controls,
admins have 25 command rows, layout stays inside the viewport, selection only
prefills, and revocation removes help/history. Checks also cover channel routing, keyboard tabs, offline retention, emoji insertion/length limits, collapse, left drag and right-drag isolation. Closing the GM panel restores history on short screens. Browser pages report no JS errors.
Actual desktop Game integration also passes at 1440×900: focused typing over
twenty fixed simulation frames moves the player 0m; trusted Enter submits the
exact Thai message. Scrolling history leaves world zoom unchanged, and right
dragging chat leaves camera yaw unchanged. Regular/revoked controls and catalog
rows are absent; JavaScript errors are zero. Loaded city/hero screenshots show
the edge panel preserves the central playfield and combat footer. This isolated
guest fixture blocks network writes and supplies private catalog metadata for
visual testing; authorization is established separately by real HTTP/WS tests.
Physical mobile keyboards and live-device HUD overlap remain unverified.

Final frozen-source checks: 856 tests, 854 passed, zero failed and two existing
optional skips (71.87s). Build passed with 302 modules and the existing large-chunk
warning. Focused GM/role/authority tests passed 19/19. Component Art review:
Style 9/10, Readability 8.5/10, Technical Usability 9/10.

