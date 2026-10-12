import { NPC } from '../../src/entities/NPC.js';
import { NPCManager } from '../../src/npc/NPCManager.js';
import { makeLook } from '../../src/npc/NPCData.js';
import { NavGraph } from '../../src/npc/NavGraph.js';
import { activityFor } from '../../src/npc/NPCSchedule.js';
import { COMPACT_CITY, compactCityCanStand } from '../../src/world/compact-city.js';
import { COMPACT_CITY_SPOTS } from '../../src/data/compactCityNpcs.js';
import { Collision } from '../../src/world/Collision.js';
import { portalPillars } from '../../src/world/portal-layout.js';
import { MAPS } from '../../src/world/maps.js';

export function cityPopulation(defs, phase = 'day', activity = activityFor, graph = world => NavGraph.fromCompactCity(world)) {
  const collision = new Collision(8);
  for (const b of COMPACT_CITY.buildings) collision.addBox(b.x,b.z,b.w,b.d);
  for (const p of MAPS.city.portals) for (const s of portalPillars(MAPS.city,p)) collision.addCircle(s.x,s.z,s.r);
  const world = { map: MAPS.city, spots: COMPACT_CITY_SPOTS, heightAt: () => 0,
    canStand: (x,z,pad=.35) => compactCityCanStand(x,z,pad) && !collision.blocked(x,z,pad) };
  const manager = Object.assign(Object.create(NPCManager.prototype), { world, nav: graph(world), homes: [] });
  for (const [id,s] of Object.entries(world.spots)) Object.assign(manager.nav.add(id,s.x,s.z), { spot: true, face: s.face });
  for (const [id,s] of Object.entries(world.spots)) manager.link(id,s.link);
  const npcs = defs.filter(n => n.map === 'city').map(def => {
    const npc = new NPC(def,makeLook(def),manager); manager.prepare(npc);
    npc.setActivity(activity(npc.def,phase),true); return npc;
  });
  return { world, manager, npcs };
}

export function simulatePopulation(population, seconds = 120) {
  const { npcs, world } = population, moved = new Set(), plaza = new Set(), temple = new Set(), port = new Set();
  const plazaMovers = new Set(), templeMovers = new Set(), portMovers = new Set();
  const last = new Map(npcs.map(n => [n.id,{ x:n.x,z:n.z }]));
  let walkingSamples = 0, hiddenSamples = 0, unsafeSamples = 0;
  for (let i=0;i<seconds*10;i++) for (const n of npcs) {
    n.update(.1,i*.1,world);
    const p=last.get(n.id);
    if(Math.hypot(n.x-p.x,n.z-p.z)>.05)moved.add(n.id);
    if(n.path)walkingSamples++;
    if(n.indoors)hiddenSamples++;
    else {
      if(Math.abs(n.x)<18 && n.z>-26 && n.z<28) { plaza.add(n.id); if(n.path)plazaMovers.add(n.id); }
      if(n.x<-35 && n.z<-5) { temple.add(n.id); if(n.path)templeMovers.add(n.id); }
      if(n.z>48) { port.add(n.id); if(n.path)portMovers.add(n.id); }
      if(!world.canStand(n.x,n.z))unsafeSamples++;
    }
  }
  return { residents:npcs.length, movers:moved.size, plazaVisitors:plaza.size, templeVisitors:temple.size, portVisitors:port.size,
    plazaMovers:plazaMovers.size, templeMovers:templeMovers.size, portMovers:portMovers.size,
    meanWalking:walkingSamples/(seconds*10), hiddenSamples, unsafeSamples };
}

// Spawn-view evidence is geometric proximity, not a browser occlusion/render test.
export function openingPopulation(population) {
  const { npcs,world }=population;
  const initial=new Map(npcs.map(n=>[n.id,{ x:n.x,z:n.z }]));
  const travel=new Map(npcs.map(n=>[n.id,0]));
  const frame = seconds => {
    const outdoor=npcs.filter(n=>!n.indoors),local=outdoor.filter(n=>Math.hypot(n.x,n.z-8)<=35);
    const awning = side => local.filter(n=>side*n.x>=8 && side*n.x<=18 && n.z>=9 && n.z<=15)
      .map(n=>({id:n.id,x:+n.x.toFixed(2),z:+n.z.toFixed(2),state:n.state,anim:n.anim}));
    return { seconds,local:local.length,west:awning(-1),east:awning(1),
      restingGroup:local.filter(n=>Math.hypot(n.x+8,n.z+4)<=3).map(n=>n.id),
      movers:local.filter(n=>travel.get(n.id)>.5).map(n=>({id:n.id,from:initial.get(n.id),
        to:{x:+n.x.toFixed(2),z:+n.z.toFixed(2)},travel:+travel.get(n.id).toFixed(2)})) };
  };
  const frames=[frame(0)];
  for(let i=1;i<=150;i++) {
    for(const n of npcs) {const x=n.x,z=n.z;n.update(.1,i*.1,world);travel.set(n.id,travel.get(n.id)+Math.hypot(n.x-x,n.z-z));}
    if(i===100 || i===150)frames.push(frame(i/10));
  }
  return frames;
}
