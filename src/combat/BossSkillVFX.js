import * as THREE from 'three';
import { inBossSkill } from './bossSkills.js';

// Presentation only. Neither these ornaments nor their clock can cause damage.
// Broad Thai-inspired motifs remain secondary to the red fill / gold hit boundary.
export const BOSS_ART = Object.freeze({
  buffalo: { motif: 'earth', color: '#c7a26c', accent: '#e8ce9b', effects: ['horn', 'earth'] },
  takian: { motif: 'leaf', color: '#75a078', accent: '#d7d6a1', effects: ['root', 'leaf'] },
  pusom: { motif: 'seal', color: '#c5ab61', accent: '#f0db9c', effects: ['seal', 'seal'] },
  chalawan: { motif: 'wave', color: '#7eb2b4', accent: '#c6e0cd', effects: ['fang', 'wave'] },
  bamboo_grave_3: { motif: 'bamboo', color: '#a0ad7c', accent: '#e8d4a4', effects: ['bamboo', 'seal'] },
  sealed_mine_3: { motif: 'earth', color: '#b19e8a', accent: '#e7c482', effects: ['earth', 'stone'] },
  sunken_city_3: { motif: 'scale', color: '#6ea99d', accent: '#e8d396', effects: ['wave', 'wave'] },
  dusk_fort_3: { motif: 'flame', color: '#d88b62', accent: '#efd09a', effects: ['blade', 'flame'] },
  giant_valley_3: { motif: 'earth', color: '#baa173', accent: '#edd69e', effects: ['earth', 'stone'] },
  himmapan_3: { motif: 'feather', color: '#94bbca', accent: '#e3d3a7', effects: ['feather', 'feather'] },
  fallen_city_3: { motif: 'blade', color: '#95aebb', accent: '#e3cf96', effects: ['blade', 'seal'] },
  demon_rift_3: { motif: 'shard', color: '#b699c4', accent: '#e9c69d', effects: ['shard', 'shard'] },
});

const MOTIFS = {
  earth: [[[-.6,-.5],[-.12,-.18],[.02,.1],[.5,.5]], [[-.12,-.18],[.4,-.3]], [[.02,.1],[-.4,.4]]],
  leaf: [[[0,-.6],[-.35,-.2],[-.35,.2],[0,.65],[.35,.2],[.35,-.2],[0,-.6]], [[0,-.4],[0,.4]]],
  seal: [[[0,-.55],[-.55,0],[0,.55],[.55,0],[0,-.55]], [[-.25,0],[.25,0]], [[0,-.25],[0,.25]]],
  wave: [-.3,0,.3].map(z=>Array.from({length:9},(_,i)=>{const x=i*.15-.6;return [x,z+Math.sin(i/8*Math.PI*2)*.12];})),
  bamboo: [[[-.18,-.6],[-.18,.6]], [[.18,-.6],[.18,.6]], ...[-.3,.3].map(z=>[[-.26,z],[.26,z]])],
  scale: [[[0,-.6],[-.4,0],[0,.6],[.4,0],[0,-.6]], [[-.2,-.1],[0,.2],[.2,-.1]]],
  flame: [[[-.3,.55],[-.4,.08],[-.1,-.25],[.04,-.65],[.4,-.15],[.3,.55]], [[-.3,.55],[0,.15],[.3,.55]]],
  feather: [[[0,-.6],[-.28,-.3],[-.3,.2],[0,.6],[.3,.2],[.28,-.3],[0,-.6]], [[0,-.45],[0,.45]], [[-.25,0],[0,.18],[.25,0]]],
  blade: [[[0,-.7],[-.17,.18],[0,.45],[.17,.18],[0,-.7]], [[-.3,.24],[.3,.24]], [[0,.45],[0,.65]]],
  shard: [[[-.35,.45],[.05,-.65],[.35,.12],[-.35,.45]], [[-.5,-.25],[.3,-.5],[.5,.4]]],
};

// Every ground anchor is strictly inside the authoritative footprint. Ring
// ornaments leave the actual safe centre empty, even on sloped terrain.
function anchors(cast, count) {
  const out=[], cone=cast.shape==='cone', start=cone?cast.facing-cast.angle*.36:0;
  const sweep=cone?cast.angle*.72:Math.PI*2;
  const inner=cast.shape==='ring'?cast.innerRadius:0;
  for(let i=0;i<count;i++) {
    const angle=start+sweep*(cone?(i+.5)/count:i/count);
    const radius=inner+(cast.radius-inner)*(i%2?.7:.45);
    const x=cast.x+Math.sin(angle)*radius,z=cast.z+Math.cos(angle)*radius;
    out.push({x,z,angle,radius});
  }
  return out;
}

function linework(cast, art, heightAt, points) {
  const positions=[], size=Math.min(.72,(cast.radius-(cast.innerRadius??0))*.18);
  const append=(a,b)=>{
    if(!inBossSkill(cast,{x:a[0],z:a[1]})||!inBossSkill(cast,{x:b[0],z:b[1]}))return;
    // Segment midpoint catches a line crossing a ring's safe hole.
    if(!inBossSkill(cast,{x:(a[0]+b[0])/2,z:(a[1]+b[1])/2}))return;
    for(const [x,z] of [a,b])positions.push(x,heightAt(x,z)+.155,z);
  };
  for(const p of points.slice(0,8))for(const path of MOTIFS[art.motif]) {
    const transformed=path.map(([x,z])=>[p.x+(x*Math.cos(p.angle)+z*Math.sin(p.angle))*size,p.z+(-x*Math.sin(p.angle)+z*Math.cos(p.angle))*size]);
    for(let i=1;i<transformed.length;i++)append(transformed[i-1],transformed[i]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const m=new THREE.LineBasicMaterial({color:art.accent,transparent:true,opacity:.65,depthWrite:false});
  const lines=new THREE.LineSegments(g,m);lines.renderOrder=5;return lines;
}

function leafGeometry() {
  const s=new THREE.Shape();s.moveTo(0,-.5);s.quadraticCurveTo(-.3,-.2,0,.5);s.quadraticCurveTo(.3,-.2,0,-.5);
  return new THREE.ShapeGeometry(s,5);
}

function effectGeometry(effect) {
  if(effect==='root'||effect==='fang'||effect==='bamboo'||effect==='horn')return new THREE.ConeGeometry(effect==='bamboo'?.08:.14,1,6);
  if(effect==='stone'||effect==='earth'||effect==='shard')return new THREE.DodecahedronGeometry(.22,0);
  if(effect==='feather'||effect==='leaf'||effect==='flame')return leafGeometry();
  if(effect==='blade')return new THREE.BoxGeometry(.04,.25,1.1);
  // A little rising diamond is an abstract ritual marker, not pseudo writing.
  return new THREE.OctahedronGeometry(.18,0);
}

function waveGeometry(cast,heightAt) {
  const positions=[],indices=[],cone=cast.shape==='cone';
  const start=cone?cast.facing-cast.angle/2+.01:0,sweep=cone?cast.angle-.02:Math.PI*2;
  const inner=cast.shape==='ring'?cast.innerRadius:0;
  for(let ring=0;ring<3;ring++) {
    const radius=inner+(cast.radius-inner)*(.34+ring*.22),width=Math.min(.17,(cast.radius-inner)*.06);
    const base=positions.length/3;
    for(let i=0;i<=40;i++)for(const delta of [-width,width]) {
      const a=start+sweep*i/40,r=radius+delta,x=cast.x+Math.sin(a)*r,z=cast.z+Math.cos(a)*r;
      positions.push(x,heightAt(x,z)+.18,z);
    }
    for(let i=0;i<40;i++){const n=base+i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);return g;
}

export function makeBossSkillVFX(type, cast, stage, heightAt) {
  const art=BOSS_ART[type];if(!art)return null;
  const group=new THREE.Group();group.name='boss-skill-detail';group.userData.bossType=type;
  const effect=art.effects[cast.id===({buffalo:'horn',takian:'roots',pusom:'seal',chalawan:'jaw',bamboo_grave_3:'grave',sealed_mine_3:'hammer',sunken_city_3:'breath',dusk_fort_3:'blade',giant_valley_3:'club',himmapan_3:'feathers',fallen_city_3:'command',demon_rift_3:'rupture'}[type])?0:1];
  group.userData.effect=effect;
  const points=anchors(cast,stage==='windup'?8:16),ink=linework(cast,art,heightAt,points);group.add(ink);
  if(stage==='windup') {
    group.userData.update=k=>{ink.material.opacity=.4+k*.35;};
    return group;
  }
  const material=new THREE.MeshBasicMaterial({color:art.color,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});
  let mesh,update;
  if(effect==='wave') {
    mesh=new THREE.Mesh(waveGeometry(cast,heightAt),material);mesh.renderOrder=5;group.add(mesh);
    // Waves rise vertically: their XZ silhouette never swells outside the warning.
    update=k=>{mesh.position.y=Math.sin(k*Math.PI)*.45;};
  } else {
    mesh=new THREE.InstancedMesh(effectGeometry(effect),material,points.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.renderOrder=5;group.add(mesh);
    const transform=new THREE.Object3D();
    update=k=>{
      for(let i=0;i<points.length;i++) {
        const p=points[i],growth=Math.sin(k*Math.PI),plant=effect==='root'||effect==='fang'||effect==='bamboo';
        const lift=plant?growth*.48:.15+growth*(effect==='stone'?1.3:.65);
        transform.position.set(p.x,heightAt(p.x,p.z)+lift,p.z);
        transform.rotation.set(effect==='leaf'||effect==='feather'?-Math.PI/3:effect==='blade'?Math.PI/2:0,p.angle+k*(plant?0:.5),effect==='flame'?.2:0);
        transform.scale.set(effect==='bamboo'?1.5:1,plant?Math.max(.01,growth)*(effect==='bamboo'?1.35:1):.6+growth,1);
        transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    };
  }
  group.userData.anchors=points.map(p=>({x:p.x,z:p.z}));
  group.userData.update=k=>{update(k);material.opacity=.8*(1-k);ink.material.opacity=.75*(1-k);};
  group.userData.update(0);
  return group;
}
