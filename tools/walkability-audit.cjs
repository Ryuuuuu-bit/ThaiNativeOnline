// Actual WebGL world audit. Requires an existing Playwright runtime and Vite.
const fs=require('node:fs'),path=require('node:path');
let chromium;
for(const modulePath of [process.env.PLAYWRIGHT_MODULE,'playwright','C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'].filter(Boolean)){
 try{({chromium}=require(modulePath));break;}catch{}
}
if(!chromium)throw Error('Set PLAYWRIGHT_MODULE to an existing runtime.');
const phase=process.argv[2]||'before',base=process.env.WALK_AUDIT_URL||'http://127.0.0.1:5204';
const output=path.resolve('artifacts/all-map-walking',phase);fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],maps=[];
 try{
  const page=await browser.newPage({viewport:{width:1200,height:850}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);const ids=await page.evaluate(async()=>Object.keys((await import('/src/world/maps.js')).MAPS));
  for(const id of ids){
   await page.goto(base);
   const result=await page.evaluate(async(id)=>{
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const {buildWorld,WADE}=await import('/src/world/World.js');
    const {MAPS,arrivalsOn,npcMap}=await import('/src/world/maps.js');
    const {ROADS,roadPoints,resample,WATER_Y,MARSH_WATER_Y,waterAt,J}=await import('/src/world/CityMap.js');
    const {NPCS}=await import('/src/data/npcs.js');
    const {huntingFor}=await import('/src/data/hunting.js');
    const {findPath,clearLine}=await import('/src/core/GridPath.js');
    const map=MAPS[id],scene=new THREE.Scene();scene.background=new THREE.Color('#263b32');
    const world=await buildWorld(scene,()=>{},id),stand=world.canStand.bind(world);
    const classify=(x,z)=>{
     if(!world.contains(x,z))return'map-boundary';
     if(world.collision.blocked(x,z))return'static-collision';
     if(world.collision.deckHeight(x,z)!==null)return'deck';
     if(world.terrain.isDeep(x,z))return'deep-water';
     if(!stand(x,z)&&world.terrain.height(x,z)<(z< -600?MARSH_WATER_Y:WATER_Y)-WADE)return waterAt(x,z)?'shallow-depth':'low-ground-height';
     return stand(x,z)?'standable':'other';
    };
    const roads=[];
    if(!map.expedition&&id!=='ruen_ho')for(const road of ROADS){
     const pts=resample(roadPoints(road),1).filter(([x,z])=>world.contains(x,z));if(!pts.length)continue;
     const samples=pts.map(([x,z])=>({x,z,standable:stand(x,z),cause:classify(x,z)}));
     roads.push({id:road.pts.join('→'),kind:road.kind,samples});
    }
    if(map.expedition){
     // Match paintExpeditionGround's actual rounded loop outlines, not the
     // hunting-pocket centres inside them. Canvas corner radius is 16 px.
     const radius=16*(map.view.maxX-map.view.minX)/768;
     const trails=[{id:'spine',points:[[0,map.top-4],[0,map.top-236]]},...[-40,-195].map(off=>({id:`connector-${off}`,points:[[-93,map.top+off],[93,map.top+off]]}))];
     for(const x of [-76,0,76]){const points=[],lo=map.top-183,hi=map.top-55;for(const [cx,cz,start]of [[x-17+radius,lo+radius,Math.PI],[x+17-radius,lo+radius,1.5*Math.PI],[x+17-radius,hi-radius,0],[x-17+radius,hi-radius,.5*Math.PI]])for(let i=0;i<=12;i++)points.push([cx+Math.cos(start+i*Math.PI/24)*radius,cz+Math.sin(start+i*Math.PI/24)*radius]);points.push(points[0]);trails.push({id:`loop-${x}`,points});}
     for(const trail of trails){const samples=resample(trail.points,1).map(([x,z])=>({x,z,standable:stand(x,z),cause:classify(x,z)}));roads.push({id:trail.id,kind:'painted-trail',samples});}
    }
    if(id==='ruen_ho'){const samples=[];for(let x=-14;x<=40;x+=.5)samples.push({x,z:-2900,standable:stand(x,-2900),cause:classify(x,-2900)});roads.push({id:'gallery-to-hall',kind:'indoor',samples});}
    const servicePoints=[];
    for(const npc of NPCS.filter(n=>npcMap(n)===id&&(n.shopType||n.trainer))){
     const anchors=new Set(Object.values(npc.schedule??{}).filter(a=>a.do==='stay').map(a=>a.at).filter(a=>typeof a==='string'));
     for(const anchor of anchors){const p=world.spots[anchor]??(J[anchor]?{x:J[anchor][0],z:J[anchor][1]}:null);if(p&&world.contains(p.x,p.z))servicePoints.push({id:`service-${npc.id}-${anchor}`,kind:'npc-service',...p});}
    }
    const pois=[{id:'spawn',kind:'spawn',...map.spawn},...arrivalsOn(id).map((a,i)=>({id:`arrival-${i}`,kind:'arrival',...a})),...map.portals.map(p=>({id:p.id,kind:'portal',...p.at})),...huntingFor(id).map(h=>({id:h.id,kind:'hunt',...h.approach})),...servicePoints,...Object.entries(world.spots).filter(([name])=>/supply|shop|master|herbal|healer|medicine|front|hall.*door|customer|keeper/.test(name)).map(([name,p])=>({id:name,kind:'service',...p}))];
    // Paths start at the canonical spawn. A blocked start is reported explicitly.
    for(const poi of pois){poi.standable=stand(poi.x,poi.z);poi.cause=classify(poi.x,poi.z);if(poi.id==='spawn')continue;
     const from={x:map.spawn.x,z:map.spawn.z};const route=stand(from.x,from.z)&&poi.standable?findPath(stand,from,poi,{margin:20,maxCells:250000}):null;
     poi.reachable=!!route;poi.pathSegments=route?.length??0;poi.pathClear=!!route&&route.every((p,i)=>clearLine(stand,i?route[i-1].x:from.x,i?route[i-1].z:from.z,p.x,p.z));
    }
    const uniqueShapes=[...new Set([...world.collision.shapes.values()].flat())];
    const walkingBands={samples:0,blocked:[]};
    if(map.expedition)for(const road of roads)for(let i=0;i<road.samples.length;i++){
     const p=road.samples[i],a=road.samples[Math.max(0,i-1)],b=road.samples[Math.min(road.samples.length-1,i+1)],length=Math.hypot(b.x-a.x,b.z-a.z)||1,nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
     for(let offset=-2.2;offset<=2.2001;offset+=.2){const x=p.x+nx*offset,z=p.z+nz*offset;if(!world.contains(x,z))continue;walkingBands.samples++;if(!stand(x,z))walkingBands.blocked.push({road:road.id,x,z,offset,cause:classify(x,z)});}
    }
    const crossings=[];
    for(const road of roads)for(let i=0;i<road.samples.length;i++){
     const p=road.samples[i];if(p.cause!=='static-collision')continue;
     const a=road.samples[Math.max(0,i-1)],b=road.samples[Math.min(road.samples.length-1,i+1)],length=Math.hypot(b.x-a.x,b.z-a.z)||1,nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
     const core=[];for(let offset=-1.1;offset<=1.1001;offset+=.1)core.push({offset,standable:stand(p.x+nx*offset,p.z+nz*offset)});
     const shoulders=[];for(let offset=-4.2;offset<=4.2001;offset+=.1)shoulders.push({offset,standable:stand(p.x+nx*offset,p.z+nz*offset)});
     crossings.push({road:road.id,x:p.x,z:p.z,corePassable:core.some(s=>s.standable),shoulderPassable:shoulders.some(s=>s.standable),coreFreeOffsets:core.filter(s=>s.standable).map(s=>Number(s.offset.toFixed(1))),nearShapes:uniqueShapes.filter(s=>s.x!==undefined&&Math.hypot(s.x-p.x,s.z-p.z)<4)});
    }
    const circle=uniqueShapes.find(s=>s.t===0&&world.contains(s.x,s.z)&&s.r>.4);
    const waterCases=[];if(!map.expedition)for(let z=map.walk[0].minZ;z<=map.walk[0].maxZ;z+=2)for(let x=-100;x<=100;x+=2){
     if(!world.contains(x,z)||world.collision.blocked(x,z))continue;const deck=world.collision.deckHeight(x,z),deep=world.terrain.isDeep(x,z);if(deep&&deck===null&&waterCases.length<3)waterCases.push({x,z,blocked:!stand(x,z),kind:'deep'});
    }
    const decks=[...new Set([...world.collision.decks.values()].flat())].map(d=>({x:d.x,z:d.z,standable:stand(d.x,d.z)}));
    const guards={static:circle?{x:circle.x,z:circle.z,blocked:!stand(circle.x,circle.z)}:null,waterCases,decks};
    let focus={x:map.spawn.x,z:map.spawn.z};const low=roads.flatMap(r=>r.samples).find(s=>s.cause==='low-ground-height');if(low)focus=low;
    if(id==='deep_forest')focus={x:3.5,z:-424};if(id==='wat_rang')focus={x:4,z:-490};if(id==='klong')focus={x:0,z:-730};
    const cam=new THREE.OrthographicCamera(-32,32,23,-23,.1,150);cam.position.set(focus.x,55,focus.z+32);cam.lookAt(focus.x,world.heightAt(focus.x,focus.z),focus.z);scene.add(new THREE.AmbientLight('#ffffff',2));const sun=new THREE.DirectionalLight('#fff7df',3);sun.position.set(focus.x+20,35,focus.z+35);scene.add(sun);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1200,850);document.body.replaceChildren(renderer.domElement);renderer.render(scene,cam);
    const counts={};for(const p of roads.flatMap(r=>r.samples))if(!p.standable)counts[p.cause]=(counts[p.cause]??0)+1;
    return{id,name:map.name,roads,pois,guards,crossings,walkingBands,shapes:uniqueShapes,counts,focus,stats:world.stats};
   },id);
   await page.screenshot({path:path.join(output,`${id}.png`)});maps.push(result);fs.writeFileSync(path.join(output,`${id}.json`),JSON.stringify(result,null,2));
   console.log(JSON.stringify({id,roadSamples:result.roads.reduce((n,r)=>n+r.samples.length,0),counts:result.counts,pois:result.pois.length,blockedPois:result.pois.filter(p=>!p.standable).map(p=>({id:p.id,cause:p.cause,x:p.x,z:p.z})),unreachable:result.pois.filter(p=>p.reachable===false).length}));
  }
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({phase,errors,maps},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
