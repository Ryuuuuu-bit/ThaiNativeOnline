# Painted V2 production exports

The 15 approved V2 PNG masters are preserved unchanged. The production directory
`public/ui/items/painted-v2/` contains 256×256 transparent WebP exports, used only
by the exact 15 IDs in `src/character/data/painted-item-icons.js`. Other items keep
their existing art. Gameplay definitions, drop rates and saved instances do not change.

Run from the repository root with an existing Sharp installation; no game runtime
dependency is required:

```powershell
node tools/export-item-icons.mjs --sharp-module C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp
```

Alternatively install Sharp in a separate tooling environment and pass its package
directory or entry file. With Sharp resolvable by Node, omit the argument. The script
uses Lanczos3 contain scaling with transparent padding, WebP quality 90 and alpha
quality 100. It writes `production-manifest.json` with source/output SHA-256 hashes,
dimensions, alpha checks, encoder version and transfer sizes. Rebuilding with the
recorded Sharp version should preserve output hashes.

`imageArt: 'painted'` opts these definitions into smooth contain rendering; existing
pixel icons keep their prior treatment. Rarity frames, sockets, locks, upgrade labels
and flask charges remain live UI elements outside the art. Exported artwork has no
baked UI frame or text. This is the approved sample set, not all equipment in the game.
