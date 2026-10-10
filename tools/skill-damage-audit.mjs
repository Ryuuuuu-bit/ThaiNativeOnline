// Repeatable browser audit of the production class factories, KitCaster,
// Character and Combat. Requires the dev server and an existing Playwright runtime.
// node tools/skill-damage-audit.mjs http://127.0.0.1:5199
// PLAYWRIGHT_MODULE may point to an installed playwright module; no dependencies installed.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const candidates=[process.env.PLAYWRIGHT_MODULE,'playwright','C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean);
let chromium;for(const candidate of candidates){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw Error('Set PLAYWRIGHT_MODULE to an existing Playwright runtime.');
const base=process.argv[2]??'http://127.0.0.1:5199';
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/tools/skill-damage-audit.html');await page.waitForFunction(()=>window.ready);
 const stable=await page.evaluate(()=>audit(false));
 const rebound=await page.evaluate(()=>audit(true));
 const cases=[...stable.map(row=>({...row,scenario:'stable'})),...rebound.map(row=>({...row,scenario:'moving-visual-target-rebound'}))];
 const failures=cases.filter(row=>row.error||!row.ok||row.hits!==row.expectedHits||(row.expectedHits>0&&row.hpDelta<=0)||(!row.expectedHits&&row.hpDelta!==0)||row.otherDelta>0);
 const report={description:'Real production FX factories + KitCaster + Character + Combat, 50 active skills × base/A/B × normal/tall size × close/max rules range × stable/moving target and visual proxy rebound.',random:'Math.random fixed at 0.5 to exclude legitimate evasion/critical randomness.',simulation:'480 frames at 60 Hz (8 seconds) per case; monster AI frozen to isolate hit coordinator.',support:'An empty canonical skillHitSchedule must leave monster HP unchanged. Heal-vine and pill retain their hybrid damage cadence.',summary:{cases:cases.length,passed:cases.length-failures.length,failed:failures.length,browserErrors:errors},failures,cases};
 const output=path.resolve('docs/art/skill-paths/review/damage-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary));if(failures.length||errors.length){console.error(JSON.stringify(failures));process.exitCode=1;}
}finally{await browser.close()}
