const fs=require('node:fs');
(async()=>{
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),dir='artifacts/all-map-walking/';
 const before=read(dir+'before/report.json'),after=read(dir+'after/report.json'),layoutBefore=read(dir+'width/report.json'),baked=read(dir+'before/baked-collision.json');
 const {MAPS}=await import('../src/world/maps.js');const {expeditionTrails,nearExpeditionTrail}=await import('../src/world/expedition-trails.js');
 const key=s=>JSON.stringify(Object.fromEntries(Object.entries(s).sort(([a],[b])=>a.localeCompare(b))));
 const deltas=[];
 for(const map of after.maps){
  const original=before.maps.find(m=>m.id===map.id),layout=layoutBefore.maps.find(m=>m.id===map.id),oldShapes=baked.maps[map.id].shapes;
  const oldSet=new Set(oldShapes.map(key)),newSet=new Set(map.shapes.map(key));
  const added=map.shapes.filter(s=>!oldSet.has(key(s))),removed=oldShapes.filter(s=>!newSet.has(key(s))),trails=MAPS[map.id].expedition?expeditionTrails(MAPS[map.id]):[];
  const relocated=s=>s.t===0&&s.r===.6&&[.5,-.5].some(dx=>oldShapes.some(o=>o.t===0&&o.r===s.r&&Math.abs(o.x-(s.x+dx))<1e-8&&Math.abs(o.z-(s.z-4))<1e-8));
  const expectedRemoval=s=>nearExpeditionTrail(s.x,s.z,trails)||s.t===0&&s.r===.6&&added.some(a=>Math.abs(a.z-(s.z+4))<1e-8&&Math.abs(Math.abs(a.x-s.x)-.5)<1e-8);
  const unexpectedAdded=added.filter(s=>!MAPS[map.id].expedition||!relocated(s)),unexpectedRemoved=removed.filter(s=>!MAPS[map.id].expedition||!expectedRemoval(s));
  deltas.push({id:map.id,beforeLowGround:original.counts['low-ground-height']??0,afterLowGround:map.counts['low-ground-height']??0,actualPaintedBeforeStatic:layout.counts['static-collision']??0,afterStatic:map.counts['static-collision']??0,bandSamples:map.walkingBands.samples,bandBlocked:map.walkingBands.blocked.length,retainedShapes:map.shapes.length-added.length,removedShapes:removed.length,relocatedPillars:added.length,unexpectedAdded,unexpectedRemoved});
 }
 const geometryUnchanged=JSON.stringify(read(dir+'before/water-geometry.json'))===JSON.stringify(read(dir+'after/water-geometry.json'));
 const report={maps:deltas,geometryUnchanged,errors:after.errors,limits:'Authored roads at 1m, expedition painted loop bands at 0.2m cross offsets ±2.2m, actual World canStand. Not exhaustive continuous collision or all keyboard/network movement. Indoor bridal bed and shopkeeper anchors are intentional solid scenery.'};
 fs.writeFileSync(dir+'comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 if(!geometryUnchanged||after.errors.length||deltas.some(m=>m.afterLowGround||m.bandBlocked||m.unexpectedAdded.length||m.unexpectedRemoved.length))throw Error('Walkability/geometry/seeded-placement regression.');
})().catch(e=>{console.error(e);process.exitCode=1;});
