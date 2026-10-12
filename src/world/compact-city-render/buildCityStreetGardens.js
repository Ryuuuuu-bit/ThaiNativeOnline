import * as THREE from 'three';
import { createRng, hashString } from '../rng.js';
import { applyCityFoliageWind } from './cityFoliageWind.js';

// Source meshes are subsequently assembled by the city's existing batcher.
// Only high leaves may overhang: jars, benches, fruit, stalks and vegetables
// are measured together and fitted to the canonical garden before rotation.
export function buildCityStreetGardens({root,CITY,mat,geo,box,cyl,beam,ball,M}) {
  const stats={bananaClumps:0,bananaStalks:0,bananaLeaves:0,bananaBunches:0,
    bananaShoots:0,gardenGroundcovers:0,gardenSeatPads:0,gardenBenches:0,gardenJars:0,vegetableBeds:0,streetGardenMeshes:0};
  const plots=CITY.buildings.filter(b=>b.kind==='garden'&&['banana','riverside'].includes(b.variant)&&Math.min(b.w,b.d)>=2);
  if(!plots.length)return stats;
  const greens=['#4e854a','#739c50','#91aa60'].map(color=>applyCityFoliageWind(mat(color,{side:THREE.DoubleSide,roughness:.91},true)));
  const stalk=mat('#9cab67',{roughness:.94}),sheath=mat('#78874f',{roughness:.97});
  const ceramic=[mat('#aa6849',{roughness:.73}),mat('#cc9165',{roughness:.78})];
  const fruit=mat('#b7be57',{roughness:.84}),bud=mat('#864754',{roughness:.82});
  const earth=mat('#63533b',{roughness:1});
  const turf=mat('#78915c',{roughness:1}),groundLeaf=mat('#5f834b',{roughness:.96,side:THREE.DoubleSide});
  const paving=mat('#c7baa0',{roughness:.92});
  // Broad blade with a lifted central fold and softly split lateral edges.
  // Unlike a palm feather, its wide uninterrupted lamina reads as banana.
  const blade=geo(new THREE.BufferGeometry()),vertices=[],indices=[];
  for(let i=0;i<=10;i++) {
    const t=i/10,spread=Math.pow(Math.sin(Math.PI*t),.42)*.29*(i===6?.91:1);
    const arch=Math.sin(Math.PI*t)*.22-t*t*.44;
    vertices.push(t,arch,-spread,t,arch+.065*Math.sin(Math.PI*t),0,t,arch,spread);
    if(i<10)for(let side=0;side<2;side++) {
      const a=i*3+side;indices.push(a,a+3,a+1,a+1,a+3,a+4);
    }
  }
  blade.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));blade.setIndex(indices);blade.computeVertexNormals();
  const jarGeometry=geo(new THREE.LatheGeometry([[0,0],[.24,0],[.34,.12],[.43,.44],[.40,.68],[.24,.82],[.23,.98],[.29,1.01],[.29,1.08],[.21,1.08],[.21,.94]].map(v=>new THREE.Vector2(...v)),16));
  const bananaGeometry=geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(.045,-.12,.08),new THREE.Vector3(.10,-.23,.13),new THREE.Vector3(.17,-.28,.12),
  ]),6,.045,5,false));
  function mesh(p,geometry,material,x,y,z,sx=1,sy=sx,sz=sx) {
    const o=new THREE.Mesh(geometry,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);
    o.castShadow=o.receiveShadow=true;p.add(o);return o;
  }
  function jar(p,x,z,s,index) {
    const g=new THREE.Group();g.name='garden-water-jar';g.position.set(x,.21,z);p.add(g);
    mesh(g,jarGeometry,ceramic[index%2],0,0,0,s);
    cyl(g,M.dark,0,1.025*s,0,.20*s,.025*s);
    // A wide warm rim and dark visible mouth convey water storage at game zoom.
    stats.gardenJars++;
  }
  function bananaClump(p,x,z,scale,local,withFruit) {
    const g=new THREE.Group();g.name='banana-clump';g.position.set(x,.20,z);p.add(g);
    for(let stem=0;stem<3;stem++) {
      const a=stem*2.40,cx=Math.cos(a)*.37*scale,cz=Math.sin(a)*.37*scale;
      const height=[3.96,2.12,3.30][stem]+local.range(-.035,.035);
      cyl(g,stalk,cx,height/2,cz,.13*scale,height).name='banana-pseudostem';
      for(const side of[-1,1])beam(g,sheath,[cx+side*.09*scale,.20,cz],[cx+side*.07*scale,height*.84,cz+.025],.045*scale);
      const phase=local.range(0,Math.PI*2);
      for(let i=0;i<5;i++) {
        const length=[2.45,1.12,1.75][stem]*scale*(i%2?.85:1);
        const leaf=mesh(g,blade,greens[(stem+i)%3],cx,height,cz,length,length,length);
        leaf.rotation.y=phase+i*Math.PI*2/5;
        leaf.name='banana-folded-leaf';
        // The middle-age tier belongs entirely to the bed; only leaves above
        // walk clearance may extend beyond its reservation.
        if(stem!==1)leaf.userData.cityLandscapeCanopy=true;
        stats.bananaLeaves++;
      }
      // Upright rolled new leaf is an important banana silhouette cue.
      const cigar=cyl(g,greens[2],cx,height+.29,cz,.065*scale,.66);
      if(stem!==1)cigar.userData.cityLandscapeCanopy=true;
      stats.bananaStalks++;
      if(withFruit&&stem===0) {
        const bunch=new THREE.Group();bunch.name='hanging-banana-bunch';bunch.position.set(cx+.24*scale,2.55,cz);g.add(bunch);
        beam(bunch,sheath,[-.24*scale,.73,0],[0,.10,0],.035*scale);
        for(let row=0;row<3;row++)for(let i=0;i<4;i++) {
          const angle=i*Math.PI/2+row*.40;
          const f=mesh(bunch,bananaGeometry,fruit,Math.cos(angle)*.075*scale,-row*.19,Math.sin(angle)*.075*scale,scale);
          f.rotation.y=-angle;
        }
        ball(bunch,bud,0,-.72,0,.10*scale,.21,.10*scale);
        stats.bananaBunches++;
      }
    }
    // A low daughter shoot and folded sheaths make this a growing domestic
    // clump rather than three bare poles carrying one uniform fan-top.
    const shoot=new THREE.Group();shoot.name='banana-young-shoot';shoot.position.set(.55*scale,0,.40*scale);g.add(shoot);
    cyl(shoot,stalk,0,.54,0,.09*scale,1.08);
    for(let i=0;i<4;i++) {
      const leaf=mesh(shoot,blade,greens[i%3],0,1.05,0,.72*scale,.80,.70*scale);
      leaf.rotation.y=i*2.15+.3;
    }
    cyl(shoot,greens[2],0,1.20,0,.045,.43);
    for(const side of[-1,1]) {
      const sheathLeaf=mesh(g,blade,groundLeaf,side*.12*scale,1.16,0,.48*scale,.82,.50*scale);
      sheathLeaf.rotation.y=side*1.35;
    }
    stats.bananaShoots++;
    stats.bananaClumps++;
  }
  function groundcover(p,x,z,rx,rz,local) {
    const g=new THREE.Group();g.name='garden-groundcover';g.position.set(x,.12,z);p.add(g);
    ball(g,turf,0,0,0,rx,.075,rz);
    // A few broad leaf rosettes, clustered rather than scattered speckle.
    for(let cluster=0;cluster<3;cluster++) {
      const a=cluster*2.3,cx=Math.cos(a)*rx*.42,cz=Math.sin(a)*rz*.42;
      for(let i=0;i<3;i++) {
        const leaf=mesh(g,blade,groundLeaf,cx,.09,cz,.30,.27,.35);
        leaf.rotation.y=i*2.1+local.range(-.15,.15);
      }
    }
    stats.gardenGroundcovers++;
  }
  function seatPad(p,x,z,w,d) {
    const g=new THREE.Group();g.name='garden-seat-pad';g.position.set(x,.14,z);p.add(g);
    box(g,M.rim,0,0,0,w,.08,d);
    for(let ix=0;ix<3;ix++)for(let iz=0;iz<2;iz++)box(g,paving,(ix-1)*w/3,.052,(iz-.5)*d/2,w/3-.035,.05,d/2-.035);
    stats.gardenSeatPads++;
  }
  function vegetables(p,x,z,w,d) {
    const g=new THREE.Group();g.name='garden-vegetables';g.position.set(x,.21,z);p.add(g);
    box(g,earth,0,.07,0,w,.14,d);
    for(const side of[-1,1])box(g,M.timber,0,.12,side*d/2,w+.08,.14,.08);
    for(const side of[-1,1])box(g,M.timber,side*w/2,.12,0,.08,.14,d+.08);
    for(let row=0;row<2;row++)for(let i=0;i<3;i++) {
      const cx=(i-1)*w*.27,cz=(row-.5)*d*.46;
      for(let j=0;j<3;j++) {
        const leaf=mesh(g,blade,greens[(row+j)%3],cx,.17,cz,.23,.38,.36);
        leaf.rotation.y=j*Math.PI*2/3;
      }
      ball(g,greens[1],cx,.23,cz,.10,.12,.10);
    }
    stats.vegetableBeds++;
  }
  function bench(p,x,z,w,north=false) {
    const g=new THREE.Group();g.name='garden-resting-bench';g.position.set(x,.21,z);p.add(g);
    if(north)g.rotation.y=Math.PI;
    for(const side of[-1,1])box(g,M.wood,side*w*.36,.23,0,.13,.46,.46);
    for(let i=0;i<3;i++)box(g,M.timber,0,.48,(i-1)*.17,w,.10,.14);
    for(const side of[-1,1])box(g,M.wood,side*w*.40,.70,-.24,.09,.60,.09);
    box(g,M.timber,0,.88,-.24,w,.22,.09);
    stats.gardenBenches++;
  }
  for(const b of plots) {
    const local=createRng(hashString(`street-garden:${b.id}`)),g=new THREE.Group();g.name=`street-garden:${b.id}`;root.add(g);
    const sideways=['east','west'].includes(b.front),w=sideways?b.d:b.w,d=sideways?b.w:b.d;
    const size=Math.min(1,Math.min(w,d)/3.5);
    if(b.variant==='banana') {
      groundcover(g,-w*.17,-d*.17,Math.min(1.05,w*.30),Math.min(1.15,d*.30),local);
      groundcover(g,w*.24,-d*.19,Math.min(.65,w*.20),Math.min(.84,d*.22),local);
      bananaClump(g,-w*.19,-d*.18,size,local,true);
      if(Math.max(w,d)>5)bananaClump(g,w*.22,-d*.24,size*.78,local,false);
      jar(g,w*.25,d*.25,Math.min(.92,size),0);
      vegetables(g,-w*.20,d*.27,Math.min(1.35,w*.34),Math.min(.80,d*.23));
    }else {
      // Shade tree is supplied by landscape; this open foreground is a small
      // inhabited resting place, not another uniformly packed shrub rectangle.
      const benchZ=-d/2+.50;
      seatPad(g,0,benchZ+.10,Math.min(3.3,w*.69),.98);
      bench(g,0,benchZ,Math.min(1.85,w*.50),true);
      jar(g,-w*.29,d*.24,Math.min(.95,size),1);
      jar(g,-w*.22,d*.08,Math.min(.63,size*.72),0);
      vegetables(g,w*.26,d*.29,Math.min(1.45,w*.31),Math.min(.85,d*.23));
      ball(g,earth,-w*.20,.10,d*.15,Math.min(.84,w*.18),.04,Math.min(.52,d*.16));
      groundcover(g,-w*.20,d*.15,Math.min(1.15,w*.25),Math.min(.64,d*.19),local);
      groundcover(g,w*.34,d*.10,Math.min(.55,w*.12),Math.min(.43,d*.13),local);
      if(Math.min(w,d)>3.5)bananaClump(g,-w*.26,-d*.29,size*.62,local,false);
    }
    g.updateMatrixWorld(true);
    const hard=new THREE.Box3();
    g.traverse(o=>{if(o.isMesh&&!o.userData.cityLandscapeCanopy){o.geometry.computeBoundingBox();hard.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
    const ex=Math.max(Math.abs(hard.min.x),Math.abs(hard.max.x)),ez=Math.max(Math.abs(hard.min.z),Math.abs(hard.max.z));
    g.scale.set(Math.min(1,(w/2-.18)/ex),1,Math.min(1,(d/2-.18)/ez));
    g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;g.position.set(b.x,0,b.z);
    g.traverse(o=>{if(o.isMesh)stats.streetGardenMeshes++;});
  }
  return stats;
}
