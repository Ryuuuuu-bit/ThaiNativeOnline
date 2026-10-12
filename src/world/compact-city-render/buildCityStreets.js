import * as THREE from 'three';
import { cityStreetSurfaceAt, CITY_STREETS } from '../compact-city-streets.js';
import { createRng } from '../rng.js';

// One small surface mesh per material, with world-aligned UVs. Intersections
// are classified once rather than stacking intersecting road/curb rectangles.
export function buildCityStreets({root,mat,geo,box,cyl,beam,lanternAt,M,authoredTextures,CITY}) {
  const rng=createRng(71629);
  function stoneTexture(brick=false) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');c.fillStyle=brick?'#baae9e':'#aeafa3';c.fillRect(0,0,256,256);
    for(let row=0;row<16;row++)for(let col=-1;col<9;col++) {
      const x=col*32+(row%2)*16,y=row*16;
      const shade=Math.floor(rng.range(210,241)),inset=brick?1.1:rng.range(1.2,2.4);
      c.fillStyle=`rgb(${shade},${shade-2},${shade-7})`;
      c.beginPath();c.moveTo(x+inset+2,y+1);c.lineTo(x+30,y+inset);
      c.lineTo(x+31-inset,y+13);c.lineTo(x+28,y+15-inset);
      c.lineTo(x+inset,y+14);c.closePath();c.fill();
      c.strokeStyle='#ffffff26';c.lineWidth=.8;c.beginPath();c.moveTo(x+4,y+3);c.lineTo(x+27,y+3);c.stroke();
      if(!brick&&(row+col)%7===0){c.strokeStyle='#868a7925';c.beginPath();c.moveTo(x+12,y+4);c.lineTo(x+15,y+8);c.lineTo(x+13,y+12);c.stroke();}
    }
    const texture=new THREE.CanvasTexture(canvas);authoredTextures.add(texture);
    texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    return texture;
  }
  const stones=stoneTexture(),bricks=stoneTexture(true);
  const surfaces={
    cobble:mat('#a29f90',{map:stones}),brick:mat('#b89e82',{map:bricks}),
    quay:mat('#9c9a87',{map:stones}),walk:mat('#cabc9b',{map:bricks}),
    court:mat('#d0bc95',{map:stones}),edge:mat('#b6aa90',{map:stones}),
    drain:mat('#77766b',{roughness:1}),
  };
  for(const m of Object.values(surfaces)){m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;}
  const buffers=Object.fromEntries(Object.keys(surfaces).map(k=>[k,{positions:[],uv:[]}]));
  const step=.5;
  function quad(kind,x,z,w,d) {
    const b=buffers[kind],x1=x+w,z1=z+d,y=.024;
    for(const [xx,zz] of [[x,z],[x,z1],[x1,z],[x1,z],[x,z1],[x1,z1]]) {
      b.positions.push(xx,y,zz);b.uv.push(xx/4,zz/4);
    }
  }
  for(let z=-63.5;z<64;z+=step) {
    let current=null,start=-71.5;
    for(let x=-71.5;x<=72;x+=step) {
      const kind=x<72?cityStreetSurfaceAt(x+step/2,z+step/2):null;
      if(kind!==current){if(current)quad(current,start,z,x-start,step);current=kind;start=x;}
    }
  }
  for(const [kind,b] of Object.entries(buffers)) {
    const geometry=geo(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,surfaces[kind]);mesh.receiveShadow=true;mesh.name=`city-street:${kind}`;root.add(mesh);
  }
  // Street names mount inside the four existing shop reservations. They are
  // signposts, not new NPC/service affordances, and introduce no path obstacles.
  const labels={forge:'ตรอกช่าง',pharmacy:'ตรอกสมุนไพร',general:'ถนนตลาดกลาง',storage:'ทางท่าน้ำ'};
  for(const b of CITY.buildings.filter(b=>labels[b.id])) {
    const side=b.front==='east'?1:-1,x=b.x+side*(b.w/2-.45),z=b.z+b.d/2-1.10;
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=side*Math.PI/2;root.add(group);
    cyl(group,M.wood,0,1.85,0,.085,3.4);
    box(group,M.dark,0,2.60,.03,1.8,.60,.13);box(group,M.gold,0,2.91,.02,1.90,.08,.18);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;
    const c=canvas.getContext('2d');c.fillStyle='#3b4c3e';c.fillRect(0,0,256,96);
    c.strokeStyle='#c8ad72';c.lineWidth=4;c.strokeRect(5,5,246,86);
    c.font='bold 29px "Noto Sans Thai", Tahoma, sans-serif';c.fillStyle='#f4e2ac';c.textAlign='center';c.textBaseline='middle';c.fillText(labels[b.id],128,49);
    const texture=new THREE.CanvasTexture(canvas);authoredTextures.add(texture);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(geo(new THREE.PlaneGeometry(1.70,.52)),mat('#ffffff',{map:texture}));
    sign.position.set(0,2.60,.103);group.add(sign);
    beam(group,M.wood,[0,3.45,0],[.50,3.45,0],.055);lanternAt(group,.50,3.22,0,.13,.32);
  }
  return {streets:CITY_STREETS.length,streetSurfaceMeshes:Object.keys(surfaces).length};
}
