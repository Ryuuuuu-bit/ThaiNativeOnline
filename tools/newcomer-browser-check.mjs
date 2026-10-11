// Headless Edge driven over the DevTools protocol (Node 22+ global WebSocket; no
// dependency). Opens a probe page, collects every console message, waits until
// the page writes "QA_RESULT {...}" with a "done" step into #out, then saves
// <prefix>-result.json, <prefix>-console.json and one JPEG per entry of
// result.shots. See docs/technical/VERIFY.md.
//   node tests/browser/cdp.mjs <url> <prefix> [timeoutMs] [outDir]
// Uses a fresh --user-data-dir under outDir and kills only the Edge it started.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const [url, prefix = 'run', tmo = '420000', SP = process.env.QA_OUT ?? tmpdir()] = process.argv.slice(2);
const edge = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const prof = mkdtempSync(join(SP, 'prof-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(edge, ['--headless=new', '--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--window-size=1700,1000', '--no-first-run', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const console_ = [];
let done = false;
const finish = code => { if (done) return; done = true; try { proc.kill(); } catch {} setTimeout(() => { try { rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }, 1500); };
setTimeout(() => { console.log('HARD TIMEOUT'); writeFileSync(join(SP, `${prefix}-console.json`), JSON.stringify(console_, null, 1)); finish(2); }, +tmo);
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(500); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.consoleAPICalled') console_.push([m.params.type, m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 400)]);
  else if (m.method === 'Runtime.exceptionThrown') console_.push(['exception', (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400)]);
  else if (m.method === 'Log.entryAdded') console_.push(['log:' + m.params.entry.level, m.params.entry.text.slice(0, 400) + ' ' + (m.params.entry.url ?? '')]);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Emulation.setFocusEmulationEnabled', { enabled: true });
await send('Page.navigate', { url });
const t0 = Date.now();
while (true) {
  await sleep(3000);
  const r = await send('Runtime.evaluate', { expression: "document.getElementById('out')?.textContent ?? ''", returnByValue: true });
  const text = r.result?.result?.value ?? '';
  if (text.startsWith('QA_RESULT')) {
    const res = JSON.parse(text.slice(10));
    if (res.steps.some(s => s[0] === 'done')) {
      for (const [k, v] of Object.entries(res.shots ?? {})) writeFileSync(join(SP, `${prefix}-${k}.jpg`), Buffer.from(v.split(',')[1], 'base64'));
      for (const [name, shot] of Object.entries(res.uiShots ?? {})) {
        const capture = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x:0,y:0,width:shot.width,height:shot.height,scale:1 } });
        writeFileSync(join(SP, `${prefix}-${name}.png`), Buffer.from(capture.result.data, 'base64'));
      }
      delete res.uiShots;
      delete res.shots;
      writeFileSync(join(SP, `${prefix}-result.json`), JSON.stringify(res, null, 1));
      writeFileSync(join(SP, `${prefix}-console.json`), JSON.stringify(console_, null, 1));
      console.log('DONE in', Math.round((Date.now() - t0) / 1000), 's');
      finish(0); break;
    }
    if ((Date.now() - t0) % 30000 < 3000) console.log('progress', res.steps.length, res.steps.at(-1)?.[0]);
  }
}

