// Set PLAYWRIGHT_MODULE to an installed Playwright package when not on NODE_PATH.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),out=path.resolve(root,process.env.BOSS_QA_OUTPUT||'artifacts/meshy-boss-02');
const allowed=['sunken_city_3','dusk_fort_3','giant_valley_3','himmapan_3','fallen_city_3','demon_rift_3'];
const types=process.argv.slice(2).length?process.argv.slice(2):allowed;
if(types.some(t=>!allowed.includes(t)))throw Error('Unknown approved boss');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const timer=setTimeout(()=>browser.close(),180000),errors=[],rows=[],network=new Map(),pending=[];
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  await page.routeWebSocket(url=>url.pathname==='/'&&url.searchParams.has('token'),socket=>{const server=socket.connectToServer();server.onMessage(message=>{let data;try{data=JSON.parse(String(message));}catch{}if(!['update','full-reload'].includes(data?.type))socket.send(message);});});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{const url=new URL(response.url()),type=allowed.find(t=>url.pathname==='/models/monsters/'+t+'.glb');if(type)pending.push(response.body().then(bytes=>{network.set(type,digest(bytes));}).catch(e=>errors.push(e.message)));});
  await page.goto((process.env.BOSS_QA_URL||'http://127.0.0.1:5186')+'/tools/boss-review.html?type=chalawan');
  await page.waitForFunction(()=>window.bossReview?.models?.size===12,null,{timeout:60000});
  await page.evaluate(()=>bossReview.renderer.setAnimationLoop(null));await Promise.all(pending);
  for(const type of types){
   const file=path.join(root,'public/models/monsters',type+'.glb'),before=digest(await fs.readFile(file));
   const rigBytes=await fs.readFile(path.join(root,'tools/monster-models/meshy/rigs',type+'-rig-report.json'));
   const result=await page.evaluate(async({type,rig})=>(await import('/tools/monster-models/meshy/qa_boss.js')).auditBoss(type,rig),{type,rig:JSON.parse(rigBytes)});
   await Promise.all(pending);const after=digest(await fs.readFile(file));
   if(before!==after||result.asset.sha256!==before||network.get(type)!==before)throw Error('Source/native/audit asset identity differs: '+type);
   result.provenance={rigReportSha256:digest(rigBytes),localGlbSha256:before,nativeLoadedGlbSha256:network.get(type),capturedAt:new Date().toISOString()};
   rows.push(result);await fs.writeFile(path.join(out,type+'-runtime-qa.json'),JSON.stringify(result,null,2)+'\n');
   console.log(JSON.stringify({type,sha256:before,failures:result.failures}));
  }
  await fs.writeFile(path.join(out,'runtime-qa.json'),JSON.stringify({errors,rows},null,2)+'\n');
  if(errors.length||rows.some(r=>r.failures.length))throw Error('Native asset gate failed');
 }finally{clearTimeout(timer);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
