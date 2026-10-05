import * as THREE from 'three';
import { BOUNDS, WATER_Y, PADDY_WATER_Y, CANAL, STREAM, POND, PADDIES, CHANNELS, riverBank, farBank, baseHeight, resample } from './CityMap.js';
import { windUniforms } from './shaders.js';

// One shader for every water surface. aShore runs 0 at the bank to 1 in open
// water; it drives depth colour, a soft foam line and the sky reflection.
export const waterUniforms = { uSky: { value: new THREE.Color('#c7d6c4') }, uNight: { value: 0 }, uSun: { value: new THREE.Color('#fff0c6') } };
export const waterMaterials = [];

function waterMaterial(shallow, deep, { foam = 1, scale = 1, reflect = 1 } = {}) {
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: foam }, uScale: { value: scale }, uReflect: { value: reflect } }]),
    vertexShader: `attribute float aShore; varying float vShore; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() { vShore = aShore; vWorld = (modelMatrix * vec4(position, 1.)).xyz; vec4 mvPosition = viewMatrix * vec4(vWorld, 1.); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun; uniform float uNight; uniform float uFoam; uniform float uScale; uniform float uReflect;
      varying float vShore; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vWorld.xz * uScale;
        vec3 col = mix(uShallow, uDeep, smoothstep(0., 1., vShore));
        float wave = sin(p.x * 1.7 + p.y * 1.1 + uTime * .6) * sin(p.y * 2.3 - uTime * .5 + p.x * .4);
        float ripple = sin(p.x * .35 + p.y * .6 + uTime * .3) * .5 + .5;
        float drift = sin(p.x * 1.3 + p.y * .9 + uTime * .25) * .03;
        col = mix(col, uSky, (.16 + .14 * ripple) * uReflect) + drift;
        col += pow(max(0., wave), 11.) * uSun * .26 * (1. - uNight * .75);
        float line = .07 + .03 * sin(uTime * 1.3 + p.x * .8 + p.y * .6);
        col = mix(col, vec3(.86, .88, .8) * (1. - uNight * .6), (1. - smoothstep(0., line, vShore)) * uFoam * .5);
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  Object.assign(material.uniforms, { uTime: windUniforms.uTime, uSky: waterUniforms.uSky, uNight: waterUniforms.uNight, uSun: waterUniforms.uSun });
  waterMaterials.push(material);
  return material;
}

function surface(positions, shore, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  g.setIndex(indices); g.computeBoundingSphere(); return g;
}
function ribbon(pts, half, yAt, pos, shore, idx) {
  const line = resample(pts, 1.5), base = pos.length / 3;
  line.forEach(([x, z], i) => {
    const [ax, az] = line[Math.max(0, i - 1)], [bx, bz] = line[Math.min(line.length - 1, i + 1)], len = Math.hypot(bx - ax, bz - az) || 1;
    const nx = -(bz - az) / len, nz = (bx - ax) / len, y = yAt(x, z);
    for (const s of [-1, 0, 1]) { pos.push(x + nx * half * s, y, z + nz * half * s); shore.push(s ? 0 : 1); }
    if (i) { const a = base + (i - 1) * 3, b = base + i * 3; idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1); }
  });
}
function addMesh(scene, geometry, material) {
  const m = new THREE.Mesh(geometry, material); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m;
}

// Only surfaces that reach into `rect` (one map's built extent) are created.
// dispose() frees the surfaces and forgets their materials.
export function buildWater(scene, rect = BOUNDS) {
  const meshes = [], overlaps = (z0, z1) => z1 >= rect.minZ && z0 <= rect.maxZ;
  const add = (geometry, material) => { meshes.push(addMesh(scene, geometry, material)); };
  const river = waterMaterial('#6f9682', '#4f7d74', { foam: 1 });
  const canal = waterMaterial('#6c8c74', '#557c70', { foam: .8, scale: 1.2 });
  const stream = waterMaterial('#4d6458', '#33483f', { foam: .5, scale: 1.4 });
  const paddy = waterMaterial('#6a8450', '#587a50', { foam: .2, scale: 1.6, reflect: .45 });
  const materials = [river, canal, stream, paddy];

  // River, extended past the map edges so its ends are never seen.
  if (overlaps(155, 260)) {
    const pos = [], shore = [], idx = [], rows = 14, cols = [];
    for (let x = BOUNDS.minX - 40; x <= BOUNDS.maxX + 40; x += 2.5) cols.push(x);
    cols.forEach((x, i) => {
      const a = riverBank(x) - .8, b = farBank(x) + .8;
      for (let r = 0; r <= rows; r++) { const z = a + (b - a) * r / rows; pos.push(x, WATER_Y, z); shore.push(Math.min(1, Math.max(0, Math.min(z - a - .8, b - .8 - z) / 14))); }
      if (i) for (let r = 0; r < rows; r++) { const p = (i - 1) * (rows + 1) + r, q = i * (rows + 1) + r; idx.push(p, p + 1, q, q, p + 1, q + 1); }
    });
    add(surface(pos, shore, idx), river);
  }
  if (overlaps(-90, 2)) {
    const pos = [], shore = [], idx = [];
    ribbon(CANAL.pts, CANAL.half + .7, () => WATER_Y, pos, shore, idx);
    // Lotus pond in the temple grounds.
    const base = pos.length / 3, seg = 28;
    pos.push(POND.x, WATER_Y + .02, POND.z); shore.push(1);
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; pos.push(POND.x + Math.cos(a) * (POND.rx + .6), WATER_Y + .02, POND.z + Math.sin(a) * (POND.rz + .6)); shore.push(0); if (i) idx.push(base, base + i + 1, base + i); }
    add(surface(pos, shore, idx), canal);
  }
  if (overlaps(-425, -380)) {
    const pos = [], shore = [], idx = [];
    ribbon(STREAM.pts, STREAM.half + .6, (x, z) => baseHeight(x, z) - .38, pos, shore, idx);
    add(surface(pos, shore, idx), stream);
  }
  if (overlaps(-256, -148)) {
    const pos = [], shore = [], idx = [];
    for (const p of PADDIES) {
      if (!overlaps(p.z0, p.z1)) continue;
      const b = pos.length / 3, cx = (p.x0 + p.x1) / 2, cz = (p.z0 + p.z1) / 2;
      pos.push(p.x0 - .2, PADDY_WATER_Y, p.z0 - .2, p.x1 + .2, PADDY_WATER_Y, p.z0 - .2, p.x1 + .2, PADDY_WATER_Y, p.z1 + .2, p.x0 - .2, PADDY_WATER_Y, p.z1 + .2, cx, PADDY_WATER_Y, cz);
      shore.push(0, 0, 0, 0, 1);
      idx.push(b, b + 4, b + 1, b + 1, b + 4, b + 2, b + 2, b + 4, b + 3, b + 3, b + 4, b);
    }
    for (const c of CHANNELS) ribbon(c.pts, c.half + .2, () => -.16, pos, shore, idx);
    add(surface(pos, shore, idx), paddy);
  }
  return {
    river, canal, stream, paddy, meshes,
    dispose() {
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
      for (const m of materials) { m.dispose(); const i = waterMaterials.indexOf(m); if (i >= 0) waterMaterials.splice(i, 1); }
    },
  };
}
