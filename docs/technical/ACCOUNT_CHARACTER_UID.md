# Permanent account and character identifiers

The server assigns public opaque identifiers: `ACC-` followed by 32 uppercase
hexadecimal digits for an account, and `CHR-` plus 32 digits for a character.
Each value contains 128 random bits generated with Node crypto. These are
copyable support identifiers, not passwords, session tokens or authorization.
Never infer an account's identifier from a Google email or a character name.

PostgreSQL stores these in `accounts.account_uid` and
`characters.character_uid`, independent of save JSON. Startup creates the
columns and unique indexes, backfills existing rows, and sets both columns
NOT NULL in one transaction under a global advisory lock. Concurrent starters
serialize; collisions roll back to a savepoint and retry at most eight times.
Other failures roll back the migration and abort startup. A later restart
retains committed values. New account/slot inserts target only their primary
key conflict; a UID collision retries rather than impersonating a taken slot.
Character updates, rename, stash, trade and receipt replay never update UID
columns. Delete/recreate generates a new Character UID. MemoryStore supports
the same metadata during its instance lifetime but is not restart persistence.

## Private service metadata

- `Accounts.session()` and successful registration/login/Google return
  `accountUid` alongside existing session fields.
- `Accounts.identity(accountId)` returns `{accountUid}` or null.
- `Accounts.slots(accountId)` adds `characterUid` to each row, outside `data`.
- `Accounts.characterIdentity(accountId, slot)` returns
  `{accountUid, characterUid}` only for that owned existing slot.
- After `Accounts.character()` reads a slot, `characterUid(accountId, slot)`
  synchronously returns the identifier paired with that read. Persisted live
  state must capture it alongside the inventory revision.

UIDs are exposed through authenticated private responses, never public
rosters. These metadata helpers do not return emails, credentials or hashes.
Session ownership checks remain at the API/WS boundary. Guest/offline state
does not have a server UID.

`Accounts.save(..., live, {characterUid})` and
`Accounts.putCharacter(..., {characterUid, inventoryRevision})` pass the UID
as an expected incarnation, not a replacement value. The store checks it
against the locked owned slot; stale snapshots cannot overwrite a recreated
character. Legacy callers without metadata remain compatible. Client JSON
cannot assign the dedicated server UID.

`/gm admin add|remove` accepts an Account UID (case insensitive) or an existing
normalized account ID. Resolution produces the internal account ID; role
authorization, protected bootstrap roots, transaction checks and audits retain
that key. Character UIDs and unknown Account UIDs do not grant privileges.

## Validation limits

Tests cover random uniqueness, Google/session stability, slot save/rename,
deletion/recreation and stale writes, role resolution, stash/trade/replays,
concurrent startup/backfill, collision retry and transaction rollback. The
PostgreSQL tests exercise real query-generation code through a transactional
SQL harness; no live PostgreSQL database or production account was modified.
No deployment or role configuration changes are part of this task.
The actual Google owner's Admin assignment remains pending identification by
their Account UID; this feature does not guess a Google-derived account key.

Final frozen-source suite: 878 tests, 876 passed, zero failed, two existing
optional skips (45.45s). Production build passed with 307 modules and the
existing large-chunk warning. Focused backend checks passed 52/52, including
eleven UID tests; client/API/HTTP/WS checks passed 4/4. Twelve browser UI cases
passed with zero JavaScript errors. Component Art approval: Style 8.5/10,
Readability 8/10, Technical Usability 9/10.

After integrating current main's approved monster models and attack timing
(PR74), the combined suite passes: 922 tests, 920 passed, zero failed and two
existing skips (44.23s). The merged production build also passes. UID authority,
incarnation checks and monster strike timing remain intact; UID UI is unchanged.

## UI evidence

[Desktop/mobile UID review](../art/uid/review/README.md) contains 12 component/fixture captures, copy feedback checks and explicit browser/device limitations.

