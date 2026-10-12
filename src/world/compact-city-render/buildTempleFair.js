import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FAIR_SITES, fairIsOpen } from '../../fair/fairSites.js';
import { patchMaterial } from '../shaders.js';

// Standalone synchronous city attachment, or source geometry for Main's
// existing tracked allocator/batcher. Default standalone mode owns and releases
// every material, geometry and sign texture; injected resources remain borrowed.
export function buildTempleFair({root:parent,sites=FAIR_SITES,mat:externalMat,
  geo:externalGeo,box:externalBox,cyl:externalCyl,beam:externalBeam,ball:externalBall,
  M,authoredTextures,batch=!externalMat,hour=18,nightStrength=.75}={}) {
  const root=new THREE.Group();root.name='city:temple-fair';
  const source=new THREE.Group();source.name='temple-fair-sources';
  const geometries=new Set(),materials=new Set(),textures=new Set();
  let disposed=false;
  const geo=g=>externalGeo?externalGeo(g):(geometries.add(g),g);
  const mat=(color,extra={},fade=false)=>{
    const m=externalMat?externalMat(color,extra,fade):new THREE.MeshStandardMaterial({color,roughness:.87,...extra});
    if(!externalMat){materials.add(m);if(fade)patchMaterial(m,{fade:true});}return m;
  };
  const geometryCache=new Map();
  const cached=(key,make)=>{if(!geometryCache.has(key))geometryCache.set(key,geo(make()));return geometryCache.get(key);};
  const mesh=(p,g,m,x,y,z,sx=1,sy=sx,sz=sx)=>{
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=o.receiveShadow=true;p.add(o);return o;
  };
  const box=externalBox??((p,m,x,y,z,w,h,d)=>mesh(p,cached('box',()=>new THREE.BoxGeometry(1,1,1)),m,x,y,z,w,h,d));
  const cyl=externalCyl??((p,m,x,y,z,r,h)=>mesh(p,cached('cylinder',()=>new THREE.CylinderGeometry(1,1,1,12)),m,x,y,z,r,h,r));
  const ball=externalBall??((p,m,x,y,z,w,h,d)=>mesh(p,cached('sphere',()=>new THREE.SphereGeometry(1,12,8)),m,x,y,z,w,h,d));
  const beam=externalBeam??((p,m,a,b,r)=>{
    const u=new THREE.Vector3(...a),v=new THREE.Vector3(...b),delta=v.clone().sub(u);
    const o=cyl(p,m,0,0,0,r,delta.length());o.position.copy(u.add(v).multiplyScalar(.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;
  });
  const stats={fairStalls:0,fairLanterns:0,fairBalloons:0,fairDolls:0,fairSymbols:0,fairSourceMeshes:0,fairDrawCalls:0,fairBounds:{}};
  const dispose=()=>{
    if(disposed)return;disposed=true;root.removeFromParent();root.clear();source.clear();
    for(const r of [...geometries,...materials,...textures])r.dispose();
    geometries.clear();materials.clear();textures.clear();
  };
  try {
    const wood=mat('#795637'),bamboo=mat('#b59a64'),dark=mat('#413b35'),cream=mat('#e8d6af');
    const gold=mat('#c49b50',{metalness:.12}),red=mat('#af5043'),green=mat('#698767'),blue=mat('#568d9e');
    const colors=[red,blue,mat('#d7ac56'),green,mat('#c48b9c')];
    const papers=[mat('#d18855',{},true),mat('#697b77',{},true),mat('#d3b16f',{},true)];
    const glow=M?.lantern??mat('#ffe3a7',{emissive:'#ffb664',emissiveIntensity:0},true);
    const canopyMaterials=[mat('#ad5145',{},true),mat('#5f8691',{},true),mat('#c39959',{},true)];
    const paleCanvas=mat('#e5cea0',{},true);
    const triangle=cached('bunting',()=>{
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.17,0,0,.17,0,0,0,-.34,0],3));
      g.setIndex([0,1,2,2,1,0]);g.computeVertexNormals();return g;
    });
    const ring=cached('ring',()=>new THREE.TorusGeometry(1,.11,5,12));
    function lantern(p,x,y,z,r=.17) {
      ball(p,glow,x,y,z,r,r*1.36,r);
      for(const sign of[-1,1])cyl(p,gold,x,y+sign*r*1.31,z,r*.74,.045);
      beam(p,bamboo,[x,y+r*1.4,z],[x,y+.48,z],.018);
      stats.fairLanterns++;
    }
    function sign(p,site,z) {
      box(p,wood,0,2.93,z,2.75,.50,.10);
      if(typeof document==='undefined')return;
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
      const c=canvas.getContext('2d');if(!c)return;
      c.fillStyle='#e5d1a0';c.fillRect(0,0,512,96);
      c.strokeStyle='#a65d3e';c.lineWidth=5;c.strokeRect(8,8,496,80);
      c.fillStyle='#653f30';c.font='bold 44px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(site.label,256,49);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      if(authoredTextures)authoredTextures.add(texture);else textures.add(texture);
      box(p,mat('#ffffff',{map:texture},true),0,2.93,z+.065,2.65,.43,.015);
    }
    function doll(p,x,y,z,type,color) {
      const g=new THREE.Group();g.position.set(x,y,z);p.add(g);
      ball(g,color,0,.24,0,.20,.27,.14);ball(g,color,0,.62,0,.23,.22,.18);
      for(const side of[-1,1]) {
        ball(g,color,side*.21,.34,0,.09,.14,.10);
        ball(g,color,side*.12,.035,.045,.11,.075,.14);
        ball(g,color,side*.13,type==='rabbit'?.88:.79,0,type==='rabbit'?.065:.09,type==='rabbit'?.22:.09,.07);
        ball(g,dark,side*.075,.65,.17,.026,.031,.020);
      }
      ball(g,cream,0,.56,.17,.095,.063,.045);
      box(g,red,0,.44,.15,.14,.06,.045);
      stats.fairDolls++;
    }
    function fish(p,x,y,z,m) {
      ball(p,m,x,y,z,.22,.11,.06);
      const tail=mesh(p,triangle,m,x+.20,y,z,.46);tail.rotation.z=Math.PI/2;
      ball(p,dark,x-.12,y+.025,z+.06,.025,.025,.015);
    }
    function icon(p,x,y,z,type) {
      cyl(p,cream,x,y,z,.36,.045).rotation.x=Math.PI/2;
      const front=z+.065;
      if(type===0) {ball(p,gold,x,y-.08,front,.15,.20,.055);ball(p,gold,x,y+.15,front,.10,.11,.055);}
      if(type===1) {
        ball(p,red,x,y,front,.16,.12,.065);
        for(const side of[-1,1]) {
          for(const offset of[-.10,0,.10])beam(p,red,[x+side*.10,y+offset,front],[x+side*.26,y+offset+.05,front],.025);
          ball(p,red,x+side*.22,y+.18,front,.075,.075,.045);
        }
      }
      if(type===2)fish(p,x,y,front,blue);
      if(type===3) {
        ball(p,gold,x,y,front,.20,.16,.05);
        for(const side of[-1,1]) {
          box(p,dark,x+side*.12,y+.015,front+.055,.025,.18,.025);
          ball(p,gold,x+side*.14,y+.15,front,.07,.075,.04);
          ball(p,dark,x+side*.075,y+.04,front+.06,.024,.024,.015);
        }
        ball(p,cream,x,y-.05,front+.05,.075,.055,.025);
      }
      if(type===4) {ball(p,cream,x,y-.04,front,.18,.16,.055);ball(p,red,x+.10,y+.16,front,.08,.10,.05);}
      if(type===5) {fish(p,x,y,front,red);beam(p,gold,[x-.16,y+.06,front],[x-.28,y+.23,front],.020);}
      stats.fairSymbols++;
    }
    function stall(site,index) {
      const g=new THREE.Group();g.name=`fair:${site.id}`;source.add(g);
      // +Z points toward the visitor and the default camera, on the south court.
      const w=site.w,d=site.d;
      box(g,bamboo,0,.12,0,w-.20,.24,d-.20);
      for(const x of[-w*.43,w*.43])for(const z of[-d*.40,d*.40]) {
        cyl(g,wood,x,1.65,z,.09,3.06);
        box(g,gold,x,.35,z,.20,.12,.20);
        beam(g,bamboo,[x,2.55,z],[x-Math.sign(x)*.40,3.10,z],.035);
      }
      for(const z of[-d*.40,d*.40])beam(g,wood,[-w*.43,3.12,z],[w*.43,3.12,z],.07);
      // Shallow swept textile shelter, banded rather than a flat plastic slab.
      for(let panel=0;panel<7;panel++) {
        const x=(panel-3)*(w-.16)/7,y=3.33+.40*Math.cos(x/(w/2)*Math.PI/2);
        const sheet=box(g,panel%2?paleCanvas:canopyMaterials[index],x,y,0,(w-.16)/7+.015,.065,d-.10);
        sheet.rotation.z=-Math.sin(x/(w/2)*Math.PI/2)*.19;
      }
      for(let i=0;i<9;i++) {
        const x=(i-4)*w*.095;
        ball(g,canopyMaterials[index],x,3.24,d*.455,w*.062,.17,.045);
        const flag=mesh(g,triangle,papers[(i+index)%3],x,2.56-Math.sin(i*Math.PI/8)*.12,d*.41);
        flag.rotation.y=(i%2?1:-1)*.08;
      }
      beam(g,bamboo,[-w*.41,2.56,d*.41],[w*.41,2.56,d*.41],.018);
      for(const side of[-1,1])lantern(g,side*w*.36,2.78,d*.40,.19);
      lantern(g,0,2.68,-d*.28,.16);
      sign(g,site,d*.43);
      box(g,wood,0,.73,d*.32,w*.82,1.05,.42);
      box(g,bamboo,0,1.30,d*.32,w*.87,.13,.56);
      for(const x of[-w*.31,w*.31])box(g,gold,x,.85,d*.32+.22,.045,.62,.035);
      if(site.id==='balloons') {
        box(g,wood,0,1.82,-d*.32,w*.84,2.50,.18);
        box(g,green,0,1.87,-d*.32+.11,w*.77,2.29,.035);
        for(let row=0;row<3;row++)for(let col=0;col<5;col++) {
          const x=(col-2)*.63,y=1.22+row*.59,z=-d*.32+.27;
          ball(g,colors[(row+col)%5],x,y,z,.225,.27,.17);
          beam(g,cream,[x,y-.26,z],[x+.04,y-.36,z],.014);stats.fairBalloons++;
        }
        for(let i=0;i<3;i++)beam(g,dark,[-.54+i*.22,1.40,d*.32],[ -.47+i*.22,1.40,d*.32+.17],.025);
      }else if(site.id==='dolls') {
        box(g,blue,0,1.85,-d*.34,w*.81,2.33,.14);
        for(let row=0;row<2;row++) {
          box(g,bamboo,0,.62+row*1.05,-d*.25,w*.83,.11,.49);
          for(let i=0;i<4;i++)doll(g,(i-1.5)*.83,.69+row*1.05,-d*.25,i%2?'rabbit':'bear',i%2?cream:colors[(i+row)%5]);
        }
        // Readable wooden toy dart rifle laid safely on the counter.
        box(g,wood,.12,1.43,d*.31,.74,.11,.13);box(g,dark,-.42,1.45,d*.31,.48,.07,.07);
      }else {
        box(g,red,0,1.96,-d*.32,w*.80,2.15,.12);
        for(let row=0;row<2;row++)for(let col=0;col<3;col++)icon(g,(col-1)*1.05,1.40+row*.87,-d*.32+.13,row*3+col);
        // Six broad betting cells and a ceramic shaker are a different play
        // surface from either target booth, visible from the tilted camera.
        for(let row=0;row<2;row++)for(let col=0;col<3;col++)box(g,colors[(row*3+col)%5],(col-1)*.48,1.38,d*.32+(row-.5)*.19,.44,.022,.17);
        cyl(g,cream,w*.30,1.49,d*.32,.20,.27);cyl(g,gold,w*.30,1.65,d*.32,.23,.06);
      }
      // A small woven side basket carries prizes, never a street obstacle.
      cyl(g,bamboo,-w*.34,.52,-d*.02,.28,.57);
      const rim=mesh(g,ring,gold,-w*.34,.82,-d*.02,.28);rim.rotation.x=Math.PI/2;
      g.rotation.y=site.approach.z<site.z?Math.PI:0;
      g.position.set(site.x,0,site.z);g.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(g);
      if(bounds.min.x<site.x-w/2-.001||bounds.max.x>site.x+w/2+.001||bounds.min.z<site.z-d/2-.001||bounds.max.z>site.z+d/2+.001)throw new Error(`Fair stall ${site.id} exceeds reservation`);
      stats.fairBounds[site.id]={min:bounds.min.toArray(),max:bounds.max.toArray()};stats.fairStalls++;
    }
    sites.forEach(stall);source.updateMatrixWorld(true);
    source.traverse(o=>{if(o.isMesh)stats.fairSourceMeshes++;});
    if(batch) {
      const buckets=new Map();
      source.traverse(o=>{
        if(!o.isMesh)return;
        const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
        if(!g.attributes.normal)g.computeVertexNormals();
        if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
        for(const key of Object.keys(g.attributes))if(!['position','normal','uv'].includes(key))g.deleteAttribute(key);
        g.applyMatrix4(o.matrixWorld);if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(g);
      });
      try {
        for(const [material,parts]of buckets) {
          const merged=mergeGeometries(parts,false);if(!merged)throw new Error('Temple fair material batch failed');
          const g=geo(merged);g.computeBoundingSphere();const o=new THREE.Mesh(g,material);o.castShadow=o.receiveShadow=true;root.add(o);stats.fairDrawCalls++;
        }
      }finally{for(const parts of buckets.values())for(const g of parts)g.dispose();}
    }else {root.add(source);stats.fairDrawCalls=stats.fairSourceMeshes;}
    const setPhase=(value,strength)=>{
      if(disposed)return false;
      const open=fairIsOpen(value);root.userData.fairOpen=open;
      const normalized=((value%24)+24)%24;
      const light=Number.isFinite(strength)?THREE.MathUtils.clamp(strength,0,1):normalized>=18||normalized<5?1:.45;
      if(!M?.lantern)glow.emissiveIntensity=open?1.65*light:0;return open;
    };
    setPhase(hour,nightStrength);parent?.add(root);
    return {root,stats,setPhase,
      update(_t,_dt,_focus,env){if(Number.isFinite(env?.hour))setPhase(env.hour,env.lantern??env.night);},dispose};
  }catch(error){dispose();throw error;}
}
