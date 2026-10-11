# Runtime deployment package

The root Dockerfile builds the game using Node 24 on Debian Bookworm slim, installs
production dependencies separately, then assembles a clean runtime stage. Railway
[detects a root Dockerfile](https://docs.railway.com/builds/dockerfiles) and uses its
[CMD as the default start command](https://docs.railway.com/deployments/start-command).
The repository has no Railway configuration file. An existing service dashboard
start-command override must be checked when deploying: it should be empty or
`node server/index.js`, and must not run a build in the runtime stage.

## Files admitted

The Docker build context allows only `Dockerfile`, `.dockerignore`, `package.json`,
`package-lock.json`, `index.html`, `vite.config.js`, `src/`, `public/`, and `server/`.
Environment files, private keys and nested node_modules remain excluded. Local
artifacts, authoring tools, docs, tests, prototypes and Git history never enter
the context. Public assets and font license notices are copied into dist by Vite.

The final runtime contains only:

- `dist/`: built browser bundles and the cleaned public assets.
- `server/`: server modules and `server/data/collision.json`.
- `src/`: shared formulas, content, character/progress, quest, terrain/navigation
  and class timing modules imported by the server. Keeping this small source tree
  avoids a fragile hand-maintained transitive module list.
- `package.json`, `package-lock.json`, and production `node_modules/`.

`pg`, `ws`, and `three` are runtime dependencies. TerrainData imports three even
though the server does not render. Vite and its build dependencies are omitted.
The server's SQL schema and migrations are embedded in server JavaScript; no SQL
file, tool or documentation path is loaded at startup. The server reads dist and
the baked collision JSON. It does not write to the application directory.

## Process and persistence

The runtime runs as the image's unprivileged `node` user. Files are readable and
do not need runtime ownership changes. It listens on the supplied `PORT` (8787
fallback), logs to stdout/stderr and handles SIGTERM through the existing shutdown
save/drain path. No writable application directory or attached filesystem volume
is required. Accounts, saves and migrations use `DATABASE_URL` PostgreSQL; without
that variable they use volatile memory. Inject credentials at runtime through the
service environment. This build does not require build-time secret arguments.

## Portable verification

After `npm run build`, run `node tools/qa/runtime-package-smoke.mjs`.
The script creates an isolated temporary runtime containing precisely the app
paths copied by the final Docker stage, installs with `npm ci --omit=dev`, checks
that Vite and development files are absent, loads every collision map, starts the
server without inherited database/admin credentials, checks health endpoints,
HEADs every dist file, byte-compares one file per extension and receives a guest
welcome over `/ws`. It deletes its temporary fixture and stops its own process.

This verifies the artifact contents and startup on the host OS. It does not
verify Docker layers, Linux process permissions, a PostgreSQL migration, a live
Railway service or any dashboard start-command override. Docker CLI is unavailable
in the current environment; a container build and live deployment remain pending.
There is no visual change from packaging itself and no packaging screenshot.

## Verification on 2026-10-11

The artifact-only fixture passed on host Node v24.16.0: production npm ci added
16 packages, all 14 registered collision maps loaded, all 664 dist files returned
HTTP 200 with matching Content-Length, and byte comparisons passed for ten file
extensions (`.js`, `.css`, `.woff2`, `.txt`, `.png`, `.html`, `.glb`, `.json`,
`.webp`, `.svg`). Both health endpoints and a guest WebSocket welcome passed;
a missing GLB returned 404. The fixture exited 0 and removed its temporary files.

The migration worker's checks on the frozen shared source passed: npm test
reported 1,028 total, 1,026 passed, zero failed and two skipped; Vite build
completed successfully (511 ms). The final dist contains 85,447,266 bytes in
664 files. Docker image build, Linux permissions and live Railway/Postgres remain
unverified as described above.
