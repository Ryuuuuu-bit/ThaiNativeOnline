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
| `index.html` (`/`) | `src/main.js` → `src/account` → `src/core/Game.js` | the MMORPG, one map นครอโยธยา: login, class choice (มวยไทย / หมอยา), training ground |

Useful URL flags:
- `/?at=x,z&t=10`: start position and hour
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
