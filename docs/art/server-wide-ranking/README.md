# Server-wide saved character rankings

## Summary
Production saves are envelopes containing a JSON character under `tno.character.v1`. Rankings previously passed the envelope directly to `Character`, silently skipped saved rows as unknown classes, and could display only the live population. The reader now uses the shared `characterRecord` decoder, supporting both envelope and legacy flat saves.

The default scan includes all eligible saved characters across accounts and slots. Live state replaces its saved account/slot row without duplication. All characters participate in CP, level and refinement calculations; public board payloads retain their existing top-100 limit. Equal scores use a stable account/slot tie-break. Failed database reads retain the last complete rankings rather than promote only online players.

## Changed files
- `server/ranking.js`: save decoding, unlimited population scan, stable ties and failed-read retention.
- `server/store.js`: uncapped default reads for MemoryStore and PgStore, optional explicit limits retained.
- `src/net/SocialPanes.js`: states that ranking includes online and offline characters.
- `tests/titles-ranking.test.js`: real save envelopes, multiple accounts/slots, live overlay, refinement values, 5,002-character scan, SQL contract, stable ties and failed-read recovery.
- `tools/ranking-board-qa.mjs`: actual server ranking output rendered by the production rankPane in headless Edge.

## Visual verification
`level-pc.png`: four offline saved characters from three accounts, including two slots for one account. Own character is rank 4, with the other three on the podium. Panel bounds checked at 1366x768; browser page errors: zero. Fixture is local test data, not production account records. Art review approved: style/readability/Thai identity/usability 8/10.

## Limits
Characters awaiting mandatory duplicate-name recovery remain excluded under the existing naming policy; malformed saves cannot be ranked. Unsaved guest characters do not have durable ranking identities. Database SQL is checked with a mocked PgStore query; the production PostgreSQL dataset has not been directly inspected. Rankings update every minute as before. Not deployed.

## Test results
Focused ranking/naming:15/15 passed. Full suite:929 tests,927 passed,2 skipped,0 failed. Production build:309 modules, passed; existing large-chunk warning. Headless Edge fixture passed with zero page errors and panel inside PC viewport.
