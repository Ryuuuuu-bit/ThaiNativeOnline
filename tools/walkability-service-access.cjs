// Classify intentional staff anchors using actual measured customer routes and
// the production NPC radius getter. No runtime or collision changes.
const fs=require('node:fs');
(async()=>{
 const {NPC}=await import('../src/entities/NPC.js');const {NPCS}=await import('../src/data/npcs.js');
 const all=JSON.parse(fs.readFileSync('artifacts/all-map-walking/after/report.json','utf8')),city=all.maps.find(m=>m.id==='city');
 const rows=[];
 for(const [npcId,anchorId,customerId]of [['blacksmith','service-blacksmith-forge_smith','forge_customer'],['herbalist','service-herbalist-herb_keeper','herb_customer'],['occultist','service-occultist-occult_keeper','occult_customer']]){
  const anchor=city.pois.find(p=>p.id===anchorId),customer=city.pois.find(p=>p.id===customerId),def=NPCS.find(n=>n.id===npcId),npc=Object.create(NPC.prototype);npc.def=def;
  const distance=Math.hypot(anchor.x-customer.x,anchor.z-customer.z),radius=npc.interactionRadius;
  const row={npc:npcId,staffAnchor:{x:anchor.x,z:anchor.z,standable:anchor.standable,reachable:anchor.reachable},customerApproach:{x:customer.x,z:customer.z,standable:customer.standable,reachable:customer.reachable,pathClear:customer.pathClear,pathSegments:customer.pathSegments},distance,interactionRadius:radius,withinInteractionRadius:distance<radius};rows.push(row);
  if(!row.withinInteractionRadius||!customer.standable||!customer.reachable||!customer.pathClear)throw Error(`Service inaccessible: ${npcId}`);
 }
 const pois=all.maps.flatMap(m=>m.pois),services=pois.filter(p=>p.kind==='service'||p.kind==='npc-service');
 const report={rawPois:pois.length,rawStandable:pois.filter(p=>p.standable).length,rawUnreachable:pois.filter(p=>p.reachable===false).length,serviceSamples:services.length,directlyReachableServices:services.filter(p=>p.reachable).length,staffAnchorsRequiringCustomerApproaches:services.filter(p=>p.reachable===false).map(p=>p.id),uniqueServicesVerifiedViaCustomer:rows.length,rows,scope:'These three staff anchors and their duplicate spot records are not player walking destinations. Actual customer approaches were measured in the 14-map World audit; radius uses the production NPC getter. This verifies distance/path access, not a live UI purchase or every NPC visibility/schedule state.'};
 fs.writeFileSync('artifacts/all-map-walking/service-access.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
