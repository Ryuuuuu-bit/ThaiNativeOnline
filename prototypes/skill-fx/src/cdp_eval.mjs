// usage: node cdp_eval.mjs script.js  — script gets window.IMG {name:dataURL}, must set window.OUT = {file: dataURL|string}
import { spawn } from 'child_process'; import fs from 'fs';
const R = 'E:/รับงานตัดนอก/ThaiNative/client/assets/td/';
const imgs = {}; for (const f of ['idle','walk','heal','cast','die']) imgs[f] = 'data:image/png;base64,' + fs.readFileSync(R + 'hero2_male_healer_t1/' + f + '.png').toString('base64'); if (process.env.FILES) process.env.FILES.split(',').forEach((f, i) => imgs['f' + i] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')); if (process.argv[3]) { imgs.a = 'data:image/png;base64,' + fs.readFileSync(process.argv[3]).toString('base64'); imgs.b = 'data:image/png;base64,' + fs.readFileSync(process.argv[4]).toString('base64'); }
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--remote-debugging-port=9335','--user-data-dir='+process.cwd()+'/edgeprof2','about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms)); let ws, id = 0; const pend = {};
try {
  await sleep(1500);
  const list = await (await fetch('http://127.0.0.1:9335/json')).json();
  ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const code = `window.IMG=${JSON.stringify(imgs)};(async()=>{${fs.readFileSync(process.argv[2],'utf8')}})().then(()=>JSON.stringify(window.OUT))`;
  const r = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails).slice(0, 800));
  const out = JSON.parse(r.result.result.value || '{}');
  for (const [k, v] of Object.entries(out)) { if (typeof v === 'string' && v.startsWith('data:')) fs.writeFileSync(k, Buffer.from(v.split(',')[1], 'base64')); else console.log(k, typeof v === 'string' ? v : JSON.stringify(v)); }
} catch (e) { console.log('ERR', e.message); } finally { ws?.close(); edge.kill(); }
