import * as THREE from 'three';
import { M } from '../materials.js';
import { structure, box, cyl, beam, mesh, prop, post, solid, spiritHouse, glow } from '../Architecture.js';
import { PADDY_LANDMARKS, PADDY_BOSS_CLEARING } from '../paddy-layout.js';

function harvestCart() {
  const g = structure({ w: 3.2, d: 4.4 });
  box(g,M.darkWood,0,.65,0,1.55,.15,2.1);
  for (const s of [-1,1]) {
    for (let n=0;n<3;n++) box(g,M.woodPale,s*.79,.85+n*.19,0,.07,.11,2.1);
    beam(g,M.darkWood,[s*.55,.6,-.8],[s*.55,.3,-2.4],.065);
    // Wooden wheels have a hub, spokes and a rim, readable from the game camera.
    const wheel=cyl(g,M.darkWood,s*.99,.58,.1,.56,.56,.12,16);wheel.rotation.z=Math.PI/2;
    const inset=cyl(g,M.woodLight,s*1.06,.58,.1,.44,.44,.13,16);inset.rotation.z=Math.PI/2;
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3;
      beam(g,M.darkWood,[s*1.14,.58,.1],[s*1.14,.58+Math.sin(a)*.48,.1+Math.cos(a)*.48],.03,5);
    }
    const hub=cyl(g,M.wood,s*1.15,.58,.1,.12,.12,.18,8);hub.rotation.z=Math.PI/2;
  }
  for (const [x,z,s] of [[-.35,-.45,.65],[.35,-.4,.7],[0,.5,.8]]) prop(g,'sack',x,.76,z,{s});
  prop(g,'hay',0,.85,.1,{s:.65});
  solid(g,0,0,2.5,2.5);
  return g;
}

function baskets() {
  const g=structure(null);
  for (const [x,z,s] of [[0,0,.9],[.7,.25,.65],[-.45,.55,.55]]) prop(g,'basket',x,0,z,{s});
  prop(g,'jar',-.65,0,-.15,{s:.55});
  return g;
}

function meadowShrine() {
  const g=structure({w:3.6,d:3.6});
  spiritHouse(0,0,g);prop(g,'flower',.5,.1,1,{color:'#e4ba57',s:1.2});
  prop(g,'jar',-.75,0,.8,{s:.6});
  glow(g,.6,1.2,.9,.55,'#e9bf77');
  return g;
}

function waterLift() {
  const g=structure({w:3.5,d:3.8});
  for(const side of [-1,1]) {
    for(const z of [-.9,.9])beam(g,M.darkWood,[side*.75,0,z],[side*.75,1.7,0],.075);
    beam(g,M.woodPale,[side*.75,1.7,0],[side*.75,2.1,.65],.05);
  }
  const rim=new THREE.TorusGeometry(1.15,.065,5,24);
  for(const x of [-.4,.4])mesh(g,rim,M.woodPale,x,1.5,0,1,1,1,Math.PI/2);
  const hub=cyl(g,M.darkWood,0,1.5,0,.13,.13,2.1,8);hub.rotation.z=Math.PI/2;
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5,y=1.5+Math.sin(a)*1.15,z=Math.cos(a)*1.15;
    for(const x of [-.4,.4])beam(g,M.wood,[x,1.5,0],[x,y,z],.04,5);
    box(g,M.woodLight,0,y,z,.9,.18,.25,0,a,0);
  }
  // Decorative traditional water-lift: no implied moving-water simulation.
  box(g,M.woodPale,.8,1.85,.8,1.6,.09,.32,0,0,-.1);
  solid(g,0,0,2.4,2.3);
  return g;
}

export function buildPaddyDetails(ctx) {
  for(const p of PADDY_LANDMARKS) {
    const g=p.id==='harvest-cart'?harvestCart():p.id==='meadow-shrine'?meadowShrine():p.id==='water-lift'?waterLift():baskets();
    ctx.place(g,p.x,p.z,p.rotation,{y:ctx.terrain.height(p.x,p.z)});
  }
  // A broken fence and cloth posts frame the rear of the encounter; the front
  // and sides stay open for retreat. Every solid is exported for the server.
  const {x,z}=PADDY_BOSS_CLEARING;
  for(const [dx,dz] of [[-11,-19],[-5,-20],[7,-20],[14,-18]]) {
    const g=structure(null);
    cyl(g,M.darkWood,0,.95,0,.075,.095,1.9,6);
    box(g,M.cloth.red,.24,1.45,0,.48,.65,.035,0,0,-.1);
    post(g,0,0,.12);
    if(dx!==7) beam(g,M.woodPale,[0,.8,0],[3.3,.55,.2],.045);
    ctx.place(g,x+dx,z+dz,0,{y:ctx.terrain.height(x+dx,z+dz)});
  }
  // Field-edge dressing uses a private sequence; it cannot move existing trees.
  ctx.veg.isolated(71931,veg=>{
    for(const [px,pz] of [[58,-276],[92,-275],[-8,-160],[-9,-217],[-112,-260]])
      veg.sugarPalm(px,ctx.terrain.height(px,pz),pz,{s:.85});
  });
}
