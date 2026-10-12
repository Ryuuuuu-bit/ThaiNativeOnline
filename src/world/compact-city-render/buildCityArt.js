import * as THREE from 'three';
import { StaticBatcher, InstanceSet } from '../Batching.js';
import { ubosot, chedi, kuti, warehouse, thaiRoof } from '../Architecture.js';
import { M as kitMaterials } from '../materials.js';
import { createRng } from '../rng.js';
import { patchMaterial } from '../shaders.js';
import { COMPACT_CITY as CITY } from '../compact-city.js';

// Production dressing adapted from the approved compact-city proposal. The
// canonical module owns navigation: every solid is inside a building reservation
// or beyond the playable bounds. No NPCs are created by the environment builder.
export async function buildCityArt(root, progress = () => {}) {
  // All resources are local to this build; shared Architecture resources are cloned.
  const staticRoot = new THREE.Group(), rng = createRng(20261012);
  const mats = [], geometries = [], authoredTextures = new Set(), ownedRoots = new Set([root, staticRoot]);
  let disposed = false;
  const ownRoot = group => { ownedRoots.add(group); return group; };
  function dispose() {
    if(disposed)return {geometries:0,materials:0,textures:0};disposed=true;
    const all=new Set(geometries),materials=new Set(mats),textures=new Set(authoredTextures),instances=new Set();
    // LOD batches may exist in detached hi/lo groups when an awaited assembly
    // fails. Track those groups from creation, not only the committed map root.
    for(const group of ownedRoots)group.traverse(o=>{
      if(o.geometry)all.add(o.geometry);
      for(const m of [].concat(o.material??[]))materials.add(m);
      for(const t of o.userData?.textures??[])textures.add(t);
      if(o.isInstancedMesh)instances.add(o);
    });
    for(const m of materials){
      for(const value of Object.values(m))if(value?.isTexture)textures.add(value);
      for(const u of Object.values(m.uniforms??{}))if(u?.value?.isTexture)textures.add(u.value);
    }
    // Continue releasing allocations if an external dispose listener throws.
    const failures=[];
    const release=resource=>{try{resource.dispose();}catch(error){failures.push(error);}};
    try {
      for(const resource of instances)release(resource);
      for(const resource of materials)release(resource);
      for(const resource of all)release(resource);
      for(const resource of textures)release(resource);
    }finally{
      for(const group of ownedRoots)group.clear();
      ownedRoots.clear();
    }
    if(failures.length)console.error('[compact-city] resource disposal failed',failures);
    return {geometries:all.size,materials:materials.size,textures:textures.size};
  }
  try {
  const mat = (color, extra = {}, fade = false) => {
    const m = new THREE.MeshStandardMaterial({color, roughness:.88, ...extra});
    if (fade) patchMaterial(m,{fade:true}); mats.push(m); return m;
  };
  const M = {
    sand:mat('#96a979'), path:mat('#ccb893'), brick:mat('#927456'), rim:mat('#ead4a5'),
    verge:mat('#c9b992',{transparent:true,opacity:.28,depthWrite:false}),
    vergeInner:mat('#c9b992',{transparent:true,opacity:.42,depthWrite:false}),
    wood:mat('#684c33'), dark:mat('#3e3830'), timber:mat('#987044'), cream:mat('#ede0b5'),
    gold:mat('#caa05e',{metalness:.15}), copper:mat('#b06439'), jade:mat('#49775c'),
    ochre:mat('#cf9b4d'), indigo:mat('#556979'), iron:mat('#566166',{metalness:.5}),
    roof:mat('#944f3b',{},true), roofLight:mat('#b67850',{},true), roofDark:mat('#74483b',{},true),
    leaf:mat('#678549',{},true), leafLight:mat('#88a35b',{},true), leafDark:mat('#4d734a',{},true),
    clay:mat('#b17751'), red:mat('#ba493a'), blue:mat('#398baa'), water:mat('#4f9595',{roughness:.44}),
    warp:mat('#80d2ad',{emissive:'#2e956e',emissiveIntensity:.35}), fire:mat('#ffbc62',{emissive:'#ee782b',emissiveIntensity:1.3}),
    lantern:mat('#ffe3a0',{emissive:'#ffad52',emissiveIntensity:0}),
    window:mat('#b78b50',{emissive:'#ffb861',emissiveIntensity:0}),
  };
  // Broad painted grain/courses reinforce the modeled boards and plinths;
  // shared small textures stay restrained at the normal orthographic zoom.
  function surfaceTexture(kind) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const c=canvas.getContext('2d'),look=createRng(kind==='wood'?5143:7119);
    c.fillStyle='#f3eddf';c.fillRect(0,0,64,64);
    if(kind==='wood') {
      for(let i=0;i<7;i++){
        const x=5+i*9;c.strokeStyle=i%2?'#e6ddcb':'#fffaf0';c.lineWidth=1.4;
        c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+look.range(-3,3),20,x+look.range(-3,3),42,x,64);c.stroke();
      }
    }else if(kind==='paving') {
      // Four broad stone slabs per four-metre repeat, with quiet mortar joints.
      for(let row=0;row<2;row++)for(let col=0;col<2;col++) {
        c.fillStyle=(row+col)%2?'#f4efe5':'#ebe6db';c.fillRect(col*32,row*32,32,32);
      }
      c.fillStyle='#d9d2c4';
      for(const t of[0,32]){c.fillRect(t,0,1,64);c.fillRect(0,t,64,1);}
    }else {
      c.fillStyle='#d3c9b6';
      for(let row=0;row<4;row++){
        c.fillRect(0,row*16,64,2);
        for(let x=(row%2)*16;x<64;x+=32)c.fillRect(x,row*16,2,16);
      }
    }
    const texture=new THREE.CanvasTexture(canvas);authoredTextures.add(texture);
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    return texture;
  }
  const woodTexture=surfaceTexture('wood'),brickTexture=surfaceTexture('brick');
  for(const m of[M.wood,M.timber,M.dark])m.map=woodTexture;
  M.brick.map=brickTexture;
  M.path.map=surfaceTexture('paving');
  const roofM=Object.fromEntries(['cream','gold','timber','wood'].map(key=>{const m=M[key].clone();patchMaterial(m,{fade:true});mats.push(m);return [key,m];}));
  const geo = g => { geometries.push(g); return g; };
  const BOX=geo(new THREE.BoxGeometry(1,1,1)), BALL=geo(new THREE.IcosahedronGeometry(1,1));
  const CYL=geo(new THREE.CylinderGeometry(1,1,1,10)), CONE=geo(new THREE.ConeGeometry(1,1,10));
  const FLOOR=geo(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2));
  const DISC=geo(new THREE.CircleGeometry(1,24).rotateX(-Math.PI/2)), floorMaterials=new Map();
  function floorMaterial(source) {
    if(!floorMaterials.has(source)) {
      const m=source.clone();
      // Paving must never use canopy dither. Clone also resets onBeforeCompile.
      m.side=THREE.FrontSide;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;
      mats.push(m);floorMaterials.set(source,m);
    }
    return floorMaterials.get(source);
  }
  function mesh(p,g,m,x,y,z,sx=1,sy=sx,sz=sx,ry=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.y=ry;o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
  const box=(p,m,x,y,z,w,h,d,ry=0)=>mesh(p,BOX,m,x,y,z,w,h,d,ry);
  const ball=(p,m,x,y,z,w,h=w,d=w)=>mesh(p,BALL,m,x,y,z,w,h,d);
  const cyl=(p,m,x,y,z,r,h)=>mesh(p,CYL,m,x,y,z,r,h,r);
  function beam(p,m,a,b,r=.08){const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u);const o=mesh(p,CYL,m,0,0,0,r,delta.length(),r);o.position.copy(u.add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;}
  function pavingUV(o,m) {
    if(m!==M.path)return;
    o.geometry=geo(o.geometry.clone());o.updateMatrix();
    const positions=o.geometry.getAttribute('position'),uv=o.geometry.getAttribute('uv'),p=new THREE.Vector3();
    for(let i=0;i<positions.count;i++) {
      p.fromBufferAttribute(positions,i).applyMatrix4(o.matrix);uv.setXY(i,p.x/4,p.z/4);
    }
    uv.needsUpdate=true;
  }
  function disc(p,m,x,z,r,y=.02){const o=mesh(p,DISC,floorMaterial(m),x,y+.0225,z,r,1,r);pavingUV(o,m);o.castShadow=false;return o;}
  function ground(m,x,y,z,w,h,d,ry=0){const o=mesh(staticRoot,FLOOR,floorMaterial(m),x,y+h/2,z,w,1,d,ry);pavingUV(o,m);o.castShadow=false;return o;}
  function lanternAt(p,x,y,z,r=.20,h=.43) {
    // The glowing body is exposed; opaque end caps never enclose its sides.
    cyl(p,M.lantern,x,y,z,r*.84,h*.78);
    for(const side of[-1,1])cyl(p,M.gold,x,y+side*h*.43,z,r,h*.10);
    for(const side of[-1,1])box(p,M.gold,x+side*r*.91,y,z,.025,h*.80,.025);
  }
  function crate(p,x,y,z,s=1){box(p,M.timber,x,y+s*.45,z,s,s*.9,s*.85);for(const h of[-.32,.32])box(p,M.dark,x,y+s*(.45+h),z+s*.43,s*1.03,.075,s*.05);for(const dx of[-.38,.38])box(p,M.wood,x+dx*s,y+s*.45,z+s*.435,.09,s*.86,.05);}
  function pot(p,x,y,z,s=1,herbs=false){cyl(p,M.clay,x,y+.32*s,z,.34*s,.58*s);cyl(p,M.dark,x,y+.63*s,z,.28*s,.035*s);if(herbs)for(let k=0;k<5;k++){const a=k*2.4;ball(p,k%2?M.leaf:M.leafLight,x+Math.cos(a)*s*.24,y+s*(.83+.11*(k%2)),z+Math.sin(a)*s*.24,s*.23,s*.37,s*.22);}}
  function bottle(p,x,y,z,m,s=1){ball(p,m,x,y+.21*s,z,.18*s,.23*s,.18*s);cyl(p,m,x,y+.46*s,z,.075*s,.22*s);cyl(p,M.gold,x,y+.6*s,z,.085*s,.07*s);}
  function roof(p,w,d,y,h=2,roofMaterial=M.roof){
    const profile=[[-w/2,.13],[-w*.39,0],[-w*.20,h*.39],[0,h],[w*.20,h*.39],[w*.39,0],[w/2,.13]];
    const vertices=[],indices=[],uv=[];let slope=0;
    for(let i=0;i<profile.length;i++){
      const[x,yy]=profile[i];if(i)slope+=Math.hypot(x-profile[i-1][0],yy-profile[i-1][1]);
      for(const z of[-d/2,d/2]){vertices.push(x,yy+y,z);uv.push(z/2,slope/2);}
    }
    for(let i=0;i<6;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}
    const g=geo(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const roofMesh=mesh(p,g,roofMaterial,0,0,0);roofMesh.material.side=THREE.DoubleSide;
    for(const end of[-1,1]){
      const shape=new THREE.Shape();profile.forEach(([x,yy],i)=>i?shape.lineTo(x,yy):shape.moveTo(x,yy));shape.lineTo(-w/2,.13);
      const face=mesh(p,geo(new THREE.ShapeGeometry(shape)),roofM.timber,0,y,end*(d/2-.10));face.material.side=THREE.DoubleSide;
      for(let i=0;i<profile.length-1;i++)beam(p,roofM.cream,[profile[i][0],y+profile[i][1]+.035,end*d/2],[profile[i+1][0],y+profile[i+1][1]+.035,end*d/2],.075);
      beam(p,roofM.gold,[0,y+h-.05,end*d/2],[0,y+h+.5,end*(d/2+.13)],.08);
      beam(p,roofM.gold,[0,y+h+.5,end*(d/2+.13)],[0,y+h+.72,end*(d/2+.36)],.065);
      // A few large sunburst beams read at gameplay scale.
      for(let i=-2;i<=2;i++)beam(p,roofM.wood,[0,y+.10,end*(d/2+.025)],[i*w*.12,y+h*(1-Math.abs(i)*.28),end*(d/2+.025)],.047);
    }
    box(p,M.roofDark,0,y+h+.035,0,.20,.18,d+.25);
    // Tile courses are broad bands, not individual high-frequency tile meshes.
    for(let j=0;j<6;j++){const z=-d/2+(j+.5)*d/6;for(const side of[-1,1])beam(p,M.roofLight,[0,y+h+.035,z],[side*w*.4,y+.055,z],.026);}
  }
  function shop(b){
    const g=new THREE.Group();g.name=b.id;g.position.set(b.x,0,b.z);g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;staticRoot.add(g);
    const rotated=b.front==='east'||b.front==='west',w=rotated?b.d:b.w,d=rotated?b.w:b.d;
    const kind=b.id, accent=/forge|smith/.test(kind)?M.copper:/pharm|herb|potion/.test(kind)?M.jade:/stor|stash/.test(kind)?M.indigo:M.ochre;
    box(g,M.brick,0,.19,0,w-.3,.38,d-.3);box(g,M.rim,0,.39,0,w-.18,.11,d-.18);
    // Open shop porch: rear walls and side bays keep the counter visible.
    box(g,M.cream,0,1.9,-d*.27,w-.9,3.1,.35);
    for(const side of[-1,1]){box(g,M.timber,side*(w/2-.5),1.7,-d*.1,.24,2.7,d*.45);for(const z of[-d*.35,d*.31])box(g,M.wood,side*(w/2-.6),2.05,z,.25,3.3,.25);}
    box(g,M.wood,0,3.22,d*.29,w-.8,.25,.25);
    box(g,accent,0,2.85,d*.32,w-.9,.48,.12);
    // Three decorative woven bands on a generous color-coded shop valance.
    for(const x of[-w*.31,0,w*.31])box(g,M.rim,x,2.85,d*.39,.19,.43,.045);
    kitRoof(g,{width:w-.7,depth:d-1.1,y:3.65,height:2.9,material:kitMaterials.tile,pattern:'sun'});
    box(g,M.wood,0,.94,d*.25,w*.68,1.02,1.05);box(g,M.timber,0,1.5,d*.25,w*.75,.15,1.19);
    for(const x of[-w*.27,0,w*.27])box(g,accent,x,.95,d*.3+.49,w*.2,.70,.06);
    for(const side of[-1,1]){pot(g,side*(w*.39),.46,d*.34,.9,true);crate(g,side*w*.30,.46,-d*.08,1.3);}
    if(/forge|smith/.test(kind)){
      box(g,M.dark,-w*.25,.75,-d*.02,1.55,.70,1.4);box(g,M.brick,-w*.25,1.35,-d*.02,1.8,.65,1.5);box(g,M.fire,-w*.25,1.73,-d*.02,.95,.10,.75);
      box(g,M.iron,1,1.85,d*.27,1.4,.3,.55);cyl(g,M.iron,1,1.68,d*.27,.23,.25);const horn=mesh(g,CONE,M.iron,1.9,1.87,d*.27,.3,.68,.3);horn.rotation.z=-Math.PI/2;
      for(let i=0;i<3;i++)beam(g,M.iron,[w*.28+i*.23,1.6,-d*.20],[w*.28+i*.23,2.9,-d*.2],.045);
    }else if(/pharm|herb|potion/.test(kind)){
      for(let i=0;i<9;i++)bottle(g,-w*.29+i*w*.075,1.58,d*.23,i%2?M.red:M.blue,1.3);
      for(let i=0;i<3;i++)pot(g,-2+i*1.4,1.57,d*.20,1,true);
    }else if(/stor|stash/.test(kind)){
      for(let i=0;i<3;i++){crate(g,-2+i*2,.49,-d*.18,1.4);box(g,M.gold,-2+i*2,1.85,-d*.18,.13,.08,1.2);}box(g,M.gold,0,1,d*.8/2,.4,.4,.07);
    }else{for(let i=0;i<4;i++){pot(g,-2+i*1.3,1.6,d*.26,.65,false);ball(g,i%2?M.ochre:M.red,-2+i*1.3,2.05,d*.26,.19);}crate(g,2,.45,-1,1.3);}
    // Corner lanterns stay inside the footprint and out of the walkway.
    for(const side of[-1,1])lanternAt(g,side*w*.39,2.5,d*.33,.18,.35);
    // Clearly modeled joinery and framed bays fill the under-eave silhouette.
    for(let i=0;i<5;i++)box(g,i%2?M.wood:M.timber,0,.78+i*.48,-d*.245,w-.95,.07,.055);
    for(const side of[-1,1]) {
      framedWindow(g,side*w*.25,2.08,-d*.24,w*.19,1.12);
      box(g,M.rim,side*(w/2-.6),.53,d*.31,.43,.26,.43);
      beam(g,M.wood,[side*(w/2-.6),2.50,d*.31],[side*(w/2-.6),3.52,d*.42],.09);
      box(g,M.gold,side*(w/2-.6),3.05,d*.31,.36,.13,.36);
    }
    box(g,M.timber,0,1.72,-d*.18,w*.52,.10,.7);
    for(let i=0;i<5;i++)pot(g,-w*.19+i*w*.095,1.78,-d*.18,.55,i%2===0);
  }

  function framedWindow(parent,x,y,z,w,h,ry=0) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;parent.add(g);
    box(g,M.dark,0,0,0,w+.23,h+.23,.13);box(g,M.window,0,0,.08,w,h,.08);
    for(const side of[-1,1]){
      box(g,M.timber,side*(w/2+.065),0,.15,.13,h+.23,.14);
      box(g,M.timber,0,side*(h/2+.065),.15,w+.25,.13,.14);
      box(g,M.wood,side*(w/2+.24),0,.05,.25,h,.10);
    }
    box(g,M.cream,0,0,.16,.065,h,.10);box(g,M.cream,0,0,.16,w,.065,.10);
  }
  function classCue(parent,b,w,d,accent,cueY=5.55) {
    // The board rises above the eave at the front corner; all posts and the
    // entire large glyph remain inside the canonical solid reservation.
    const g=new THREE.Group();g.name=`class-cue:${b.id}`;
    g.position.set(w*.29,cueY,d*.43);parent.add(g);
    for(const x of[-1.12,1.12]){box(g,M.wood,x,-cueY/2+.65,0,.14,cueY+1.1,.14);cyl(g,M.gold,x,1.08,0,.13,.24);}
    box(g,M.gold,0,0,0,2.42,2.18,.20);box(g,accent,0,0,0,2.23,2.0,.23);
    // Bilateral relief is readable from either camera heading, including the
    // backs of west-facing halls. No lettering or tiny ornament is required.
    for(const face of[-1,1]) {
      const icon=new THREE.Group();icon.position.z=face*.20;icon.rotation.y=face<0?Math.PI:0;g.add(icon);
      if(b.id.includes('muay')) {
        for(const side of[-1,1]){
          box(icon,M.cream,side*.46,-.40,0,.40,.58,.17);
          ball(icon,M.cream,side*.46,.14,0,.39,.43,.18);
          for(const y of[-.42,-.23,-.04])box(icon,M.copper,side*.46,y,.12,.46,.10,.10);
        }
      }else if(b.id.includes('warrior')) {
        for(const side of[-1,1]){
          beam(icon,M.cream,[-side*.54,-.56,0],[side*.60,.75,0],.11);
          beam(icon,M.gold,[-side*.75,-.38,.10],[-side*.27,-.72,.10],.075);
          ball(icon,M.gold,-side*.65,-.73,0,.14);
        }
      }else if(b.id.includes('hunter')) {
        const points=[[-.45,-.82,0],[-.80,-.42,0],[-.94,0,0],[-.80,.42,0],[-.45,.82,0]];
        for(let i=1;i<points.length;i++)beam(icon,M.gold,points[i-1],points[i],.08);
        beam(icon,M.cream,points[0],points[4],.027);
        beam(icon,M.cream,[-.64,0,.08],[.67,0,.08],.065);
        const tip=mesh(icon,CONE,M.cream,.75,0,.08,.18,.40,.15);tip.rotation.z=-Math.PI/2;
      }else if(b.id.includes('herbalist')) {
        ball(icon,M.cream,0,-.43,0,.72,.38,.16);box(icon,M.gold,0,-.10,.05,1.45,.14,.20);
        beam(icon,M.gold,[0,-.05,0],[0,.64,0],.07);
        for(const side of[-1,1]){const leaf=ball(icon,M.leafLight,side*.36,.42,0,.42,.26,.15);leaf.rotation.z=side*.48;}
      }else if(b.id.includes('shaman')) {
        ball(icon,M.cream,0,.04,0,.65,.83,.17);
        for(const side of[-1,1])ball(icon,M.dark,side*.27,.23,.16,.15,.17,.07);
        box(icon,M.gold,0,-.42,.16,.25,.42,.08);
        for(const side of[-1,1])beam(icon,M.gold,[side*.78,-.5,0],[side*.78,.62,0],.065);
      }else {
        for(const side of[-1,1]){
          const points=[[side*.62,-.74,0],[side*.32,-.20,0],[side*.46,.35,0],[side*.82,.75,0]];
          for(let i=1;i<points.length;i++)beam(icon,M.cream,points[i-1],points[i],i===1?.10:.14);
          box(icon,M.gold,side*.35,-.22,.11,.62,.10,.12);
        }
      }
    }
    for(const x of[-1.12,1.12])lanternAt(g,x,-1.45,0,.22,.43);
  }

  // Shared module geometry is copied, and kit materials are mapped into the
  // local palette. No module cache or another live map's GPU resources are freed.
  const copied = new Map(), kitPalette = new Map(), kitVariants = new Map();
  for(const [key,value] of Object.entries(kitMaterials)) {
    if(!value?.isMaterial)continue;
    const target = /tile|thatch/.test(key) ? (/Green/.test(key)?M.leafDark:/Dark/.test(key)?M.roofDark:M.roofLight)
      : /gold/.test(key)?M.gold : /plaster/.test(key)?M.cream : /stone/.test(key)?M.rim
      : /brick/.test(key)?M.brick : /darkWood|teak/.test(key)?M.wood : /wood/.test(key)?M.timber : M.cream;
    kitPalette.set(value,{target,roof:/tile|thatch/.test(key)});
  }
  const copiedTextures=new Map();
  function localTexture(source) {
    if(!copiedTextures.has(source)) {
      const texture=source.clone();texture.needsUpdate=true;
      authoredTextures.add(texture);copiedTextures.set(source,texture);
    }
    return copiedTextures.get(source);
  }
  function kitMaterial(source,roofPart,override) {
    const palette=kitPalette.get(source)??{target:M.timber,roof:false};
    const target=override??palette.target,roof=palette.roof;
    const fade=roofPart||roof,key=`${target.uuid}|${source.side}|${source.shadowSide}|${fade}|${source.map?.uuid??''}`;
    if(!kitVariants.has(key)) {
      const local=target.clone();local.side=source.side;local.shadowSide=source.shadowSide;
      if(source.map)local.map=localTexture(source.map);
      if(fade)patchMaterial(local,{fade:true});mats.push(local);kitVariants.set(key,local);
    }
    return kitVariants.get(key);
  }
  for(const material of[M.roof,M.roofLight,M.roofDark])material.map=localTexture(kitMaterials.tile.map);
  function kitRoof(parent,options,paint) {
    const g=thaiRoof(parent,options);
    g.traverse(o=>{if(!o.isMesh)return;
      if(!copied.has(o.geometry))copied.set(o.geometry,geo(o.geometry.clone()));
      o.geometry=copied.get(o.geometry);
      o.material=kitMaterial(o.material,true,kitPalette.get(o.material)?.roof?paint:undefined);
      o.receiveShadow=true;
    });
    return g;
  }
  function classHall(b) {
    const g=new THREE.Group();g.name=b.id;g.position.set(b.x,0,b.z);
    g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;staticRoot.add(g);
    const rotated=b.front==='east'||b.front==='west',w=rotated?b.d:b.w,d=rotated?b.w:b.d;
    const muay=b.id.includes('muay'),warrior=b.id.includes('warrior'),hunter=b.id.includes('hunter');
    const herbal=b.id.includes('herbalist'),shaman=b.id.includes('shaman');
    const accent=muay?M.copper:warrior?M.indigo:hunter?M.ochre:herbal?M.jade:shaman?M.indigo:M.dark;
    const raised=hunter?1.05:shaman?.65:.4,eave=warrior?4.7:hunter?4.3:shaman?4.2:herbal?3.65:muay?3.8:4.6;
    const front=d*.35,rear=-d*.22;
    box(g,M.brick,0,raised/2,0,w-.6,raised,d-.7);
    box(g,M.timber,0,raised+.06,0,w-.5,.13,d-.6);
    // Wide boards and exposed structural rails, rather than noisy surface specks.
    for(let i=0;i<Math.ceil((d-.8)/.55);i++)box(g,M.wood,0,raised+.14,-d/2+.55+i*.55,w-.7,.035,.035);
    const wall=hunter||shaman||(!muay&&!warrior&&!herbal)?M.timber:M.cream;
    box(g,wall,0,(raised+eave-.35)/2,rear,w-.95,eave-raised-.35,.28);
    for(let y=raised+.45;y<eave-.25;y+=.55)box(g,M.wood,0,y,rear+.16,w-.95,.065,.055);
    for(const x of[-w*.30,0,w*.30])box(g,M.dark,x,(raised+eave)/2,rear+.19,.15,eave-raised,.14);
    for(const side of[-1,1]) {
      framedWindow(g,side*w*.29,raised+1.55,rear+.19,w*.19,1.35);
      for(const z of[rear,front]) {
        const x=side*(w/2-.75);
        box(g,M.rim,x,raised+.12,z,.52,.28,.52);
        box(g,M.wood,x,(raised+eave)/2,z,.26,eave-raised,.26);
        box(g,M.gold,x,eave-.50,z,.37,.14,.37);
        beam(g,M.timber,[x, eave-1.15,z],[x-side*.70,eave-.10,z],.09);
        beam(g,M.timber,[x,eave-1.12,z],[x,eave-.10,z-.75],.09);
      }
      lanternAt(g,side*w*.34,eave-.8,front,.21,.43);
    }
    box(g,M.wood,0,eave-.10,front,w-1.1,.24,.25);
    // Central entry is a tall framed bay; the schools have no shop counter.
    const doorW=muay?w*.31:2.25;
    if(!muay) {
      box(g,M.dark,0,raised+1.24,rear+.20,doorW,2.48,.10);
      for(const side of[-1,1])box(g,M.timber,side*(doorW/2+.09),raised+1.28,rear+.29,.18,2.65,.20);
      box(g,M.gold,0,raised+2.66,rear+.29,doorW+.50,.17,.25);
      box(g,accent,0,raised+2.92,rear+.25,doorW+.72,.32,.16);
    }
    for(let i=0;i<3;i++)box(g,M.rim,0,raised*(i+1)/6,d*.44-i*.30,2.5,raised*(i+1)/3,.32);
    const roofOptions=(width,depth,y,height,x=0,z=0,material=kitMaterials.tile)=>({width,depth,y,height,x,z,material,pattern:'sun',tips:true});
    if(muay) {
      // An open training pavilion with a raised ring and corner rope posts.
      kitRoof(g,roofOptions(w-.9,d-1.3,eave,3.65),M.roof);
      box(g,M.ochre,0,raised+.18,0,w*.48,.17,d*.37);
      for(const x of[-w*.24,w*.24])for(const z of[-d*.185,d*.185]) {
        box(g,M.copper,x,raised+.83,z,.16,1.40,.16);
        for(const y of[.48,.80,1.12])beam(g,M.rim,[x,raised+y,z],[-x,raised+y,z],.032);
      }
      for(const side of[-1,1]) {
        beam(g,M.wood,[side*w*.36,eave-.2,rear],[side*w*.36,eave-.2,rear+1],.08);
        cyl(g,M.dark,side*w*.36,raised+1.55,rear+1,.34,1.5);
        for(const y of[raised+1,raised+1.8])cyl(g,M.copper,side*w*.36,y,rear+1,.35,.15);
      }
    }else if(warrior) {
      // Tall central sword hall and two lower pavilions give a formal silhouette.
      kitRoof(g,roofOptions(w*.56,d-1.4,eave,3.5),M.roofDark);
      for(const side of[-1,1]) {
        kitRoof(g,roofOptions(w*.28,d*.70,3.05,1.95,side*w*.33,-.35),M.roof);
        box(g,M.cream,side*w*.33,1.75,-d*.10,w*.25,2.55,d*.42);
        box(g,M.dark,side*w*.33,1.95,d*.115,w*.20,1.65,.13);
        for(let i=0;i<3;i++) {
          const x=side*w*.33+(i-1)*.55;
          beam(g,M.iron,[x,.75,d*.14],[x,2.55,d*.14],.045);
          box(g,M.gold,x,1.30,d*.16,.42,.09,.10);
        }
      }
      for(const x of[-1.7,1.7])box(g,M.cream,x,2.2,front,.36,3.5,.36);
      box(g,M.gold,0,3.95,front,4.1,.23,.40);
    }else if(hunter) {
      // Raised lodge, long gallery and a small attached storage roof.
      kitRoof(g,roofOptions(w*.72,d-1.3,eave,3.0,-w*.10,0,kitMaterials.thatch));
      kitRoof(g,roofOptions(w*.25,d*.65,3.0,1.75,w*.33,-d*.10,kitMaterials.thatchDark));
      for(const side of[-1,1]) {
        box(g,M.wood,side*w*.31,raised+.82,front,w*.27,.11,.13);
        for(let i=0;i<5;i++)box(g,M.timber,side*w*.31+(i-2)*w*.052,raised+.45,front,.07,.72,.07);
        beam(g,M.wood,[side*w*.38,.20,front],[side*w*.19,raised,front],.10);
      }
      cyl(g,M.timber,-w*.32,raised+1.0,rear+1,.8,.15).rotation.x=Math.PI/2;
      cyl(g,M.cream,-w*.32,raised+1.0,rear+1.1,.57,.12).rotation.x=Math.PI/2;
      cyl(g,M.copper,-w*.32,raised+1.0,rear+1.2,.25,.10).rotation.x=Math.PI/2;
      crate(g,w*.29,raised+.15,-d*.12,1.05);
    }else if(herbal) {
      kitRoof(g,roofOptions(w*.63,d-1.5,eave,2.8),M.leafDark);
      for(const side of[-1,1]) {
        kitRoof(g,roofOptions(w*.28,d*.66,2.9,1.8,side*w*.32,-.45,kitMaterials.tileGreen));
        box(g,M.cream,side*w*.31,1.60,-d*.10,w*.25,2.2,d*.40);
        box(g,M.timber,side*w*.31,.75,front,w*.25,.42,1.1);
        for(let i=0;i<3;i++)pot(g,side*w*.31+(i-1)*.60,1.0,front,.75,true);
        box(g,M.timber,side*w*.31,2.05,rear+.6,w*.25,.12,.55);
        for(let i=0;i<4;i++)bottle(g,side*w*.31+(i-1.5)*.4,2.12,rear+.6,i%2?M.blue:M.red,.85);
      }
    }else if(shaman) {
      const ceremonial=mat('#72556a',{},true);
      kitRoof(g,roofOptions(w-.9,d-1.4,eave,3.1),ceremonial);
      kitRoof(g,roofOptions(w*.59,d*.68,eave+1.4,2.6),M.roofDark);
      for(const side of[-1,1]) {
        box(g,M.indigo,side*.86,raised+1.4,rear+.35,.60,2.1,.10);
        box(g,M.gold,side*1.30,raised+1.6,rear+.40,.12,2.7,.16);
        cyl(g,M.gold,side*w*.30,raised+.65,front,.35,1.1);
        ball(g,M.lantern,side*w*.30,raised+1.32,front,.21,.28,.21);
      }
      box(g,kitMaterial(kitMaterials.yantra,false,M.cream),0,raised+2.0,rear+.4,.9,1.2,.04);
    }else {
      // Staggered dark roofs, shutter screens and an upper timber gallery.
      kitRoof(g,roofOptions(w*.60,d-1.4,eave,2.8,-w*.14),M.roofDark);
      kitRoof(g,roofOptions(w*.36,d*.72,3.3,2.15,w*.27,-d*.09),M.roof);
      box(g,M.timber,-w*.16,3.25,front,w*.46,.18,1.1);
      box(g,M.dark,-w*.16,3.95,front+.48,w*.46,.12,.10);
      for(let i=0;i<8;i++)box(g,M.timber,-w*.37+i*w*.06,3.62,front+.48,.07,.65,.07);
      for(let i=0;i<7;i++)box(g,M.wood,w*.32+(i-3)*.23,1.8,d*.15,.10,2.6,.12);
      crate(g,-w*.30,raised+.15,-d*.02,.85);
    }
    classCue(g,b,w,d,accent,eave+1.60);
  }
  function localKit(g,b) {
    g.traverse(o=>{if(!o.isMesh)return;
      if(!copied.has(o.geometry))copied.set(o.geometry,geo(o.geometry.clone()));
      let roofPart=false;
      // thaiRoof places its local assembly at eave height. Scope gables and
      // bargeboards to that assembly; masonry/platforms stay opaque.
      for(let p=o.parent;p&&p!==g;p=p.parent)if(p.position.y>=2.6)roofPart=true;
      o.geometry=copied.get(o.geometry);o.material=kitMaterial(o.material,roofPart);
      o.receiveShadow=true;
    });
    const bb=new THREE.Box3().setFromObject(g),size=bb.getSize(new THREE.Vector3());
    const center=bb.getCenter(new THREE.Vector3());
    const s=Math.min((b.w-.2)/size.x,(b.d-.2)/size.z);
    g.scale.set(s,Math.min(s,1.3),s);
    g.position.set(b.x-center.x*s,-bb.min.y*Math.min(s,1.3),b.z-center.z*s);
    g.name=b.id;return g;
  }
  // Primitive instances cover repeated columns, baskets, foliage and crates.
  // Uniquely shaped Thai roofs are spatially merged with the existing batcher.
  async function assemble(source,target) {
    ownRoot(target);
    source.updateMatrixWorld(true);
    const batcher=new StaticBatcher(32),sets=new Map();
    source.traverse(o=>{if(!o.isMesh)return;
      if([BALL,CYL,CONE].includes(o.geometry)) {
        const key=o.geometry.uuid+'|'+o.material.uuid+'|'+o.castShadow;
        if(!sets.has(key))sets.set(key,new InstanceSet(o.geometry,o.material,{chunk:32,castShadow:o.castShadow}));
        sets.get(key).addMatrix(o.matrixWorld);
      }else batcher.add(o.geometry,o.material,o.matrixWorld,o.castShadow,true);
    });
    const merged=await batcher.buildAsync(target);let instances=0;
    for(const set of sets.values())instances+=set.build(target).length;
    return {merged,instances,source:batcher.count+[...sets.values()].reduce((n,s)=>n+s.total,0)};
  }
  const lods=[];
  async function sacred(b) {
    const high=ownRoot(new THREE.Group()),low=ownRoot(new THREE.Group());
    if(b.kind==='temple')high.add(localKit(ubosot(rng),b));
    else {const g=new THREE.Group();chedi(g,{scale:1.5});high.add(localKit(g,b));}
    const g=new THREE.Group();g.position.set(b.x,0,b.z);low.add(g);
    if(b.kind==='temple') {
      box(g,M.brick,0,.35,0,b.w-.2,.7,b.d-.2);
      box(g,M.cream,0,2.3,0,b.w*.65,3.3,b.d*.7);
      const templeRoof=kitMaterial(kitMaterials.tileGreen,true);
      roof(g,b.w*.85,b.d*.86,4.0,3.5,templeRoof);
      roof(g,b.w*.60,b.d*.65,5.3,2.8,templeRoof);
    }else {
      box(g,M.brick,0,.4,0,b.w-.2,.8,b.d-.2);
      cyl(g,M.rim,0,1.4,0,2.8,1.6);ball(g,M.rim,0,3.2,0,2.1,2.4,2.1);
      mesh(g,CONE,M.gold,0,7,0,.65,4,.65);
    }
    const hi=ownRoot(new THREE.Group()),lo=ownRoot(new THREE.Group());
    await assemble(high,hi);await assemble(low,lo);
    // The geometry is baked in city coordinates, so the LOD origin is moved to
    // the landmark and its children compensated, preserving camera distances.
    const lod=new THREE.LOD();lod.position.set(b.x,0,b.z);
    hi.position.set(-b.x,0,-b.z);lo.position.copy(hi.position);
    lod.addLevel(hi,0);lod.addLevel(lo,95,.12);lod.name=b.id;root.add(lod);lods.push(lod);
  }

  const landMaterial=M.sand;
  const pickGround=new THREE.Mesh(geo(new THREE.PlaneGeometry(180,146)),landMaterial);
  pickGround.rotation.x=-Math.PI/2;pickGround.position.set(0,0,-8.4);
  pickGround.name='compact-city-picking-ground';pickGround.receiveShadow=true;root.add(pickGround);
  for(const road of CITY.roads){
    ground(M.verge,road.x,.0005,road.z,road.w+2.8,.001,road.d+2.8);
    ground(M.vergeInner,road.x,.0015,road.z,road.w+1.5,.001,road.d+1.5);
    ground(M.brick,road.x,.003,road.z,road.w+.5,.004,road.d+.5);
    ground(M.path,road.x,.008,road.z,road.w,.004,road.d);
  }
  // Courts connect every service face to the road network, with paving almost
  // flush with canonical zero-height land so movement and click picking agree.
  for(const b of CITY.buildings) {
    ground(M.verge,b.x,.0005,b.z,b.w+4.5,.001,b.d+4.5);
    ground(M.vergeInner,b.x,.0015,b.z,b.w+3,.001,b.d+3);
    ground(M.path,b.x,.006,b.z,b.w+2,.004,b.d+2);
    const side=b.front==='east'?1:b.front==='west'?-1:0;
    if(side)ground(M.path,b.x+side*(b.w/2+1.6),.007,b.z,3.2,.004,b.d+2);
    else ground(M.path,b.x,.007,b.z+b.d/2+1.6,b.w+2,.004,3.2);
    // Full footprint plinth is the visible counterpart of the canonical box.
    box(staticRoot,M.brick,b.x,.10,b.z,b.w,.2,b.d);
    if(b.kind==='temple'||b.kind==='chedi')await sacred(b);
    else if(b.kind==='house') {
      const homes = b.id==='homes' ? 2 : 1;
      for(let i=0;i<homes;i++){
        const sub={...b,x:b.x+(i-(homes-1)/2)*b.w/homes,w:b.w/homes-.3};
        if(b.id==='kuti')staticRoot.add(localKit(kuti(rng),sub));
        else {
          // Own seeded house kit avoids Architecture's global look counter,
          // keeping repeated city builds identical during map round trips.
          const g=new THREE.Group();g.position.set(sub.x,0,sub.z);staticRoot.add(g);
          const w=sub.w-.5,d=sub.d-1;
          for(const x of[-w*.37,w*.37])for(const z of[-d*.34,d*.34])cyl(g,M.wood,x,.65,z,.13,1.3);
          box(g,M.timber,0,1.1,0,w,.18,d);
          box(g,M.cream,0,2.3,-d*.10,w-.5,2.3,d*.65);
          for(const side of[-1,1]){box(g,M.window,side*w*.24,2.3,d*.23,.95,1.2,.12);box(g,M.gold,side*w*.24,2.3,d*.30,.08,1.05,.04);}
          box(g,M.dark,0,2.0,d*.23,.95,1.9,.12);
          roof(g,w,d,3.55,2.8);
          box(g,M.wood,0,1.85,d*.44,w,.10,.10);
          for(let i=0;i<6;i++)box(g,M.wood,-w*.44+i*w*.176,1.55,d*.44,.055,.60,.055);
          for(let i=0;i<4;i++)box(g,M.timber,0,.15+i*.23,d*.43-i*.35,1.15,.30+i*.46,.37);
          pot(g,w*.35,1.21,d*.30,.75,true);
        }
      }
    }else if(b.kind==='warehouse') {
      staticRoot.add(localKit(warehouse(rng,b.w-2,b.d-2),b));
      for(let i=0;i<6;i++)crate(staticRoot,b.x-b.w*.33+i*b.w*.12,.22,b.z+b.d*.31,.8);
    }else if(b.kind==='landmark') {
      const g=new THREE.Group();g.position.set(b.x,0,b.z);staticRoot.add(g);
      box(g,M.rim,0,.24,0,5.8,.48,5.8);
      for(const x of[-2,2])for(const z of[-2,2])box(g,M.wood, x,1.95,z,.25,3.4,.25);
      roof(g,5.8,5.8,3.6,2.3);roof(g,4.0,4.0,4.6,1.7);
      cyl(g,M.gold,0,1.8,0,.35,2.1);ball(g,M.gold,0,3,0,.4,.5,.4);
      for(const x of[-2,2])lanternAt(g,x,2.5,2,.23,.45);
    }else if(b.kind==='class')classHall(b);
    else shop(b);
  }
  progress('กำลังจัดลานตลาด สวน และท่าเรือ…');await new Promise(r=>setTimeout(r,0));
  ground(M.brick,0,.014,0,28.8,.004,28.8);ground(M.path,0,.018,0,28,.004,28);
  disc(staticRoot,M.rim,0,0,6.5,.022);disc(staticRoot,M.brick,0,0,6.05,.026);disc(staticRoot,M.path,0,0,5.7,.030);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;ground(M.rim,Math.sin(a)*4.2,.052,Math.cos(a)*4.2,.15,.005,2,a);}
  disc(staticRoot,M.gold,0,0,.7,.035);
  const warp=CITY.pois.find(p=>p.id==='warp');
  if(warp){
    const storage=CITY.buildings.find(b=>b.id==='storage');
    const besideStorage=storage&&Math.abs(warp.z-storage.z)<storage.d/2&&Math.abs(warp.x-storage.x)<storage.w/2+4;
    // Keep the keeper's canonical contact point, inset only the visual pad.
    const x=besideStorage?warp.x+Math.sign(warp.x-storage.x)*2.5:warp.x;
    disc(staticRoot,M.brick,x,warp.z,2.7,.022);disc(staticRoot,M.rim,x,warp.z,2.4,.026);disc(staticRoot,M.jade,x,warp.z,2.15,.030);
  }

  // Open-air merchants display wares on low woven mats, as in a Thai street
  // market. Everything here is below the wading/step silhouette; no unregistered
  // counter, upright post or collision box intrudes into the shared NPC routes.
  for(const side of[-1,1])for(let i=0;i<6;i++) {
    const x=side*12.6,z=4+i*3;
    ground(i%2?M.ochre:M.indigo,x,.022,z,1.7,.004,2.2);
    for(let k=0;k<3;k++) {
      ground(M.rim,x+side*.05,.026,z-.7+k*.7,1.4,.003,.10);
      const zz=z-.7+k*.7,kind=(i+k)%4;
      if(kind===0) {
        const basket=cyl(staticRoot,M.timber,x,.08,zz,.31,.11);basket.castShadow=false;
        const rim=cyl(staticRoot,M.ochre,x,.145,zz,.34,.04);rim.castShadow=false;
        const contents=cyl(staticRoot,M.dark,x,.168,zz,.27,.014);contents.castShadow=false;
        for(const dx of[-.11,.11])ball(staticRoot,M.rim,x+dx,.18,zz,.10,.035,.13).castShadow=false;
      }else if(kind===1) {
        for(const dx of[-.22,.22]) {
          ball(staticRoot,M.cream,x+dx,.095,zz,.20,.085,.26).castShadow=false;
          box(staticRoot,M.wood,x+dx,.175,zz,.15,.023,.06).castShadow=false;
        }
      }else if(kind===2) {
        for(const dx of[-.23,.23]) {
          cyl(staticRoot,M.clay,x+dx,.11,zz,.15,.16).castShadow=false;
          cyl(staticRoot,M.dark,x+dx,.195,zz,.10,.018).castShadow=false;
          cyl(staticRoot,M.ochre,x+dx,.20,zz,.13,.018).castShadow=false;
        }
      }else {
        const tray=cyl(staticRoot,M.wood,x,.065,zz,.35,.06);tray.castShadow=false;
        for(let n=0;n<3;n++) {
          const bundle=ball(staticRoot,n%2?M.leaf:M.leafLight,x-.20+n*.20,.12,zz,.12,.05,.27);bundle.castShadow=false;
          box(staticRoot,M.rim,x-.20+n*.20,.17,zz,.12,.015,.04).castShadow=false;
        }
      }
    }
  }
  // Shade sails are supported from the blocked shop buildings. Their ropes
  // and hanging lanterns stay well above head height over the market frontage.
  for(const side of[-1,1]) {
    const b=CITY.buildings.find(b=>b.id===(side<0?'general':'storage'));
    const anchorX=side*19.8;
    box(staticRoot,M.wood,anchorX,3.8,b.z-2,.18,7.2,.18);
    box(staticRoot,M.wood,anchorX,3.8,b.z+2,.18,7.2,.18);
    for(const z of[b.z-2,b.z+2])beam(staticRoot,roofM.wood,[anchorX,7.1,z],[side*10.5,4.2,z],.025);
    box(staticRoot,side<0?roofM.cream:M.roofDark,side*14.8,4.2,b.z,8.5,.045,4.1);
    for(let i=0;i<3;i++)box(staticRoot,roofM.gold,side*14.8,4.23,b.z-1.4+i*1.4,8.4,.035,.30);
    for(const z of[b.z-1.5,b.z+1.5])lanternAt(staticRoot,side*11.2,3.7,z,.18,.45);
  }

  function tree(p,x,z,s=1,lift=0) {
    const trunkHeight=3.1*s+lift;
    cyl(p,M.wood,x,trunkHeight/2,z,.25*s,trunkHeight);
    for(let i=0;i<5;i++){const a=i*2.4;
      beam(p,M.wood,[x,1.8*s+lift*.7,z],[x+Math.cos(a)*s,3*s+lift,z+Math.sin(a)*s],.11*s);
      ball(p,[M.leaf,M.leafLight,M.leafDark][i%3],x+Math.cos(a)*s,(3.25+i%2*.4)*s+lift,z+Math.sin(a)*s,1.65*s,1.05*s,1.5*s);
    }
  }
  // Tree trunks and planted vessels belong to blocked reservations. The outer
  // groves form clusters behind the walls; service lanes stay entirely open.
  for(const b of CITY.buildings.filter(b=>['class','house','warehouse'].includes(b.kind))) {
    const x=b.x-b.w*.43,z=b.z-b.d*.40;
    tree(staticRoot,x,z,b.kind==='house'?1.15:.95,2.6);
    for(let i=0;i<3;i++)pot(staticRoot,x+i*.65,.2,z+.8,.65,true);
  }
  for(const side of[-1,1])for(const cz of[-50,-15,22,48]) {
    for(let i=0;i<4;i++)tree(staticRoot,side*rng.range(77,86),cz+rng.range(-4,4),rng.range(.9,1.5));
  }
  for(const cx of[-60,-30,28,60])for(let i=0;i<3;i++)tree(staticRoot,cx+rng.range(-3,3),rng.range(-80,-74),rng.range(.8,1.3));
  // Low grass/moss islands are land coloring, with no invisible solid obstacles.
  for(let i=0;i<160;i++) {
    const x=rng.range(-70,70),z=rng.range(-62,62);
    if(CITY.roads.some(r=>Math.abs(x-r.x)<r.w/2+2&&Math.abs(z-r.z)<r.d/2+2)
      || CITY.buildings.some(b=>Math.abs(x-b.x)<b.w/2+3&&Math.abs(z-b.z)<b.d/2+3)
      || Math.abs(x)<16&&Math.abs(z)<28)continue;
    const patchRadius=rng.range(1.2,3.0);
    disc(staticRoot,i%2?M.sand:M.leafLight,x,z,patchRadius,-.0175);
    for(let j=0;j<5;j++){
      const xx=x+rng.range(-patchRadius*.55,patchRadius*.55),zz=z+rng.range(-patchRadius*.55,patchRadius*.55);
      const cover=ball(staticRoot,floorMaterial(j%2?M.leaf:M.leafLight),xx,.06,zz,.32,.065,.23);cover.castShadow=false;
    }
  }
  // Perimeter masonry lies beyond the navigation boundary; the north passage
  // stays visually open and PortalManager supplies the actual warp pillars.
  for(const side of[-1,1]) {
    box(staticRoot,M.brick,side*73,1.15,-1,1.5,2.3,130);
    box(staticRoot,M.rim,side*73,2.35,-1,1.7,.18,130);
    for(let z=-62;z<64;z+=4)box(staticRoot,M.rim,side*73,2.65,z,1.8,.45,.9);
    box(staticRoot,M.brick,side*39,1.5,-65,66,3,1.5);
    box(staticRoot,M.rim,side*39,3.05,-65,66,.18,1.8);
    for(let x=8;x<72;x+=4)box(staticRoot,M.rim,side*x,3.35,-65,1,.5,1.8);
    const g=new THREE.Group();g.position.set(side*7.5,0,-67);staticRoot.add(g);
    box(g,M.cream,0,2,0,4,4,4);roof(g,5,5,4,2.5);
  }
  // Pier land stays flat through the boatman's (0,55) contact area. Water starts
  // outside +64, so neither client nor server requires a special deck exception.
  ground(M.wood,0,.002,59,14,.003,10);
  for(let z=54;z<=63;z+=.5)ground(M.timber,0,.007,z,13.9,.003,.43);
  for(const side of[-1,1])for(let z=65;z<76;z+=4){cyl(staticRoot,M.wood,side*7,-.15,z,.26,2.4);cyl(staticRoot,M.gold,side*7,.8,z,.3,.12);}
  ground(M.wood,0,-.016,69,14,.025,9);
  for(let x=-70;x<72;x+=4){box(staticRoot,M.rim,x+2,.08,64.6,3.96,.32,.7);}
  // A cargo sampan and a moored junk are silhouettes in the river backdrop.
  function boat(x,z,scale=1,sail=false) {
    const g=new THREE.Group();g.position.set(x,-.28,z);g.scale.setScalar(scale);staticRoot.add(g);
    ball(g,M.wood,0,.25,0,2.4,.62,6);
    box(g,M.timber,0,.60,0,3.5,.18,9.5);
    for(const side of[-1,1])box(g,M.dark,side*1.8,.95,0,.2,.6,9);
    for(let i=0;i<4;i++)crate(g,-.9+(i%2)*1.8,.72,-2+Math.floor(i/2)*2,1.2);
    if(sail){cyl(g,M.wood,0,5,0,.15,10);box(g,M.cream,0,6.5,.12,5.5,5.5,.08);
      for(let y=4;y<9;y+=.85)box(g,M.timber,0,y,.19,5.5,.07,.08);roof(g,3.5,3.2,1.3,1.4);}
  }
  boat(-20,75,1.2,true);boat(23,70,.8,false);
  const waterMaterial=mat('#6ba6a0',{roughness:.38,metalness:.06});
  const river=new THREE.Mesh(geo(new THREE.PlaneGeometry(200,70)),waterMaterial);
  river.rotation.x=-Math.PI/2;river.position.set(0,-.32,99.65);river.receiveShadow=true;root.add(river);
  const rippleMat=mat('#a5cebb',{transparent:true,opacity:.30,depthWrite:false});
  const rippleGroup=new THREE.Group();root.add(rippleGroup);
  const rippleSet=new InstanceSet(BOX,rippleMat,{chunk:32,castShadow:false});
  for(let i=0;i<150;i++)rippleSet.add(rng.range(-90,90),-.30,rng.range(65,130),{sx:rng.range(.7,3),sy:.008,sz:.045});
  rippleSet.build(rippleGroup);
  progress('กำลังประกอบหลังคาและรายละเอียดเมือง…');
  const batches=await assemble(staticRoot,root);
  const stats={buildings:CITY.buildings.length,halls:{count:CITY.buildings.filter(b=>b.kind==='class').length},classCues:CITY.buildings.filter(b=>b.kind==='class').length,lodAssets:lods.length,staticMeshes:batches.merged,instanceMeshes:batches.instances,sourceMeshes:batches.source};
  const water={mesh:river,update(t){rippleGroup.position.x=Math.sin(t*.18)*.18;},dispose(){}};
  return {ground:pickGround,water,stats,update(t,dt,focus,env){
    water.update(t);
    const night=THREE.MathUtils.clamp(env?.lantern??env?.night??0,0,1);
    M.lantern.emissiveIntensity=1.8*night;M.window.emissiveIntensity=1.15*night;
    M.fire.emissiveIntensity=1.1+night*.3;M.warp.emissiveIntensity=.35+night*.3;
  },dispose};
  }catch(error){
    dispose();
    throw error;
  }finally{
    // Source meshes have already been copied into merged/instanced batches.
    staticRoot.clear();
  }
}
