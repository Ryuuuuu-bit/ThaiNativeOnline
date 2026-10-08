# UAT release regression investigation — 2026-10-08

## Verified cause

At 20:52:26 Bangkok time (13:52:26 UTC), Railway UAT successfully deployed
`origin/main` commit `14f77f760b7171c3628a69777f0815b7d77de5f5`, deployment
`017d97e2-8121-4031-b7dc-3ce686c8b1cd`. Its live JS bundle is
`/assets/main-D5qyaxeO.js`.

The preceding verified release was deployment
`2585ea0e-a4d4-4037-bd6e-9c778e95de97`, application source `1eba4f2`,
created at 20:16:47 Bangkok time. Railway now labels that deployment REMOVED.
That release uploaded a separate branch containing changes not yet merged into
main. A subsequent deployment from main therefore omitted those changes.
This establishes a source-version regression; the commit author alone does not
identify who manually triggered a deployment.

Live SHA-256 comparisons for warrior, shaman, hunter and herbalist GLBs all match
origin/main and differ from the preceding 1eba4f2 release. This is reproducible
asset evidence, rather than a browser-cache assumption.

## Work retained in Git

Unmerged release changes remain available: hunting pockets/portals, party routes
through level 100, expedition scenery, boss encounter skills, bulk vendor fixes,
and class model work. The latest main commit adds the herbalist's poison/slow
ring rules; that work must also be retained when recovering the prior release.

The recovery branch `codex/restore-uat-features` includes both histories. It also
honors the user's cancellation of the new warrior: the original warrior and its
portrait are restored from 6ac984c. No cancelled production Meshy experiment is
included. Historical, inactive review candidates already in the preceding release
remain unchanged.

## Validation and release boundary

- Combined branch: 346/346 tests pass; npm run build passes.
- Existing approximately 1.74MB JS bundle warning remains.
- Original warrior: 15 clips, desktop/mobile guest casting, no page errors;
  screenshots and changed files in ../art/reviews/WARRIOR_RESTORED.md.
- Live health reports accounts enabled and Postgres storage. This does not prove
  that every account row is intact; no account-table query was performed.
- No database restore, migration, variable change, rollback, service restart or
  new deployment was performed during this investigation.

Merge the combined PR into the canonical main branch before deploying main again.
Deploying another branch while main lacks its changes recreates the regression.
Record the deployed commit and deployment ID, then compare live bundle and asset
hashes after every release. If account progress is also missing, investigate the
connected database/environment separately before attempting any database restore.
