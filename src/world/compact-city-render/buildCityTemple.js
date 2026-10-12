import * as THREE from 'three';
import { M as kitMaterials } from '../materials.js';
import { patchMaterial } from '../shaders.js';

// Original procedural sacred architecture. The caller owns high/low roots and
// all allocations, then spatially batches these sources with its existing LOD.
// No localKit fit is needed: terraces, naga stairs and roof ornaments are built
// in normalized reservations and keep their intended vertical grandeur.
export function buildCityTemple({
  b,high,low,mat,geo,box,cyl,beam,ball,kitRoof,roofM,M,
}) {
  if(!['temple','chedi'].includes(b.kind))throw new Error(`Unsupported sacred building: ${b.kind}`);
  const stone=mat('#e7dcc1',{roughness:.84});
  const sandstone=mat('#ba9d73',{roughness:.87});
  const gold=mat('#cba65d',{metalness:.25,roughness:.58});
  const lacquer=mat('#752c29',{roughness:.48});
  const recessedRed=mat('#491e20',{roughness:.68});
  const roofGold=mat('#d4b569',{metalness:.23,roughness:.59});patchMaterial(roofGold,{fade:true});
  const gableRed=mat('#783e38',{roughness:.85,map:M.wood.map});patchMaterial(gableRed,{fade:true});
  const geometryCache=new Map();
  const cached=(key,make)=>{if(!geometryCache.has(key))geometryCache.set(key,geo(make()));return geometryCache.get(key);};
  function mesh(p,g,m,x=0,y=0,z=0,s=1) {
    const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.setScalar(s);
    o.castShadow=true;o.receiveShadow=true;p.add(o);return o;
  }
  function lathe(p,profile,m,y,detail,key) {
    return mesh(p,cached(`${key}:${detail}`,()=>new THREE.LatheGeometry(profile.map(v=>new THREE.Vector2(...v)),detail?32:16)),m,0,y,0);
  }
  function flameGeometry() {
    return cached('kanok-flame',()=>{
      const s=new THREE.Shape();s.moveTo(-.12,0);s.quadraticCurveTo(-.37,.40,-.13,.83);
      s.quadraticCurveTo(.18,1.24,.08,1.85);s.quadraticCurveTo(.59,1.28,.40,.70);
      s.quadraticCurveTo(.29,.32,.12,0);s.closePath();
      return new THREE.ExtrudeGeometry(s,{depth:.075,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1});
    });
  }
  function curvedBeam(p,points,r,material,key,detail) {
    const geometry=cached(`${key}:${detail}`,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v))),detail?16:8,r,detail?6:4,false));
    return mesh(p,geometry,material);
  }
  function framedBay(p,x,y,z,width,height,ry=0,ceremonial=false) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=ry;p.add(g);
    box(g,M.dark,0,0,0,width+.26,height+.24,.09);
    box(g,ceremonial?lacquer:M.window,0,0,.065,width,height,.085);
    for(const side of[-1,1]) {
      box(g,gold,side*(width/2+.065),0,.13,.13,height+.27,.15);
      box(g,gold,0,side*(height/2+.065),.13,width+.27,.13,.15);
    }
    box(g,ceremonial?gold:M.wood,0,0,.15,.12,height,.12);
    if(ceremonial) {
      // Two lacquer leaves, each with broad recessed panels and selective
      // gilded rails. The red remains the dominant surface from gameplay.
      g.name='temple-lacquer-door';
      for(const side of[-1,1]) {
        const cx=side*width*.25;
        for(const cy of[-height*.27,height*.23]) {
          const pw=width*.36,ph=height*.34;
          box(g,recessedRed,cx,cy,.13,pw,ph,.055);
          for(const edge of[-1,1]) {
            box(g,gold,cx+edge*pw/2,cy,.18,.045,ph+.045,.045);
            box(g,gold,cx,cy+edge*ph/2,.18,pw,.045,.045);
          }
          const petal=mesh(g,flameGeometry(),gold,cx,cy-.29,.20,.30);
          ball(g,gold,cx,cy-.04,.24,.12,.15,.035);
          petal.rotation.z=side*.10;
        }
        box(g,gold,cx,-height*.01,.20,width*.37,.075,.06);
        ball(g,gold,side*.17,-.15,.24,.055,.10,.055);
      }
    }
    // Broad pediment above the opening, kept separate from the roof ornaments.
    const crest=mesh(g,flameGeometry(),gold,0,height/2+.10,.12,.33);crest.rotation.z=-.06;
  }
  function roofTier(p,{w,d,y,h,z,detail,tier}) {
    const roof=kitRoof(p,{width:w,depth:d,height:h,y,z,style:'temple',
      material:tier===1?kitMaterials.tileOrange:kitMaterials.tileGreen,
      trim:kitMaterials.gold,gable:kitMaterials.woodRed,pattern:detail?'sun':null,
      finials:false,trimR:detail?.10:.08});
    // Keep gables deep red behind the large gilded motif. Geometry remains the
    // existing kit's locally cloned roof/UV assembly, never its shared caches.
    roof.traverse(o=>{if(o.isMesh&&o.geometry.type==='ShapeGeometry')o.material=gableRed;});
    for(const end of[-1,1]) {
      const faceZ=z+end*(d/2+.06);
      const face=new THREE.Group();face.position.z=faceZ;face.rotation.y=end<0?Math.PI:0;p.add(face);
      // Tall chofa carries the upper silhouette; two curled hanghong tips sit
      // at the ends of the flared eave. The lower LOD retains these same masses.
      mesh(face,flameGeometry(),roofGold,0,y+h-.08,0,tier===2?1.03:.82);
      for(const side of[-1,1]) {
        const tip=mesh(face,flameGeometry(),roofGold,side*w*.49,y+h*.13,.015,.57);
        tip.rotation.z=-side*.57;
      }
      const count=detail?5:2;
      for(const side of[-1,1])for(let i=0;i<count;i++) {
        const t=.08+(i+1)*.25/(count+1),x=side*w*t;
        const top=t<=.19?h*(1-t/.19*.67):h*.33*(1-(t-.19)/.19);
        const feather=mesh(face,flameGeometry(),roofGold,x,y+top+.05,.035,detail?.31:.35);
        feather.rotation.z=-side*.48;
      }
      // One strong lotus/flame medallion per gable is readable at overview.
      const mid=y+h*.34;
      ball(face,roofGold,0,mid+.47,.07,.43,.50,.08);
      for(const side of[-1,0,1]) {
        const petal=mesh(face,flameGeometry(),roofGold,side*.52,mid-.05,.09,.62);
        petal.rotation.z=-side*.46;
      }
      if(detail)for(const side of[-1,1])beam(face,roofGold,[0,mid-.03,.13],[side*w*.19,y+h*.20,.13],.07);
    }
    box(p,roofGold,0,y+h+.035,z,.22,.15,d+.10);
  }
  function nagaStairs(p,detail) {
    const steps=detail?6:4;
    for(let i=0;i<steps;i++)box(p,stone,0,.15+1.28*(i+1)/2/steps,7.98-i*(2.75/steps),4.3,1.28*(i+1)/steps,2.75/steps+.04);
    box(p,stone,0,1.46,4.78,4.60,.18,1.22);
    for(const side of[-1,1]) {
      curvedBeam(p,[[side*2.42,.73,8.10],[side*2.42,1.10,7.25],[side*2.42,1.48,6.22],[side*2.42,1.94,5.08]],.15,gold,`naga:${side}`,detail);
      const head=new THREE.Group();head.position.set(side*2.42,.75,8.05);p.add(head);
      // Narrow upright serpent skull, tapered muzzle and pointed crown replace
      // the rounded green face / broad gold bill of the previous statue.
      ball(head,M.jade,0,.43,-.02,.18,.35,.23);
      const hood=mesh(head,flameGeometry(),gold,0,.45,-.18,.64);hood.rotation.z=side*.12;
      box(head,M.jade,0,.42,.22,.24,.20,.32);
      box(head,gold,0,.31,.23,.25,.045,.34);
      for(const eye of[-1,1]) {
        beam(head,gold,[eye*.17,.60,.02],[eye*.13,.56,.29],.035);
        if(detail)ball(head,M.dark,eye*.13,.52,.19,.032,.045,.035);
      }
      mesh(head,flameGeometry(),gold,0,.67,-.015,.24);
      box(p,sandstone,side*2.42,.32,8.05,.67,.35,.72);
    }
  }
  function ceremonialEntrance(p,detail) {
    const g=new THREE.Group();g.name='temple-ceremonial-entrance';p.add(g);
    // Close to the south boundary: the lower front pediment stays in the
    // abbot's zoom-2 crop while the tall roof mass remains a skyline landmark.
    for(const side of[-1,1]) {
      box(g,sandstone,side*2.89,.52,7.12,.80,.67,.80);
      box(g,stone,side*2.89,2.12,7.12,.49,2.68,.49);
      box(g,gold,side*2.89,3.23,7.12,.68,.17,.68);
      box(g,stone,side*2.89,3.42,7.12,.84,.22,.84);
      beam(g,gold,[side*2.89,2.74,7.12],[side*2.12,3.47,7.12],.09);
    }
    box(g,roofM.wood,0,3.48,7.12,6.32,.18,.25);
    const lower=kitRoof(g,{width:7.76,depth:2.24,height:1.43,y:3.21,z:7.30,
      style:'temple',material:kitMaterials.tileOrange,trim:kitMaterials.gold,
      gable:kitMaterials.woodRed,pattern:null,finials:false,trimR:.085});
    const upper=kitRoof(g,{width:6.35,depth:1.68,height:1.70,y:3.68,z:7.44,
      style:'temple',material:kitMaterials.tileGreen,trim:kitMaterials.gold,
      gable:kitMaterials.woodRed,pattern:detail?'sun':null,finials:false,trimR:.09});
    for(const roof of[lower,upper])roof.traverse(o=>{if(o.isMesh&&o.geometry.type==='ShapeGeometry')o.material=gableRed;});
    const motif=new THREE.Group();motif.name='temple-entry-front-gable';motif.position.z=8.36;g.add(motif);
    for(const side of[-1,0,1]) {
      const petal=mesh(motif,flameGeometry(),roofGold,side*.35,4.05,.02,.43);
      petal.rotation.z=-side*.43;
    }
    ball(motif,roofGold,0,4.39,.09,.27,.31,.055);
    mesh(motif,flameGeometry(),roofGold,0,5.10,.025,.24);
    for(const side of[-1,1]) {
      const curl=mesh(motif,flameGeometry(),roofGold,side*3.03,3.59,.015,.33);curl.rotation.z=-side*.61;
      beam(motif,roofGold,[0,4.02,.10],[side*1.33,3.96,.10],.055);
    }
  }
  function temple(p,detail) {
    // Wide stepped terrace fills the reservation and visually joins the galleries.
    box(p,M.brick,0,.22,0,19.3,.44,17.3);
    box(p,sandstone,0,.60,-.20,18.4,.35,16.3);
    box(p,stone,0,.92,-.43,17.7,.30,14.9);
    box(p,gold,0,1.085,-.43,17.85,.06,15.02);
    box(p,stone,0,1.25,-1.15,16.9,.26,12.5);
    box(p,stone,0,4.47,-1.40,10.7,6.12,9.5);
    box(p,sandstone,0,1.71,-1.4,10.95,.52,9.75);
    box(p,roofM.wood,0,7.54,-1.4,10.98,.20,9.72);
    // Front and rear framed doors plus tall bays along the side galleries.
    framedBay(p,0,3.17,3.41,1.82,3.04,0,true);
    // A restrained frame of pilasters and a dado articulates the broad front
    // plaster face without turning every wall into an ornamental surface.
    for(const side of[-1,1]) {
      box(p,sandstone,side*3.83,4.38,3.40,.30,5.64,.16);
      box(p,stone,side*3.83,6.99,3.47,.52,.20,.22);
      box(p,gold,side*3.83,1.96,3.47,.46,.12,.22);
      box(p,sandstone,side*2.81,2.11,3.43,3.49,.15,.16);
    }
    framedBay(p,0,3.17,-6.22,1.64,2.90,Math.PI);
    for(const side of[-1,1]) {
      const zs=detail?[-4.6,-1.9,.8]:[-3.8,.2];
      for(const z of zs)framedBay(p,side*5.43,3.64,z,1.19,2.12,side*Math.PI/2);
      const columns=detail?[-5.45,-2.47,.51,3.49]:[-5.45,.51,3.49];
      for(const z of columns) {
        box(p,sandstone,side*7.12,1.60,z,.65,.38,.65);
        box(p,stone,side*7.12,4.17,z,.39,4.82,.39);
        box(p,gold,side*7.12,6.25,z,.60,.19,.60);
        box(p,stone,side*7.12,6.46,z,.71,.20,.71);
        beam(p,gold,[side*7.12,5.54,z],[side*6.46,6.57,z],.09);
      }
      kitRoof(p,{width:3.24,depth:11.22,height:1.63,y:6.65,x:side*7.10,z:-1.35,
        material:kitMaterials.tileOrange,style:'temple',trim:kitMaterials.gold,
        gable:kitMaterials.woodRed,pattern:null,finials:false});
      // Low gallery parapets, open through the broad front stair approach.
      box(p,stone,side*8.38,1.68,-1.35,.25,.70,11.45);
      box(p,gold,side*8.38,2.08,-1.35,.30,.10,11.45);
    }
    nagaStairs(p,detail);
    ceremonialEntrance(p,detail);
    const tiers=[{w:16.75,d:13.10,y:7.79,h:5.55},{w:13.22,d:10.52,y:9.31,h:4.93},{w:9.72,d:8.08,y:10.90,h:4.34}];
    tiers.forEach((tier,i)=>roofTier(p,{...tier,z:-1.4,detail,tier:i}));
    // Four sema-like terrace markers frame the precinct at a readable scale.
    for(const x of[-8.33,8.33])for(const z of[-7.18,6.67]) {
      box(p,sandstone,x,1.18,z,.59,.43,.59);
      const marker=mesh(p,flameGeometry(),stone,x,1.38,z,.42);marker.rotation.y=z<0?Math.PI:0;
    }
  }
  function chedi(p,detail) {
    for(let i=0;i<3;i++) {
      const width=7.55-i*.69;
      box(p,i===0?M.brick:stone,0,.20+i*.36,0,width,.40,width);
      box(p,gold,0,.425+i*.36,0,width+.06,.06,width+.06);
    }
    lathe(p,[[0,0],[2.75,0],[2.75,.20],[2.54,.38],[2.53,.83],[2.34,1.05],[0,1.05]],stone,1.15,detail,'chedi-drum');
    // A clear Thai bell contour, tall harmika and stepped gold spire replace
    // the former squat egg-and-cone silhouette. Profiles match across LODs.
    lathe(p,[[0,0],[2.43,0],[2.59,.20],[2.53,.41],[2.22,.73],[2.03,1.48],[1.56,2.77],[.99,3.83],[.72,4.42],[0,4.42]],gold,2.15,detail,'chedi-bell');
    cyl(p,stone,0,2.42,0,2.48,.12);
    box(p,stone,0,7.02,0,1.45,.96,1.45);
    box(p,gold,0,7.54,0,1.68,.14,1.68);
    lathe(p,[[.98,0],[1.13,.13],[.98,.38],[.75,.74],[.36,3.34],[.21,4.0],[0,4.0]],gold,7.63,detail,'chedi-spire');
    const rings=detail?9:5;
    for(let i=0;i<rings;i++) {
      const t=i/(rings-1),r=1.02-.75*t;
      cyl(p,gold,0,8.04+t*3.43,0,r,detail?.10:.13);
    }
    lathe(p,[[.23,0],[.17,.55],[.095,1.49],[.025,2.65],[0,2.96]],gold,11.65,detail,'chedi-needle');
    ball(p,gold,0,14.64,0,.085,.12,.085);
    if(detail) {
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2,g=new THREE.Group();g.rotation.y=a;p.add(g);
        framedBay(g,0,1.72,2.71,.55,.63);
      }
    }
    for(const x of[-2.98,2.98])for(const z of[-2.98,2.98]) {
      cyl(p,stone,x,1.36,z,.31,.62);
      ball(p,gold,x,1.97,z,.28,.38,.28);
      const tip=mesh(p,flameGeometry(),gold,x,2.14,z,.33);tip.rotation.y=z<0?Math.PI:0;
    }
  }
  const stats={kind:b.kind,roofTiers:b.kind==='temple'?3:0,highMeshes:0,lowMeshes:0,highHeight:0,lowHeight:0,bounds:{}};
  for(const [target,detail,name]of[[high,true,'high'],[low,false,'low']]) {
    const g=new THREE.Group();g.name=`${b.id}:${name}`;target.add(g);
    if(b.kind==='temple')temple(g,detail);else chedi(g,detail);
    const base=b.kind==='temple'?[20,18]:[8,8];
    const sideways=b.front==='east'||b.front==='west';
    g.scale.set((sideways?b.d:b.w)/base[0],1,(sideways?b.w:b.d)/base[1]);
    g.position.set(b.x,0,b.z);g.rotation.y=({east:Math.PI/2,west:-Math.PI/2,north:Math.PI,south:0})[b.front]??0;
    g.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(g);
    if(bounds.min.x<b.x-b.w/2-.001||bounds.max.x>b.x+b.w/2+.001||bounds.min.z<b.z-b.d/2-.001||bounds.max.z>b.z+b.d/2+.001)throw new Error(`${b.id} ${name} exceeds its canonical footprint`);
    g.traverse(o=>{if(o.isMesh)stats[`${name}Meshes`]++;});
    stats[`${name}Height`]=bounds.max.y;stats.bounds[name]={min:bounds.min.toArray(),max:bounds.max.toArray()};
  }
  return stats;
}
