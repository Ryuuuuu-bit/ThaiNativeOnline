# Verifying changes

Every agent that changes code runs the checks below before reporting done. The
QA and Art Director agents also use the screenshot recipe.

## Always

```sh
npm test          # node --test tests/**/*.test.js
npm run build     # vite build (index)
```

Report the exact pass/fail counts. A failing test is reported, never hidden or skipped.

## Pages

| Page | Entry | What it is |
|---|---|---|
| `index.html` (`/`) | `src/main.js` → `src/account` → `src/core/Game.js` | the MMORPG: login, class choice, training ground, four maps |

Maps (`src/world/maps.js`), loaded one at a time:

| Map | Where | Safe | What to check |
|---|---|---|---|
| `city` นครอโยธยา | z ≥ -112 (inside the wall) | yes | no monsters, the same action bar as every map (kit classes: skills hit the dummy), six class halls (ย่านสำนักครู, x 87–108, z 62–115) with their masters by day, ลุงดำ at the forge, the warp in the North Gate passage (0, -107) |
| `paddy` ทุ่งนาข้าว | -296 ≤ z < -112 | no | Lv 1-3 monsters (orchards, grassland), the same action bar: kit skills fight the Tab / click target, ยายเพียร's shop in the farmers' village, the warp back at (0, -122.5), the path exit to the forest (-0.9, -290) |
| `deep_forest` ป่าลึก | -445 ≤ z < -296 | no | Lv 2-5 forest spirits, หมอแสง's shop inside the forest gate, path exits to the paddies (0, -301) and to the wat (8.5, -439) |
| `wat_rang` วัดร้าง | z < -445 | no | Lv 4-7, mostly at night, ตาฤๅษีพรหม's shop at the trail head, the path exit back to the forest (3, -450) |

The saved location (`tno.location.v1` in the save slot) decides the map on reload; `?at=x,z` picks the map from z (add `&map=id` to force one).

Useful URL flags:
- `/?at=x,z&t=10`: start position and hour (`?at=0,-140` starts on `paddy`, `?at=0,-320` on `deep_forest`, `?at=0,-470` on `wat_rang`)
- `?classes=all`: unlock every class
- `?login`: force the login screens
- `?lv=50&skill=5&ddef=40`: training damage test values

## Screenshots (Windows, headless Edge)

Start the dev server (`npm run dev -- --port 5181`, in the background), then:

```powershell
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$out  = "<scratchpad>\shot.png"
$p = Start-Process -FilePath $edge -PassThru -ArgumentList @('--headless=new','--disable-gpu',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--window-size=1600,900',
  '--virtual-time-budget=25000',"--user-data-dir=<scratchpad>\prof","--screenshot=$out",'http://127.0.0.1:5181/?ui=0')
$p.WaitForExit(90000) | Out-Null; if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -Confirm:$false }
```

- Always pass a fresh `--user-data-dir`, then delete it afterwards. Without one, Edge opens the user's real profile and extensions.
- Wrap the run in a timeout. Headless Edge can hang.
- WebGL runs on SwiftShader, so it is slow. Frame-time numbers from it mean nothing.
- Headless tabs are throttled, so scripted multi-step input (casting skills, clicking through screens) may never finish. In that case, test the logic with a unit test instead.

### Getting past the login on `index.html`

Put a temporary page in the repo root (delete it afterwards). It seeds a guest session and a character, then redirects in the same tab:

```html
<!doctype html><meta charset="utf-8"><script type="module">
import { Character } from '/src/character/Character.js';
Character.create('ทดสอบ', 'muaythai', 'male').save();        // guest slot 0 = unprefixed keys
sessionStorage.setItem('tno.session.v1', JSON.stringify({ id: 'guest', guest: true, prefix: '' }));
location.replace('/?at=4,150&t=10');
</script>
```

Without the session the login screen appears. Without the character, the character select and creation screens appear.

### Scripted checks over the DevTools protocol (works on the game page)

`--screenshot` and `--dump-dom` with `--virtual-time-budget` hang on the game
page (the animation loop never lets virtual time finish). Drive Edge over the
DevTools protocol instead; no dependency, Node 22+ only:

```sh
npm run dev -- --port 5186 --strictPort      # your own port, in the background
node tests/browser/cdp.mjs "http://127.0.0.1:5186/tests/browser/two-maps-probe.html" run 480000 "<scratchpad>"
```

- `tests/browser/cdp.mjs` starts headless Edge (SwiftShader, fresh
  `--user-data-dir` under the out dir, deleted afterwards), records every console
  message, polls the page until it writes `QA_RESULT {...}` with a `done` step
  into `#out`, then writes `<prefix>-result.json`, `<prefix>-console.json` and
  one JPEG per `shots` entry. It kills only the Edge it started (hard timeout).
- `tests/browser/two-maps-probe.html` is served by Vite from `tests/` (no temp
  page in the repo root). It seeds a guest character, loads the game in a
  same-origin iframe, hooks its console, then checks: masters at their hall
  spots, ลุงดำ and the shops (stock rows), the hall lane and `findPath` to every
  master, warp city → paddy → city through the trigger, monsters per map,
  skill bar per map, journal, full map, roofs after the warp, GPU memory over
  three round trips. Flags: `?q=<URL-encoded game query>`, `?loc=<saved
  location JSON>` (reload tests), `?quick=1` (start state only).
- `tests/browser/zones-probe.html` walks city → paddy → deep_forest → wat_rang
  and back through every portal trigger (findPath approach), and records per
  map: NPCs, suppliers' shop rows, monsters by zone, night spawns on the wat,
  console errors and a screenshot near each arrival. Same flags; `?quick=1&night=1`
  also switches to night. An old `fields` save: `?quick=1&q=t%3D11&loc=<JSON>`.
- Other agents edit files while you probe, and Vite then reloads the page
  mid-run. Start your dev server without HMR or file watching from a config in
  your scratchpad: `export default { root: '<repo>', server: { hmr: false,
  watch: { ignored: ['**/*'] } } }` with `npx vite --config <file> --host
  127.0.0.1 --port <port> --strictPort`.
- Screenshots come from `renderer.render()` followed by `canvas.toDataURL()` in
  the same task, so no `preserveDrawingBuffer` is needed.
- Copy the probe for other scenarios; keep `window.game` (set in
  `src/core/Game.js`) as the entry point.

## Bug report format (QA)

```
Severity: blocker | major | minor | cosmetic
Environment: page + URL flags, browser
Steps to Reproduce:
Expected:
Actual:
Evidence: test output, console error, screenshot path
Suspected Area: file:line, owning agent
```

## Party expedition verification

The current branch adds 8 expedition maps (13 total) and hunting through Lv.100.
See `docs/art/party-hunts-100/REVIEW.md` for captures and exact checks. Run the
full suite plus `tests/expeditions.test.js` when changing map registrations,
interest filtering, gear or level limits. Collision exports include all 13 maps;
regional hunting data is included in the source hash. Local WebSocket smoke tests
covered all eight new map rooms, monster lifecycle and nearby update packets.
This is not a measured production capacity or a physical-device FPS result.
