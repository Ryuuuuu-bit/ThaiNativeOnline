import * as THREE from 'three';
import { patchMaterial } from '../shaders.js';
import { applyCityFoliageWind } from './cityFoliageWind.js';
import { createCityWaterMaterial } from './buildCityWater.js';

// Street-facing fabric is suspended from canonical shop reservations. Nothing
// below head height is added to the road; the fountain belongs to garden_civic.
export function buildCityMarket({
  root,mat,geo,box,cyl,beam,ball,lanternAt,pot,M,roofM,CITY,authoredTextures,fountainSurfaces=[],
}) {
  const stats={canopies:0,signs:0,lanterns:0,fountains:0,sourceMeshes:0};
  const market=new THREE.Group();market.name='compact-city-market-frontages';root.add(market);
  const fadeMat=(color,extra={})=>{const m=mat(color,extra);patchMaterial(m,{fade:true});return m;};
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const c=canvas.getContext('2d');c.fillStyle='#eee8db';c.fillRect(0,0,64,64);
  c.strokeStyle='#ded6c6';c.lineWidth=1;
  for(let i=0;i<64;i+=8){c.beginPath();c.moveTo(i,0);c.lineTo(i,64);c.moveTo(0,i);c.lineTo(64,i);c.stroke();}
  const weave=new THREE.CanvasTexture(canvas);authoredTextures.add(weave);
  weave.colorSpace=THREE.SRGBColorSpace;weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.anisotropy=4;
  const fabrics=[fadeMat('#ddca9e',{map:weave,side:THREE.DoubleSide}),fadeMat('#648b75',{map:weave,side:THREE.DoubleSide})];
  // Reuse the same mild, world-space breeze and matching depth pass as nearby
  // leaf clusters. At awning height the displacement stays below a few cm.
  for(const fabric of fabrics)applyCityFoliageWind(fabric);
  const signMat=fadeMat('#bc985f',{map:weave,side:THREE.DoubleSide});
  const glow=fadeMat('#ffe3a0',{emissive:M.lantern.emissive,emissiveIntensity:0});
  // Batching keeps this material identity. Follow the production world clock
  // through the original lamp material instead of freezing a cloned intensity.
  Object.defineProperty(glow,'emissiveIntensity',{enumerable:true,configurable:true,get:()=>M.lantern.emissiveIntensity,set(){}});
  function hangingLamp(p,x,y,z,r=.19,h=.44) {
    const g=new THREE.Group();p.add(g);lanternAt(g,x,y,z,r,h);
    g.traverse(o=>{if(o.isMesh)o.material=o.material===M.lantern?glow:roofM.gold;});
    stats.lanterns++;
  }
  function sheet(p,side,z,depth,material) {
    const xs=[19.8,16.7,13.65,10.6,7.5],ys=[5.22,4.80,4.51,4.37,4.49];
    const vertices=[],uv=[],indices=[];
    for(let i=0;i<xs.length;i++)for(const edge of[-1,1]) {
      vertices.push(side*xs[i],ys[i],z+edge*depth/2);uv.push((19.8-xs[i])/2,(edge+1)*depth/4);
    }
    for(let i=0;i<xs.length-1;i++) {
      const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);
    }
    const geometry=geo(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;p.add(m);
    // Broad striped hems and curved scallops give an occupied market silhouette.
    for(const edge of[-1,1])for(let i=0;i<xs.length-1;i++) {
      beam(p,roofM.gold,[side*xs[i],ys[i]+.025,z+edge*depth/2],[side*xs[i+1],ys[i+1]+.025,z+edge*depth/2],.042);
      const shape=new THREE.Shape();shape.moveTo(-.43,0);shape.lineTo(.43,0);
      shape.quadraticCurveTo(.34,-.34,0,-.42);shape.quadraticCurveTo(-.34,-.34,-.43,0);
      const scallop=new THREE.Mesh(geo(new THREE.ShapeGeometry(shape)),material);
      scallop.position.set(side*(xs[i]+xs[i+1])/2,(ys[i]+ys[i+1])/2-.035,z+edge*(depth/2+.015));
      scallop.castShadow=true;scallop.receiveShadow=true;p.add(scallop);
    }
    // Inner hem is split into several scallops; it faces the central approach.
    box(p,roofM.wood,side*7.5,4.43,z,.075,.12,depth);
    for(let i=0;i<7;i++) {
      const shape=new THREE.Shape();shape.moveTo(-.42,0);shape.lineTo(.42,0);
      shape.quadraticCurveTo(.35,-.29,0,-.35);shape.quadraticCurveTo(-.35,-.29,-.42,0);
      const m=new THREE.Mesh(geo(new THREE.ShapeGeometry(shape)),material);
      m.position.set(side*7.49,4.40,z-depth/2+(i+.5)*depth/7);m.rotation.y=Math.PI/2;
      m.castShadow=true;p.add(m);
    }
  }
  for(const side of[-1,1]) {
    const shop=CITY.buildings.find(b=>b.id===(side<0?'general':'storage'));
    if(!shop)continue;
    const g=new THREE.Group();g.name=`market-canopy:${shop.id}`;market.add(g);
    const z=shop.z,depth=6.6;
    // Low supports lie inside the shop's existing solid reservation.
    for(const edge of[-1,1]) {
      box(g,M.wood,side*19.8,2.82,z+edge*3.3,.20,5.2,.20);
      box(g,M.rim,side*19.8,.47,z+edge*3.3,.38,.40,.38);
      beam(g,roofM.wood,[side*19.8,5.42,z+edge*3.3],[side*7.5,4.54,z+edge*3.3],.032);
      beam(g,roofM.wood,[side*19.8,5.48,z+edge*3.3],[side*11,4.75,z-edge*2.25],.025);
    }
    sheet(g,side,z,depth,fabrics[side<0?0:1]);
    // Suspended strings and signs are entirely above three metres.
    const stringZ=z-2.53;
    for(let i=0;i<4;i++) {
      const x1=side*(17.5-i*2.4),x2=side*(15.1-i*2.4);
      beam(g,roofM.wood,[x1,4.12,stringZ],[x2,3.97,stringZ],.022);
      hangingLamp(g,(x1+x2)/2,3.75,stringZ,.19,.43);
    }
    const sign=new THREE.Group();sign.position.set(side*8.25,3.89,z+.52);market.add(sign);
    box(sign,signMat,0,0,0,1.05,.78,.065);
    for(const y of[-.39,.39])box(sign,roofM.wood,0,y,0,1.15,.07,.09);
    for(const x of[-.45,.45])beam(sign,roofM.wood,[x,.39,0],[x,.88,0],.022);
    // Bilateral woven relief, not text too small to read at gameplay distance.
    for(const face of[-1,1]) {
      box(sign,roofM.cream,0,-.10,face*.065,.56,.24,.035);
      beam(sign,roofM.gold,[-.28,-.22,face*.09],[.28,.12,face*.09],.035);
      beam(sign,roofM.gold,[.28,-.22,face*.09],[-.28,.12,face*.09],.035);
    }
    stats.canopies++;stats.signs++;
  }

  const bed=CITY.buildings.find(b=>b.id==='garden_civic');
  if(bed) {
    const fountain=new THREE.Group();fountain.name='lotus-fountain';fountain.position.set(bed.x,0,bed.z);root.add(fountain);
    const stone=mat('#d8cfb4',{roughness:.82}),gold=mat('#ba9250',{metalness:.25,roughness:.58});
    const surface=createCityWaterMaterial({mat,mode:'fountain',x:bed.x,z:bed.z});
    fountainSurfaces.push(surface);const water=surface.material;
    const radius=Math.min(1.35,bed.w/2-.10,bed.d/2-.10);
    function lathe(profile,material,y=0,scale=1) {
      const shape=profile.map(([r,h])=>new THREE.Vector2(r*scale,h));
      const m=new THREE.Mesh(geo(new THREE.LatheGeometry(shape,32)),material);m.position.y=y;
      m.castShadow=true;m.receiveShadow=true;fountain.add(m);return m;
    }
    const basinScale=radius/1.35;
    cyl(fountain,M.brick,0,.12,0,radius,.24);
    lathe([[0,0],[1.15,0],[1.23,.10],[1.32,.29],[1.35,.37],[1.35,.46],[1.25,.48],[1.20,.36],[1.09,.17],[0,.17]],stone,.23,basinScale);
    // Rippled water and a slender lotus pedestal: Thai floral forms, no tall jet.
    cyl(fountain,water,0,.61,0,radius*.88,.018);
    lathe([[.38,0],[.43,.10],[.28,.23],[.23,.71],[.34,.82]],stone,.42);
    lathe([[.13,0],[.38,.06],[.68,.17],[.83,.36],[.83,.42],[.71,.42],[.62,.26],[.25,.12]],stone,1.20);
    cyl(fountain,water,0,1.57,0,.69,.015);
    // Eight carved golden petals gather around a small central lotus bud.
    const petal=new THREE.Shape();petal.moveTo(0,0);petal.quadraticCurveTo(-.25,.25,0,.58);petal.quadraticCurveTo(.25,.25,0,0);
    const petalGeometry=geo(new THREE.ExtrudeGeometry(petal,{depth:.055,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1}));
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,g=new THREE.Group();g.position.set(Math.sin(a)*.29,1.54,Math.cos(a)*.29);g.rotation.y=a;fountain.add(g);
      const m=new THREE.Mesh(petalGeometry,gold);m.rotation.x=.29;m.castShadow=true;m.receiveShadow=true;g.add(m);
    }
    ball(fountain,gold,0,1.88,0,.20,.33,.20);
    // Geometry is confined to the canonical bed, including the rounded lip.
    fountain.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(fountain),size=bounds.getSize(new THREE.Vector3());
    if(size.x>bed.w-.10||size.z>bed.d-.10||size.y>=3.5)throw new Error('Lotus fountain exceeds garden_civic reservation');
    stats.fountains++;fountain.traverse(o=>{if(o.isMesh)stats.sourceMeshes++;});
  }
  market.traverse(o=>{if(o.isMesh)stats.sourceMeshes++;});
  return stats;
}
