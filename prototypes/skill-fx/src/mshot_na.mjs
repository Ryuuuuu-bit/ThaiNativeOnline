import { spawn } from 'child_process';
const file = 'file:///' + process.cwd().split(String.fromCharCode(92)).join('/') + '/mage_fx.html?noauto';
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--remote-debugging-port=9334','--window-size=1280,720','--enable-unsafe-swiftshader','--use-angle=swiftshader','--allow-file-access-from-files','--user-data-dir='+process.cwd()+'/edgeprof','about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pend = {};
try {
  await sleep(1500);
  const list = await (await fetch('http://127.0.0.1:9334/json')).json();
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.consoleAPICalled') console.log('console', m.params.type, m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') console.log('EXC', JSON.stringify(m.params.exceptionDetails).slice(0, 600)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: file }); await sleep(6000);
  const shots = (process.argv[2] || '0:2500').split(',');
  for (const s of shots) {
    const [k, wait, post] = s.split(":");
    if (k !== 'x') await send('Runtime.evaluate', { expression: `document.querySelectorAll('.sk')[${k}].click()` });
    await sleep(+wait); if (process.argv[3]) { const r0 = await send("Runtime.evaluate", { expression: process.argv[3] }); console.log("eval", JSON.stringify(r0.result?.result?.value ?? r0.result).slice(0, 800)); }
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    (await import('fs')).writeFileSync(`mshot_${k}.jpg`, Buffer.from(r.result.data, 'base64'));
    if (post) await sleep(+post);
  }
} catch (e) { console.log('ERR', e.message); }
finally { ws?.close(); edge.kill(); }
