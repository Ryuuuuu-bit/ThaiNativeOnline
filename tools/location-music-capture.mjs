// Render listening samples from the exact production Web Audio score and voices.
// Existing Playwright runtime required; no samples are installed into public/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
for (const module of [process.env.PLAYWRIGHT_MODULE, 'playwright', 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean)) {
  try { ({ chromium } = require(module)); break; } catch {}
}
if (!chromium) throw Error('Set PLAYWRIGHT_MODULE to an existing runtime.');
const base = process.argv[2] ?? 'http://127.0.0.1:5201';
const output = path.resolve('artifacts/location-music'); fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/tools/location-music-review.html`); await page.waitForFunction(() => window.ready);
  await page.locator('#play').click();
  const playback = await page.evaluate(() => window.browserCheck());
  const loops = await page.evaluate(() => window.loopAudit());
  const tracks = await page.evaluate(() => window.tracks);
  const summaries = [];
  for (const id of tracks) {
    const rendered = await page.evaluate(id => window.renderMusic(id), id);
    const pcm = Buffer.from(rendered.pcm, 'base64'), header = Buffer.alloc(44);
    header.write('RIFF',0); header.writeUInt32LE(36+pcm.length,4); header.write('WAVEfmt ',8); header.writeUInt32LE(16,16);
    header.writeUInt16LE(1,20); header.writeUInt16LE(2,22); header.writeUInt32LE(rendered.rate,24);
    header.writeUInt32LE(rendered.rate*4,28); header.writeUInt16LE(4,32); header.writeUInt16LE(16,34);
    header.write('data',36); header.writeUInt32LE(pcm.length,40);
    const file = path.join(output,`${id}.wav`); fs.writeFileSync(file,Buffer.concat([header,pcm]));
    const {pcm: _pcm, ...summary} = rendered;
    summaries.push({...summary,file,peakDb:20*Math.log10(rendered.peak)});
    console.log(JSON.stringify({id,seconds:rendered.seconds,clipping:rendered.clipping,peak:rendered.peak}));
  }
  await page.screenshot({path:path.join(output,'review.png')});
  const report={errors,playback,loops,tracks:summaries,source:'Production CalmMusicPlayer rendered by OfflineAudioContext; previews fade at endpoints, live score repeats without restarting its audio graph.'};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  if(errors.length||playback.errors.length||!playback.muted||!playback.stopped||summaries.some(s=>s.clipping)||loops.some(s=>s.peak>=1||s.seamRms<.001||s.seamMaxStep>.3)) throw Error('Audio smoke/render validation failed.');
} finally { await browser.close(); }
