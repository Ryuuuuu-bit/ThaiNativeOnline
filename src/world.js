import * as THREE from 'three';

// A fixed seed keeps terrain, collision and the minimap reproducible.
let seed = 481516;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + random() * (b - a);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const materials = {
  bark: mat('#65503a'), branch: mat('#7f6545'), brick: mat('#9f6547'), stone: mat('#aba58a'),
  sandstone: mat('#c6b78c'), wood: mat('#71523b'), darkWood: mat('#423a2c'), tile: mat('#a6653e'),
  roof: mat('#6b4331'), gold: mat('#c5a05d', { metalness: .25, roughness: .62 }), moss: mat('#647347'),
};
export const windUniforms = { uTime: { value: 0 }, uWind: { value: .45 } };
export const landmarks = [
  { x: -5.4, z: -7.4, radius: 2.5, name: 'เจดีย์เก่า', kind: 'chedi' },
  { x: 9, z: -7, radius: 2.6, name: 'ศาลาริมคลอง', kind: 'pavilion' },
  { x: -12, z: 6, radius: 1.5, name: 'ศาลเจ้าป่า', kind: 'shrine' },
];
export const obstacles = [];
export const treePositions = [];
const animations = [];
export function pathX(z) { return 1.25 * Math.sin(z * .18) + .9; }
export function riverX(z) { return 16.2 + Math.sin(z * .16) * 2; }
export function inWater(x, z) { return x > riverX(z) - 2.2; }
export function groundHeight(x, z) {
  const noise = .08 * Math.sin(x * .45) * Math.cos(z * .3) + .05 * Math.sin(z * .8);
  return inWater(x,z) ? -.42 + noise * .2 : noise;
}
function nearLandmark(x, z, padding = 0) { return landmarks.some(l => Math.hypot(x - l.x, z - l.z) < l.radius + padding); }

function mesh(geometry, material, parent, x = 0, y = 0, z = 0, scale) {
  const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(parent, material, x, y, z, sx, sy, sz) { return mesh(boxGeo, material, parent, x, y, z, [sx, sy, sz]); }
function cylinder(parent, material, x, y, z, top, bottom, height, segments = 12) {
  return mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material, parent, x, y, z);
}
function branchBetween(parent, from, to, radius) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(radius * .55, radius, d.length(), 7), materials.branch, parent);
  m.position.copy(a.add(b).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
}

function terrainTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#71805a'; ctx.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 58000; i++) {
    const shade = Math.floor(range(65, 128));
    ctx.fillStyle = `rgba(${shade + 16},${shade + 24},${Math.floor(shade * .66)},${range(.08, .3)})`;
    ctx.beginPath(); ctx.ellipse(range(0, 2048), range(0, 2048), range(1, 16), range(1, 7), random() * Math.PI, 0, Math.PI * 2); ctx.fill();
  }
  // Dirt meanders through the glade, with soft irregular edges and branch trails.
  const px = x => (x / 58 + .5) * 2048, pz = z => (z / 58 + .5) * 2048;
  const drawPath = (points, width) => {
    for (let layer = 0; layer < 6; layer++) {
      ctx.strokeStyle = ['#9b9c7040', '#b0a77c55', '#b5a97c66', '#c3b58b90', '#cdbd92', '#c9b88e'][layer];
      ctx.lineWidth = width + (5 - layer) * 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      points.forEach(([x, z], i) => i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z))); ctx.stroke();
    }
  };
  drawPath(Array.from({ length: 120 }, (_, i) => { const z = -29 + i * 58 / 119; return [pathX(z), z]; }), 100);
  drawPath([[pathX(-4), -4], [-2, -5], [-5.4, -7.4]], 60);
  drawPath([[pathX(-6), -6], [4, -6], [9, -7]], 53);
  drawPath([[pathX(7), 7], [-4, 7], [-9, 6], [-12, 6]], 44);
  for (let i = 0; i < 8500; i++) {
    const z = range(-29, 29), x = pathX(z) + range(-1.65, 1.65);
    ctx.fillStyle = random() > .5 ? '#6c60431f' : '#fff1c91f';
    ctx.fillRect(px(x), pz(z), range(1, 4), range(1, 3));
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
function makeTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(58, 58, 100, 100); geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const material = mat('#ffffff', { map: terrainTexture() });
  const ground = mesh(geometry, material, scene); ground.castShadow = false;
  return ground;
}

function windMaterial(material, amplitude, instanced = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = windUniforms.uTime; shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = `uniform float uTime; uniform float uWind;\n${shader.vertexShader}`;
    const worldPos = instanced ? '(instanceMatrix * vec4(position, 1.0)).xyz' : '(modelMatrix * vec4(position, 1.0)).xyz';
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 windPos = ${worldPos};
      float gust = sin(uTime * 1.35 + windPos.x * 0.32 + windPos.z * 0.24) + 0.4 * sin(uTime * 2.1 + windPos.z * 0.7);
      transformed.x += gust * uWind * ${amplitude.toFixed(3)} * ${instanced ? 'pow(max(position.y, 0.0), 1.5)' : '1.0'};
      transformed.z += cos(uTime + windPos.x * 0.4) * uWind * ${(amplitude * .4).toFixed(3)};
    `);
  };
  material.customProgramCacheKey = () => `wind-${amplitude}-${instanced}`;
  return material;
}

function makeGrass(scene) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.06, 0, 0, .06, 0, 0, -.038, .23, .01, .038, .23, .01, .035, .49, .04], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]); geometry.computeVertexNormals();
  const material = windMaterial(mat('#8b995a', { side: THREE.DoubleSide }), .5, true);
  const grass = new THREE.InstancedMesh(geometry, material, 24000);
  const dummy = new THREE.Object3D(), color = new THREE.Color(); let n = 0;
  for (let i = 0; i < 24000; i++) {
    const x = range(-27, 27), z = range(-27, 27);
    if (inWater(x, z) || Math.abs(x - pathX(z)) < 1.65 || nearLandmark(x, z, .65)) continue;
    // Keep side paths and the playable central glade readable.
    if (z > -8 && z < -5 && x > -7 && x < 11) continue;
    if (z > 5 && z < 7.5 && x > -13 && x < 2) continue;
    dummy.position.set(x, groundHeight(x, z), z); dummy.rotation.y = range(0, Math.PI * 2);
    const s = range(.45, 1.2); dummy.scale.set(s, s * range(.7, 1.5), s); dummy.updateMatrix(); grass.setMatrixAt(n, dummy.matrix);
    color.setHSL(range(.19, .25), range(.23, .38), range(.27, .47)); grass.setColorAt(n++, color);
  }
  grass.count = n; grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
  return grass;
}

function foliageTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 210; i++) {
    const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * 94;
    const x = 128 + Math.cos(angle) * r, y = 128 + Math.sin(angle) * r;
    const brightness = Math.floor(range(145, 235));
    ctx.save(); ctx.translate(x,y); ctx.rotate(range(-Math.PI,Math.PI));
    ctx.fillStyle = `rgb(${brightness},${Math.min(255,brightness+14)},${Math.floor(brightness*.75)})`;
    ctx.beginPath(); ctx.ellipse(0,0,range(8,17),range(4,9),0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#52673e40'; ctx.lineWidth=.7; ctx.beginPath(); ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.stroke();ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function makeTrees(scene) {
  const leafGeo = new THREE.PlaneGeometry(2.5, 2.5);
  // Clustered small crowns read as broadleaf trees rather than stacked cones.
  const leafMaterial = windMaterial(mat('#ffffff', { map: foliageTexture(), alphaTest:.45, side:THREE.DoubleSide }), .16, true);
  const foliage = new THREE.InstancedMesh(leafGeo, leafMaterial, 9000);
  foliage.castShadow = true; foliage.receiveShadow = true;
  const dummy = new THREE.Object3D(), color = new THREE.Color(); let count = 0;
  const positions = [
    [-11,-10],[-14,-4],[-12,1],[-15,10],[-10,12],[-8,17],[-16,17],[-17,-14],[-9,-16],[-2,-17],
    [5,-16],[11,-15],[13,-2],[10,3],[12,11],[7,15],[2,20],[-4,23],[-20,3],[-20,-6],[-20,12],
    [-21,-19],[-14,-23],[-5,-24],[4,-24],[12,-22],[22,-14],[23,0],[24,12],[-23,22],[13,23],
  ];
  for (let i = 0; i < 55; i++) {
    const x = range(-27, 26), z = range(-27, 27);
    if (Math.abs(x - pathX(z)) > 7 && !inWater(x, z) && !nearLandmark(x, z, 4) && Math.hypot(x, z) > 11) positions.push([x, z]);
  }
  positions.forEach(([x, z], index) => {
    const s = range(.8, 1.35), h = range(4.4, 6.2) * s, y = groundHeight(x, z);
    treePositions.push({ x, z, radius: 2 * s }); obstacles.push({ x, z, radius: .6 * s });
    const tree = new THREE.Group(); tree.position.set(x, y, z); scene.add(tree);
    const trunk = cylinder(tree, materials.bark, 0, h * .38, 0, .19 * s, .43 * s, h * .76, 8);
    trunk.rotation.z = range(-.07, .07);
    for (let root = 0; root < 5; root++) {
      const angle = root * Math.PI * .4 + random();
      branchBetween(tree, [Math.cos(angle) * .8 * s, .06, Math.sin(angle) * .8 * s], [0, .7 * s, 0], .16 * s);
    }
    for (let b = 0; b < 5; b++) {
      const angle = b / 5 * Math.PI * 2 + range(-.3, .3), reach = range(1.1, 2.1) * s;
      branchBetween(tree, [0, h * .47, 0], [Math.cos(angle) * reach, h * .8, Math.sin(angle) * reach], .12 * s);
    }
    for (let j = 0; j < 64; j++) {
      const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * 2.3 * s;
      dummy.position.set(x + Math.cos(angle) * r, y + h + range(-.9, .6) * s - r * .22, z + Math.sin(angle) * r);
      dummy.rotation.set(-.72 + range(-.12,.12), .60 + range(-.12,.12), range(-Math.PI,Math.PI));
      const size = range(.65, 1.15) * s; dummy.scale.set(size * 1.1, size, size); dummy.updateMatrix();
      foliage.setMatrixAt(count, dummy.matrix);
      color.setHSL(range(.22, .3), range(.17, .32), range(.24, .40) + (index % 3 === 0 ? .045 : 0)); foliage.setColorAt(count++, color);
    }
    animations.push({ object: tree, phase: random() * 6, strength: .012 });
  });
  foliage.count = count; scene.add(foliage);
  // Bamboo groves, native to the tropical setting.
  for (const [x, z] of [[-7, 3], [8, -13], [-15, -8], [11, 14]]) {
    const grove = new THREE.Group(); grove.position.set(x, 0, z); scene.add(grove);
    for (let b = 0; b < 7; b++) {
      const bx = range(-.6, .6), bz = range(-.6, .6), h = range(2.8, 4.2);
      cylinder(grove, mat('#788159'), bx, h / 2, bz, .045, .065, h, 5);
      for (let ring = .4; ring < h; ring += .48) cylinder(grove, materials.moss, bx, ring, bz, .073, .073, .035, 5);
      for (let j = 0; j < 9; j++) {
        dummy.position.set(x + bx + range(-.7, .7), h * .65 + range(0, h * .4), z + bz + range(-.7, .7));
        dummy.scale.set(.55, .13, .22); dummy.rotation.set(0, range(0, 6), range(-.8, .8)); dummy.updateMatrix();
        foliage.setMatrixAt(count, dummy.matrix); foliage.setColorAt(count++, new THREE.Color('#5d784c'));
      }
    }
    animations.push({ object: grove, phase: range(0, 6), strength: .022 });
  }
  foliage.count = count; foliage.instanceMatrix.needsUpdate = true;
}

function makeRocks(scene) {
  const geometry = new THREE.DodecahedronGeometry(1, 0), colors = ['#969888', '#a8aa92', '#838c7b'];
  for (let i = 0; i < 55; i++) {
    const x = range(-25, 14), z = range(-24, 25);
    if (Math.abs(x - pathX(z)) < 2 || nearLandmark(x, z, 2)) continue;
    const size = range(.3, 1.05);
    const rock = mesh(geometry, mat(colors[i % colors.length], { flatShading: true }), scene, x, size * .35, z, [size * 1.3, size * .7, size]);
    rock.rotation.set(range(-.3, .3), random() * 6, range(-.3, .3));
    obstacles.push({ x, z, radius: size * .9 });
    if (i % 3 === 0) mesh(geometry, materials.moss, scene, x - .12, size * .65, z, [size * .75, size * .12, size * .7]);
  }
}

function makeChedi(scene) {
  const group = new THREE.Group(); group.position.set(-5.4, .02, -7.4); scene.add(group);
  // Raised brick plinth, weathered terraces and a bell-shaped Ayutthaya-inspired stupa.
  box(group, materials.brick, 0, .2, 0, 4.8, .4, 4.8);
  box(group, materials.stone, 0, .48, 0, 4.2, .16, 4.2);
  box(group, materials.brick, 0, .73, 0, 3.75, .4, 3.75);
  box(group, materials.sandstone, 0, .99, 0, 3.85, .12, 3.85);
  cylinder(group, materials.sandstone, 0, 1.15, 0, 1.6, 1.8, .25, 32);
  const profile = [[0,1.23],[1.48,1.23],[1.5,1.35],[1.36,1.43],[1.25,1.52],[1.22,1.75],[1.13,2],[.92,2.38],[.7,2.72],[.53,2.85],[.48,2.95],[.45,3.05]];
  mesh(new THREE.LatheGeometry(profile.map(([x,y]) => new THREE.Vector2(x,y)), 32), materials.sandstone, group);
  box(group, materials.sandstone, 0, 3.15, 0, .7, .28, .7);
  for (let i = 0; i < 8; i++) cylinder(group, i % 2 ? materials.sandstone : materials.stone, 0, 3.4 + i * .15, 0, .37 - i * .037, .42 - i * .039, .15, 20);
  cylinder(group, materials.gold, 0, 4.95, 0, .012, .12, 1.05, 12);
  for (let i = 0; i < 5; i++) box(group, materials.brick, 0, .1 + i * .1, 2.6 - i * .16, 1.4, .2, .5);
  // Exposed joints and scattered fallen bricks.
  for (let i = 0; i < 45; i++) {
    const side = i % 4, a = range(-2.25, 2.25), y = i % 3 === 0 ? .12 : .3;
    const b = side < 2 ? box(group, materials.darkWood, a, y, side === 0 ? 2.405 : -2.405, .022, .12, .01) : box(group, materials.darkWood, side === 2 ? 2.405 : -2.405, y, a, .01, .12, .022);
    b.castShadow = false;
  }
  for (let i = 0; i < 22; i++) {
    const x = range(-3.5, 3.5), z = range(-3.5, 3.5); if (Math.abs(x) < 2.6 && Math.abs(z) < 2.6) continue;
    const brick = box(group, materials.brick, x, .08, z, .38, .17, .22); brick.rotation.y = random() * 6;
  }
  for (const [x,z] of [[-2.8,-1.5],[2.8,-1.5]]) {
    cylinder(group, materials.stone, x, .55, z, .22, .3, 1, 8);
    mesh(new THREE.SphereGeometry(.2, 8, 6), materials.sandstone, group, x, 1.2, z);
  }
  obstacles.push({ x: -5.4, z: -7.4, radius: 2.65 });
  return group;
}

function thaiRoof(parent, width, depth, y, material) {
  const vertices = [], indices = [];
  // Curving eaves and a steep ridge; cross-section is mirrored.
  const cross = [[-width/2,0.22],[-width*.38,0],[-width*.19,.55],[0,1.65],[width*.19,.55],[width*.38,0],[width/2,.22]];
  for (const z of [-depth/2, depth/2]) for (const [x,h] of cross) vertices.push(x,y+h,z);
  for(let i=0;i<6;i++) indices.push(i,i+1,i+7,i+1,i+8,i+7);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); g.setIndex(indices); g.computeVertexNormals();
  const roof = mesh(g, material, parent); roof.material.side = THREE.DoubleSide;
  for (const end of [-depth/2, depth/2]) {
    const curve = new THREE.CatmullRomCurve3(cross.map(([x,h]) => new THREE.Vector3(x,y+h+.045,end)));
    mesh(new THREE.TubeGeometry(curve,24,.05,5,false),materials.gold,parent);
    const finial = new THREE.CatmullRomCurve3([new THREE.Vector3(0,y+1.55,end),new THREE.Vector3(0,y+1.85,end+Math.sign(end)*.13),new THREE.Vector3(0,y+2.22,end+Math.sign(end)*.26)]);
    mesh(new THREE.TubeGeometry(finial,12,.065,5,false),materials.gold,parent);
  }
  for(let z=-depth/2+.14;z<depth/2;z+=.24) {
    const curve = new THREE.CatmullRomCurve3(cross.map(([x,h])=>new THREE.Vector3(x,y+h+.015,z)));
    const seam = mesh(new THREE.TubeGeometry(curve,14,.015,3,false),materials.roof,parent); seam.castShadow=false;
  }
}
function makePavilion(scene) {
  const group = new THREE.Group(); group.position.set(9,0,-7); scene.add(group);
  box(group, materials.wood, 0,.7,0,4.2,.24,3.7);
  for (const x of [-1.7,1.7]) for(const z of [-1.4,1.4]) {
    box(group,materials.darkWood,x,1.8,z,.18,3.6,.18);
    box(group,materials.gold,x,3.1,z,.21,.12,.21);
  }
  for (let x=-2;x<2;x+=.23) box(group,materials.darkWood,x,.83,0,.018,.015,3.6);
  for(const z of [-1.45,1.45]) {
    box(group,materials.wood,0,1.35,z,3.5,.09,.09);
    for(let x=-1.7;x<1.8;x+=.35) if(!(z>0&&Math.abs(x)<.6))box(group,materials.wood,x,1.1,z,.055,.55,.055);
  }
  thaiRoof(group,5.1,4.7,3.15,materials.tile);
  thaiRoof(group,3.6,3.5,4.05,materials.roof);
  for(let i=0;i<4;i++)box(group,materials.wood,0,.12+i*.17,2.1-i*.15,1.25,.2,.45);
  // Pier leading towards the lotus canal.
  for(let i=0;i<17;i++)box(scene,materials.wood,11+i*.25,.65,-7, .22,.14,1.35);
  for(const x of [11,13,15])for(const z of [-7.55,-6.45])box(scene,materials.darkWood,x,.5,z,.12,1,.12);
  obstacles.push({x:9,z:-7,radius:2.4});
}
function makeShrine(scene) {
  const g = new THREE.Group(); g.position.set(-12,0,6);scene.add(g);
  cylinder(g,materials.stone,0,.65,0,.28,.38,1.3,8);
  box(g,materials.wood,0,1.4,0,1.5,.15,1.3);
  box(g,materials.brick,0,1.8,-.25,1.1,.8,.8);
  box(g,materials.darkWood,0,1.8,.17,.32,.48,.02);
  thaiRoof(g,1.9,1.7,2.17,materials.tile);
  for(const x of [-.6,.6])box(g,materials.wood,x,1.85,.48,.09,.85,.09);
  for(let i=0;i<3;i++)cylinder(g,materials.gold,-.3+i*.28,1.57,.48,.05,.06,.12,8);
  obstacles.push({x:-12,z:6,radius:1.1});
}
function makeRuins(scene) {
  for (const [x,z,length,rotation] of [[-8,-12,8,0],[-11,-8,5,Math.PI/2],[1,-14,5,0],[5,-12,3,Math.PI/2]]) {
    const wall = new THREE.Group();wall.position.set(x,0,z);wall.rotation.y=rotation;scene.add(wall);
    for(let row=0;row<4;row++)for(let col=0;col<Math.floor(length/.52);col++) {
      if(random() < row*.17)continue;
      box(wall,random()>.15?materials.brick:materials.moss,-length/2+col*.52+(row%2)*.22,.12+row*.24,0,.49,.21,.5);
    }
    for(let i=0;i<12;i++){const b=box(wall,materials.brick,range(-length/2,length/2),.08,range(-.9,.9),.4,.16,.23);b.rotation.y=random()*6;}
    // Broken walls also block movement, matching their visible layout.
    for(let offset=-length/2;offset<length/2;offset+=.5)obstacles.push({x:x+Math.cos(rotation)*offset,z:z-Math.sin(rotation)*offset,radius:.42});
  }
}

function makeWater(scene) {
  const vertices=[],indices=[];
  for(let i=0;i<=100;i++){
    const z=-29+i*.58; vertices.push(riverX(z)-2.2,-.045,z,29,-.045,z);
    if(i<100){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material = new THREE.ShaderMaterial({
    uniforms:{uTime:windUniforms.uTime,uTint:{value:new THREE.Color('#648e7b')}},side:THREE.DoubleSide,
    vertexShader:`varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform float uTime;uniform vec3 uTint;varying vec3 vWorld;
    void main(){float wave=sin(vWorld.x*3.+vWorld.z*2.+uTime*.6)*sin(vWorld.z*5.-uTime*.7);float shimmer=pow(max(0.,wave),12.);float stripe=sin(vWorld.x*1.3+vWorld.z*.9+uTime*.25)*.03;vec3 col=uTint+vec3(stripe)+shimmer*vec3(.21,.21,.13);gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });scene.add(new THREE.Mesh(geometry,material));
  // Shore stones and reeds soften the edge between land and water.
  for(let i=0;i<130;i++){
    const z=range(-27,27),x=riverX(z)-2.2+range(-.25,.1);
    mesh(new THREE.DodecahedronGeometry(1,0),materials.stone,scene,x,.02,z,[range(.1,.3),range(.08,.18),range(.15,.4)]);
  }
  for(let i=0;i<60;i++){
    const z=range(-25,25),x=riverX(z)+range(-1.4,3);
    const pad=mesh(new THREE.CircleGeometry(range(.15,.35),12),mat('#698458',{side:THREE.DoubleSide}),scene,x,.004,z);pad.rotation.x=-Math.PI/2;pad.castShadow=false;
    if(i%4===0){
      const flower=new THREE.Group();flower.position.set(x,.045,z);scene.add(flower);
      for(let p=0;p<7;p++){
        const a=p/7*Math.PI*2;const petal=mesh(new THREE.SphereGeometry(1,7,5),mat('#ddb6ae'),flower,Math.cos(a)*.08,.06,Math.sin(a)*.08,[.04,.1,.045]);petal.rotation.z=Math.sin(a)*.6;petal.rotation.x=Math.cos(a)*.6;
      }
      mesh(new THREE.SphereGeometry(.045,8,6),materials.gold,flower,0,.1,0);
    }
  }
  return material;
}

function makeAtmosphere(scene) {
  const positions=[],phases=[];
  for(let i=0;i<230;i++){positions.push(range(-23,20),range(.4,6),range(-23,23));phases.push(range(0,Math.PI*2));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'#fff8d9');gradient.addColorStop(.2,'#fff0c0');gradient.addColorStop(1,'#fff0c000');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
  const particles=new THREE.Points(geometry,new THREE.PointsMaterial({map:new THREE.CanvasTexture(canvas),color:'#fff1bd',size:.14,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(particles);
  const leafGeo=new THREE.PlaneGeometry(.12,.22), leaves=new THREE.InstancedMesh(leafGeo,mat('#bead66',{side:THREE.DoubleSide,transparent:true,opacity:.75}),40);scene.add(leaves);
  const leafDummy=new THREE.Object3D();
  return {particles,leaves,update(time,dt){
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      let x=p.getX(i)+dt*(.1+windUniforms.uWind*.35);if(x>22)x=-24;
      p.setX(i,x);p.setY(i,positions[i*3+1]+Math.sin(time*.5+phases[i])*.2);
    }p.needsUpdate=true;
    for(let i=0;i<40;i++){
      const phase=phases[i],cycle=(time*.2+phase)%8;
      leafDummy.position.set(positions[i*3]+cycle*windUniforms.uWind,6-cycle*.75,positions[i*3+2]+Math.sin(cycle+phase));
      leafDummy.rotation.set(cycle,phase+time*.3,Math.sin(time+phase));leafDummy.updateMatrix();leaves.setMatrixAt(i,leafDummy.matrix);
    }leaves.instanceMatrix.needsUpdate=true;
  }};
}

export function buildWorld(scene) {
  seed=481516;
  const ground=makeTerrain(scene);makeGrass(scene);makeTrees(scene);makeRocks(scene);makeChedi(scene);makePavilion(scene);makeShrine(scene);makeRuins(scene);
  const water=makeWater(scene),atmosphere=makeAtmosphere(scene);
  return {ground,water,atmosphere,update(time,dt){
    windUniforms.uTime.value=time;
    for(const a of animations){a.object.rotation.z=Math.sin(time*.9+a.phase)*a.strength*windUniforms.uWind.value;a.object.rotation.x=Math.cos(time*.7+a.phase)*a.strength*.4*windUniforms.uWind.value;}
    atmosphere.update(time,dt);
  }};
}

export function makePlayer(scene) {
  const player=new THREE.Group();scene.add(player);
  const skin=mat('#cd9b72'),shirt=mat('#e7d9ad'),pants=mat('#665e4a'),sash=mat('#944b35'),hair=mat('#302b24');
  const body=new THREE.Group();player.add(body);
  mesh(new THREE.SphereGeometry(.20,12,10),skin,body,0,1.28,0,[1,1.12,1]);
  mesh(new THREE.SphereGeometry(.205,12,8,0,Math.PI*2,0,Math.PI*.55),hair,body,0,1.34,-.015);
  mesh(new THREE.SphereGeometry(.075,8,8),hair,body,0,1.51,-.08);
  mesh(new THREE.CylinderGeometry(.16,.22,.47,8),shirt,body,0,.86,0);
  cylinder(body,sash,0,.65,0,.22,.22,.1,8);
  const legs=[],arms=[];
  for(const sign of [-1,1]){
    const leg=new THREE.Group();leg.position.set(sign*.105,.61,0);body.add(leg);
    mesh(new THREE.CylinderGeometry(.095,.075,.42,7),pants,leg,0,-.2,0);
    mesh(new THREE.SphereGeometry(.09,8,6),materials.darkWood,leg,0,-.47,.04,[1,.5,1.7]);legs.push(leg);
    const arm=new THREE.Group();arm.position.set(sign*.2,1.03,0);body.add(arm);
    mesh(new THREE.CylinderGeometry(.075,.055,.4,7),skin,arm,sign*.035,-.19,0);arms.push(arm);
  }
  const sword=box(body,materials.stone,-.26,.68,-.15,.035,.67,.06);sword.rotation.z=-.28;
  box(body,materials.wood,-.34,.98,-.15,.18,.05,.08);
  const ring=mesh(new THREE.RingGeometry(.36,.4,48),new THREE.MeshBasicMaterial({color:'#e1c983',transparent:true,opacity:.7,side:THREE.DoubleSide}),player,0,.04,0);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
  return {group:player,update(time,moving){body.position.y=moving?Math.sin(time*13)*.025:Math.sin(time*2)*.012;legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(time*12+i*Math.PI)*.45:0);arms.forEach((arm,i)=>arm.rotation.x=moving?Math.sin(time*12+i*Math.PI)*-.35:0);}};
}
