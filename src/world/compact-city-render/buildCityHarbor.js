import * as THREE from 'three';

// Render-only closed berths. Main owns collision, resource disposal and motion.
// All offshore uprights start beyond z=64.65; land cargo uses existing lots.
export async function buildCityHarbor({ root, staticRoot, ownRoot, mat, geo,
  box, cyl, beam, ball, ground, lanternAt, pot, crate, kitRoof, roofM, M, assemble }) {
  const harbor = new THREE.Group(); harbor.name = 'city-harbor-quay'; staticRoot.add(harbor);
  const boats = [];
  const stats = { harborBoats: 0, harborBoatBatches: 0, harborPiers: 2,
    harborSalas: 1, harborCranes: 1, harborNets: 2, harborBollards: 8,
    harborSalaPilings: 4, harborConnectors: 1, harborSourceMeshes: 0 };
  const rope = mat('#ae956e', { roughness: 1 });
  const sail = mat('#c8b58e', { roughness: .95, side: THREE.DoubleSide });
  // Ground decoration remains a flat apron through the boatman's contact.
  ground(M.rim, 0, .073, 59, 30, .002, 10);
  for (let row = 0; row < 12; row++) for(let i=0;i<6;i++)
    ground(M.path, -12.5+i*5, .076, 54.4+row*.8, 4.93, .002, .74);

  // Layered dressed-stone revetment: the face drops into the water, not a wall
  // on the walkable quay. Unequal seams keep a broad authored masonry rhythm.
  box(harbor, M.brick, 0, -.75, 65.10, 144, 1.35, .90);
  for (let i = 0; i < 36; i++) {
    const x = -70 + i * 4;
    box(harbor, i % 3 ? M.rim : M.cream, x, -.13, 65.08, 3.94, .32, .84);
    box(harbor, M.timber, x + .7, -.76, 65.61, 2.8, .21, .13);
  }
  function pier(x, z, width, depth) {
    box(harbor, M.wood, x, -.20, z, width, .30, depth);
    for (let dz = -depth / 2 + .24; dz < depth / 2; dz += .48)
      box(harbor, M.timber, x, -.035, z + dz, width - .10, .045, .43);
    for (const side of [-1, 1]) {
      const px = x + side * (width / 2 - .25);
      for (const dz of [-depth / 2 + .6, 0, depth / 2 - .6]) {
        cyl(harbor, M.wood, px, -.72, z + dz, .24, 2.3);
        cyl(harbor, M.dark, px, .43, z + dz, .27, .14);
        beam(harbor, M.wood, [px, -1.45, z + dz], [x, -.22, z + dz], .13);
      }
      box(harbor, M.wood, px, -.31, z, .25, .27, depth);
    }
  }
  pier(0, 69.7, 8, 9.0); pier(-28, 72, 5.2, 13);
  // Low gate visibly closes the scenic deck without hiding the water beyond.
  const gate = new THREE.Group(); gate.name = 'city-harbor-closed-berths'; harbor.add(gate);
  for (const x of [-5.8, 0, 5.8]) {
    cyl(gate, M.wood, x, .47, 65.02, .16, 1.16);
    cyl(gate, M.gold, x, 1.07, 65.02, .20, .09);
  }
  for (const y of [.38, .81]) box(gate, M.wood, 0, y, 65.02, 11.6, .11, .12);
  for (const x of [-2.8, 2.8]) beam(gate, M.wood, [x - 2.4, .28, 65.02], [x + 2.4, .90, 65.02], .05);
  box(gate, M.cream, 0, .62, 64.92, .75, .44, .06);
  for (const x of [-30.1, -25.9]) cyl(gate, M.wood, x, .5, 65.90, .16, 1.15);
  beam(gate, rope, [-30.1, .85, 65.9], [-25.9, .85, 65.9], .045);

  function bollard(x, z) {
    cyl(harbor, M.dark, x, .28, z, .23, .64);
    box(harbor, M.dark, x, .59, z, .74, .16, .24);
    cyl(harbor, rope, x, .43, z, .27, .13);
  }
  for (const [x, z] of [[-3.7,67],[3.7,67],[-3.7,73],[3.7,73],[-25.7,68],[-25.7,76],[-30.3,68],[-30.3,76]]) bollard(x, z);
  function line(a, b) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a),
      new THREE.Vector3((a[0]+b[0])/2, Math.min(a[1],b[1])-.16, (a[2]+b[2])/2), new THREE.Vector3(...b));
    const mesh = new THREE.Mesh(geo(new THREE.TubeGeometry(curve, 12, .035, 5, false)), rope);
    mesh.castShadow = true; harbor.add(mesh);
  }
  line([-3.7,.55,67],[-8.5,.34,67]); line([-3.7,.55,73],[-8.5,.34,73]);
  line([-25.7,.55,69],[-22.3,.60,70]); line([-25.7,.55,76],[-22.3,.60,79]);

  // Waiting sala is deliberately offset, keeping x=0's view to the river open.
  const sala = new THREE.Group(); sala.name = 'city-harbor-waiting-sala'; sala.position.set(24,0,72); harbor.add(sala);
  box(sala, M.brick, 0, .04, 0, 8.4, .36, 7.8);
  box(sala, M.timber, 0, .25, 0, 8.0, .09, 7.4);
  for(const x of [-3.3,3.3])for(const z of [-2.8,2.8]) {
    cyl(sala,M.wood,x,-1.10,z,.25,2.60);
    beam(sala,M.wood,[x,-1.7,z],[x-Math.sign(x)*1.1,-.05,z],.13);
    beam(sala,M.wood,[x,-1.7,z],[x,-.05,z-Math.sign(z)*1.0],.13);
  }
  box(harbor,M.wood,24,.03,66.8,2.8,.30,3.2);
  for(let i=0;i<7;i++)box(harbor,M.timber,24,.205,65.43+i*.46,2.7,.05,.41);
  for(const x of [22.9,25.1])for(const z of [65.7,67.8]) {
    cyl(harbor,M.wood,x,-1.0,z,.18,2.4);
    beam(harbor,M.wood,[x,-1.6,z],[24,.03,z],.09);
  }
  for(const x of [22.5,25.5])cyl(harbor,M.wood,x,.55,65.4,.15,1.2);
  beam(harbor,rope,[22.5,.91,65.4],[25.5,.91,65.4],.035);
  for (const x of [-3.3,3.3]) for (const z of [-2.8,2.8]) {
    cyl(sala, M.wood, x, 2.07, z, .19, 3.6);
    cyl(sala, M.gold, x, .60, z, .24, .18);
    for (const dx of [-.6,.6]) beam(sala, roofM.wood, [x,2.95,z], [x+dx,3.65,z], .09);
  }
  kitRoof(sala, { width: 10.8, depth: 9.0, y: 3.7, height: 2.5, pattern: 'panel' }, M.roof);
  for (const side of [-1,1]) {
    box(sala, M.wood, side*2.9,.85,0,.60,.15,4.1);
    for (const z of [-1.6,1.6]) box(sala,M.wood,side*2.9,.54,z,.20,.58,.22);
    lanternAt(sala,side*2.8,3.1,-2.6,.21,.48);
    pot(sala,side*3.4,.28,2.6,.9,true);
  }

  // Timber cargo derrick with a real winch drum and pulley, well left of the
  // arrival sightline. Rigging is a few tubes, not alpha net cards.
  const crane = new THREE.Group(); crane.name = 'city-harbor-cargo-crane'; crane.position.set(-31,0,69); harbor.add(crane);
  box(crane,M.wood,0,2.2,0,.45,4.7,.45);
  for (const side of [-1,1]) beam(crane,M.wood,[side*1.1,.02,0],[0,2.7,0],.14);
  beam(crane,M.timber,[0,4.4,0],[4.2,5.5,0],.20);
  beam(crane,rope,[0,4.55,.2],[3.9,5.55,.2],.038);
  beam(crane,rope,[3.9,5.55,.2],[3.9,1.3,.2],.035);
  const pulley = cyl(crane,M.dark,3.9,5.45,.2,.24,.12); pulley.rotation.x = Math.PI/2;
  const drum = cyl(crane,M.wood,.35,1.1,.15,.35,.95); drum.rotation.z = Math.PI/2;
  beam(crane,M.gold,[-.4,1.1,.15],[-.4,1.7,.15],.055);
  crate(crane,3.9,.12,.2,.85);

  function net(parent, x, z, width, height) {
    for (const side of [-1,1]) beam(parent,M.wood,[x+side*width/2,.08,z],[x+side*width/2,height+.35,z],.07);
    beam(parent,rope,[x-width/2,height,z],[x+width/2,height,z],.028);
    for (let i=0;i<=6;i++) {
      const px=x-width/2+i*width/6;
      beam(parent,rope,[px,height,z],[px+.10,.23,z+.25],.014);
    }
    for (let i=0;i<=4;i++) {
      const y=.25+i*(height-.25)/4;
      beam(parent,rope,[x-width/2,y,z+.25*(1-y/height)],[x+width/2,y,z+.25*(1-y/height)],.014);
    }
  }
  net(harbor,29,68.6,3.5,1.7);
  // Only these existing solid warehouse/fishmarket footprints receive land props.
  const cargo = new THREE.Group(); cargo.name = 'city-harbor-warehouse-cargo'; harbor.add(cargo);
  for (let i=0;i<5;i++) crate(cargo,-33+i*.95,.02,44.7, .8);
  for (let i=0;i<3;i++) crate(cargo,-32.5+i*1.2,.74,44.8,.7);
  pot(cargo,-34,.02,42.5,1.1); pot(cargo,-32.8,.02,42.5,.8);
  net(cargo,27,43,3,1.6);

  function skin(parent, material, rows, uvScale = 1, outward = false) {
    const vertices=[],uv=[],indices=[];
    for (let i=0;i<rows.length;i++) for (let j=0;j<rows[i].length;j++) {
      vertices.push(...rows[i][j]); uv.push(i/(rows.length-1)*uvScale,j/(rows[i].length-1));
    }
    const across=rows[0].length;
    for(let i=0;i<rows.length-1;i++)for(let j=0;j<across-1;j++) {
      const n=i*across+j; indices.push(n,n+across,n+1,n+1,n+across,n+across+1);
    }
    if(outward)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const geometry=geo(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  async function boat(x,z,length,width,junk) {
    const source=ownRoot(new THREE.Group());
    const stations=Array.from({length:21},(_,i)=>{
      const t=i/20, along=(t-.5)*length;
      return { z:along, half:width/2*(.06+.94*Math.pow(Math.sin(Math.PI*t),.68)),
        rise:Math.pow(Math.abs(2*t-1),4)*(junk?.65:.42) };
    });
    const section=[[-1,.92],[-.87,.42],[-.45,.04],[0,-.13],[.45,.04],[.87,.42],[1,.92]];
    // Separate planked strips preserve contrasting timbers and UVs. No scaled
    // ellipsoid hull, cuboid gunwale or rectangular sail silhouette.
    for(let j=0;j<section.length-1;j++) skin(source,j%2?M.wood:M.timber,
      stations.map(s=>[section[j],section[j+1]].map(([u,v])=>[u*s.half,v+s.rise,s.z])),8,true);
    for(const end of [stations[0],stations.at(-1)]) skin(source,M.wood,
      [[[-end.half,.92+end.rise,end.z],[end.half,.92+end.rise,end.z]],
        [[0,-.13+end.rise,end.z],[0,-.13+end.rise,end.z]]],1,end.z<0);
    for(const side of [-1,1])for(let i=0;i<20;i++) {
      const a=stations[i],b=stations[i+1];
      beam(source,M.dark,[side*a.half,.94+a.rise,a.z],[side*b.half,.94+b.rise,b.z],.075);
      if(i%3===0)beam(source,M.wood,[side*a.half*.85,.44+a.rise,a.z],[side*a.half,.91+a.rise,a.z],.045);
    }
    // Curved deck follows hull width, with readable transverse plank seams.
    skin(source,M.timber,stations.map(s=>[[-s.half*.86,.70+s.rise*.3,s.z],[s.half*.86,.70+s.rise*.3,s.z]]),9);
    for(let i=2;i<19;i++) {
      const s=stations[i];beam(source,M.wood,[-s.half*.84,.72+s.rise*.3,s.z],[s.half*.84,.72+s.rise*.3,s.z],.018);
    }
    beam(source,M.wood,[0,.7,-length/2+.5],[0,1.9,-length/2-.25],.12);
    beam(source,M.gold,[0,1.4,-length/2],[0,1.92,-length/2-.25],.055);
    for(let i=0;i<(junk?6:3);i++)crate(source,-.65+(i%2)*1.25,.73,-1.5+Math.floor(i/2)*1.2,junk?.95:.65);
    pot(source,junk?1.2:.65,.73,1.8,.7);
    if(junk) {
      const cabin=new THREE.Group();cabin.position.set(0,0,3.1);source.add(cabin);
      box(cabin,M.wood,0,1.18,0,3.1,.95,3.0);
      for(const side of [-1,1])box(cabin,M.dark,side*1.57,1.25,0,.035,.46,1.4);
      kitRoof(cabin,{width:3.8,depth:3.8,y:1.73,height:1.05,pattern:'panel'},M.roof);
      beam(source,M.wood,[0,.70,-1.9],[.12,8.4,-1.9],.13);
      const rows=[];
      for(let i=0;i<=8;i++) {
        const t=i/8, span=2.4+2.3*t,row=[];
        for(let j=0;j<=6;j++) {
          const u=j/6-.5;
          row.push([u*span+.20*t,3.05+t*4.55+.15*Math.cos(u*Math.PI*2),
            -1.65+.45*Math.sin((u+.5)*Math.PI)]);
        }
        rows.push(row);
      }
      skin(source,sail,rows,1);
      for(let i=0;i<rows.length;i+=2)for(let j=0;j<6;j++)beam(source,M.timber,rows[i][j],rows[i][j+1],.025);
      for(const side of [-1,1])beam(source,rope,[.12,8.2,-1.9],[side*2.1,.98,1.6],.023);
      lanternAt(source,0,1.5,5.2,.19,.43);
    } else {
      for(const z of [-2.2,2.0])beam(source,M.wood,[-.9,.9,z],[.9,.9,z],.055);
      beam(source,M.timber,[.8,.90,1.7],[1.9,.40,3.0],.055);
    }
    source.traverse(o=>{if(o.isMesh)stats.harborSourceMeshes++;});
    const group=ownRoot(new THREE.Group());
    await assemble(source,group); source.clear();
    group.name=junk?'city-moored-junk':'city-cargo-sampan';group.position.set(x,-.28,z);
    root.add(group);boats.push({group,phase:x*.13});stats.harborBoats++;stats.harborBoatBatches++;
  }
  harbor.traverse(o=>{if(o.isMesh)stats.harborSourceMeshes++;});
  await boat(-20,75,14,5.4,true);await boat(-10,70,8,2.6,false);
  // Bounds are observational; no collision or navigation data is generated.
  harbor.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(harbor);
  for(const {group}of boats){group.updateWorldMatrix(true,true);bounds.union(new THREE.Box3().setFromObject(group));}
  stats.harborBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
  return {boats,stats};
}
