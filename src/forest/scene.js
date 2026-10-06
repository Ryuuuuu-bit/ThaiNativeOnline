import * as THREE from 'three';
import { leafClumpTexture as sharedLeafClumpTexture, patchFoliage } from '../shared/foliage.js';

// Fixed seed: trees, collision and the trail are identical on every load.
let seed = 20261005;
function random() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
const range = (a, b) => a + random() * (b - a);

export const HALF = 48;
export const shared = {
  uTime: { value: 0 }, uWind: { value: .55 },
  // Where the player is on screen, so foliage between camera and player can thin out.
  uPlayerUv: { value: new THREE.Vector2(.5, .5) }, uPlayerDepth: { value: 30 }, uAspect: { value: 16 / 9 },
  uViewport: { value: new THREE.Vector2(1920, 1080) },
};
export const obstacles = [];
export const trees = [];

export function trailX(z) { return 2.2 * Math.sin(z * .07) + 1.4 * Math.sin(z * .19 + 1) + 3; }
export function groundHeight(x, z) { return .22 * Math.sin(x * .08) * Math.cos(z * .07) + .1 * Math.sin(z * .21 + x * .05); }

// ---------- Wind -----------------------------------------------------------
// Trees bend from the ground up (height^1.6) under slow travelling gusts, and
// card tips flutter quickly, so canopies "breathe" instead of rocking rigidly.
const windGLSL = `
uniform float uTime; uniform float uWind;
vec3 windOffset(vec3 wp, float tip, float bendScale, float flutterScale) {
  float gust = sin(uTime * .42 + wp.x * .04 + wp.z * .03) * .5 + .5;
  gust = .35 + gust * gust * 1.4;
  float sway = sin(uTime * 1.15 + wp.x * .09 + wp.z * .06) + .4 * sin(uTime * 2.3 + wp.z * .17 + wp.x * .05);
  float bend = pow(max(wp.y, 0.), 1.6) * bendScale * uWind * gust;
  vec3 o = vec3(sway * bend, 0., cos(uTime * .87 + wp.x * .08) * bend * .5);
  float f = sin(uTime * 7.3 + wp.x * 1.9 + wp.y * 2.7 + wp.z * 1.3) + .5 * sin(uTime * 11.1 + wp.z * 3.1);
  f *= tip * flutterScale * uWind * gust;
  return o + vec3(f * .5, f, f * .35);
}`;

function patchWind(material, { bend = .007, flutter = .06, tip = 'card' } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    Object.assign(shader.uniforms, shared);
    const tipExpr = tip === 'card' ? 'clamp(length(position.xy), 0., 1.)' : tip === 'height' ? 'clamp(position.y * 2.5, 0., 1.)' : '0.';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windGLSL}\nvarying float vViewDepth;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 windWorld = modelMatrix * mvPosition;
        windWorld.xyz += windOffset(windWorld.xyz, ${tipExpr}, ${bend.toFixed(5)}, ${flutter.toFixed(4)});
        mvPosition = viewMatrix * windWorld;
        vViewDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => `wind-${bend}-${flutter}-${tip}`;
  return material;
}

// Dithered cut-out of foliage and trunks standing between the camera and the player.
function patchFade(material) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec2 uPlayerUv; uniform float uPlayerDepth; uniform float uAspect; uniform vec2 uViewport; varying float vViewDepth;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        {
          // Fully clear around the player; an ordered 8x8 dither feathers only the rim,
          // so the window reads as a soft gradient rather than scattered dots.
          vec2 d = gl_FragCoord.xy / uViewport - uPlayerUv; d.x *= uAspect;
          float hole = 1. - smoothstep(.10, .20, length(d));
          vec2 px = floor(gl_FragCoord.xy);
          float b2 = fract(px.x * .5 + px.y * px.y * .75);
          vec2 p4 = floor(px * .5); float b4 = fract(p4.x * .5 + p4.y * p4.y * .75) * .25 + b2;
          vec2 p8 = floor(px * .25); float b8 = fract(p8.x * .5 + p8.y * p8.y * .75) * .0625 + b4;
          if (vViewDepth < uPlayerDepth - 1.5 && hole > b8 * .999) discard;
        }`);
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key()}-fade`;
  return material;
}

// Foliage shading (data textures tinted per instance) lives in src/shared/foliage.js.

// ---------- Textures -------------------------------------------------------
function canvas(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); return c; }
function dataTexture(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t; }

// Fir spray: a stem with needle tufts and fresh snow resting on top.
function pineCardTexture() {
  return dataTexture(canvas(256, (ctx) => {
    ctx.lineCap = 'round';
    const stemY = x => 128 + Math.sin(x / 256 * 2.6) * 10 - x * .04;
    const tuft = (x0, y0, len, spread, shade) => {
      for (let i = 0; i < 9; i++) {
        const a = range(-spread, spread), l = len * range(.6, 1);
        ctx.strokeStyle = `rgb(${Math.floor(shade + range(-30, 30))},0,0)`; ctx.lineWidth = range(1.6, 3.2);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * l * .45 + l * .3, y0 + Math.sin(a) * l); ctx.stroke();
      }
    };
    for (let x = 4; x < 240; x += 5) {
      const t = x / 240, half = (1 - t * .75) * 92, y = stemY(x);
      // Side twigs, each with needle tufts.
      for (const dir of [-1, 1]) if (random() < .55) {
        const len = half * range(.55, 1);
        ctx.strokeStyle = 'rgb(70,0,0)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * .55, y + dir * len); ctx.stroke();
        for (let k = .2; k < 1.01; k += .2) tuft(x + len * .55 * k, y + dir * len * k, 22 * (1 - t * .5), 1.3, 90 + k * 90);
      }
      tuft(x, y, 26 * (1 - t * .4), 1.6, 120 + t * 80);
    }
    ctx.strokeStyle = 'rgb(60,0,0)'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = 0; x < 246; x += 4) x ? ctx.lineTo(x, stemY(x)) : ctx.moveTo(0, stemY(0)); ctx.stroke();
    // Snow: soft clumps along the spine and twigs. Painted with R high so it stays bright.
    for (let i = 0; i < 70; i++) {
      const x = range(6, 236), t = x / 240, y = stemY(x) + range(-1, 1) * (1 - t * .75) * 70 * Math.sqrt(random());
      ctx.fillStyle = `rgba(230,255,0,${range(.85, 1)})`;
      ctx.beginPath(); ctx.ellipse(x, y, range(5, 14) * (1 - t * .4), range(3, 7), range(-.5, .5), 0, Math.PI * 2); ctx.fill();
    }
  }));
}
const leafClumpTexture = () => sharedLeafClumpTexture(random);
function snowTexture() {
  const t = new THREE.CanvasTexture(canvas(2048, (ctx, size) => {
    const px = v => (v / (HALF * 2) + .5) * size;
    ctx.fillStyle = '#eef1f6'; ctx.fillRect(0, 0, size, size);
    // Wind-sculpted drifts: broad soft patches of blue-grey and bright white.
    for (let i = 0; i < 2600; i++) {
      const x = random() * size, y = random() * size, r = range(20, 120);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r), cool = random() < .5;
      g.addColorStop(0, cool ? 'rgba(196,207,228,.10)' : 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 25000; i++) {
      ctx.fillStyle = random() < .5 ? 'rgba(175,188,214,.10)' : 'rgba(255,255,255,.35)';
      ctx.fillRect(random() * size, random() * size, range(1, 3), range(1, 2));
    }
    // Long faint sled/wind lines across the clearing, like the reference.
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y = range(0, size), tilt = range(-.08, .08);
      ctx.strokeStyle = `rgba(160,174,205,${range(.08, .18)})`; ctx.lineWidth = range(1.5, 4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(size * .3, y + size * tilt, size * .6, y - size * tilt, size, y + range(-40, 40)); ctx.stroke();
    }
    // Trodden trail: compacted, slightly greyer snow with footprints.
    for (let layer = 0; layer < 4; layer++) {
      ctx.strokeStyle = ['rgba(190,198,215,.18)', 'rgba(184,192,210,.22)', 'rgba(176,184,204,.25)', 'rgba(205,210,222,.5)'][layer];
      ctx.lineWidth = [150, 110, 80, 50][layer]; ctx.beginPath();
      for (let z = -HALF; z <= HALF; z += .5) z === -HALF ? ctx.moveTo(px(trailX(z)), px(z)) : ctx.lineTo(px(trailX(z)), px(z));
      ctx.stroke();
    }
    for (let z = -HALF; z < HALF; z += .55) {
      const side = Math.round(z / .55) % 2 ? 1 : -1;
      ctx.fillStyle = 'rgba(150,162,190,.22)';
      ctx.beginPath(); ctx.ellipse(px(trailX(z) + side * .22), px(z), 2.6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Dry grass and twigs poking through, painted far beyond the instanced tufts.
    for (let i = 0; i < 2600; i++) {
      const x = random() * size, y = random() * size, n = Math.floor(range(2, 6));
      for (let k = 0; k < n; k++) {
        ctx.strokeStyle = random() < .6 ? 'rgba(140,116,78,.55)' : 'rgba(72,62,52,.55)'; ctx.lineWidth = range(.8, 1.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + range(-8, 8), y - range(3, 10)); ctx.stroke();
      }
    }
  }));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// Tileable cloud mask for drifting cloud shadows.
function cloudTexture() {
  const t = dataTexture(canvas(256, (ctx, size) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const x = random() * size, y = random() * size, r = range(12, 46);
      for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }));
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function patchClouds(material, clouds) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer);
    shader.uniforms.uClouds = { value: clouds }; shader.uniforms.uTime = shared.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloudPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vCloudPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xz;
        #else
          vCloudPos = (modelMatrix * vec4(transformed, 1.)).xz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uClouds; uniform float uTime; varying vec2 vCloudPos;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cloud = texture2D(uClouds, vCloudPos * .011 + uTime * vec2(.004, .0022)).r;
        diffuseColor.rgb *= mix(vec3(1.), vec3(.80, .85, .97), smoothstep(.35, .7, cloud));`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}-clouds`;
  return material;
}

// ---------- World pieces ---------------------------------------------------
function makeGround(scene, clouds) {
  const geometry = new THREE.PlaneGeometry(HALF * 2, HALF * 2, 160, 160); geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geometry.computeVertexNormals();
  const material = patchClouds(new THREE.MeshStandardMaterial({ map: snowTexture(), roughness: .82 }), clouds);
  const ground = new THREE.Mesh(geometry, material); ground.receiveShadow = true; scene.add(ground);
  return ground;
}

function placeTrees() {
  const spots = [];
  const ok = (x, z, gap) => spots.every(s => Math.hypot(s.x - x, s.z - z) > gap);
  // Hand-placed trees near the start frame the clearing like the reference shot.
  for (const [x, z, kind, s] of [[-2.4, -4, 'pine', 1], [-13, -9, 'broad', 1.2], [-15, 3, 'pine', 1.15], [9, -15, 'pine', 1.1], [15, -11, 'broad', 1.1], [-7, -16, 'pine', 1.25]]) spots.push({ x, z, kind, s });
  for (let tries = 0; tries < 9000 && spots.length < 260; tries++) {
    const x = range(-HALF + 2, HALF - 2), z = range(-HALF + 2, HALF - 2), d = Math.hypot(x, z);
    // Keep an open clearing (wider toward the default camera, +z) so the player stays readable.
    if (Math.abs(x - trailX(z)) < 3 || d < 11 || (z > 0 && Math.hypot(x, z * .6) < 15)) continue;
    // Denser towards the edges: the clearing opens into a deep forest.
    if (random() > .35 + d / HALF) continue;
    if (!ok(x, z, d < 22 ? 5.2 : 3.4)) continue;
    spots.push({ x, z, kind: random() < .8 ? 'pine' : 'broad', s: range(.8, 1.3) });
  }
  return spots;
}

function makeForest(scene) {
  const pineMat = patchFade(patchFoliage(patchWind(new THREE.MeshStandardMaterial({ map: pineCardTexture(), alphaTest: .42, side: THREE.DoubleSide, roughness: .9 }), { bend: .0085, flutter: .07 }), .85));
  const leafMat = patchFade(patchFoliage(patchWind(new THREE.MeshStandardMaterial({ map: leafClumpTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }), { bend: .009, flutter: .11 }), .55));
  const barkMat = patchFade(patchWind(new THREE.MeshStandardMaterial({ color: '#76604c', roughness: 1 }), { bend: .0085, flutter: 0, tip: 'none' }));
  const depthFor = (map) => patchWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: .42 }), { bend: .0085, flutter: .07 });

  // Pine card: plane from x=0 (stem base) to x=1 (tip).
  const cardGeo = new THREE.PlaneGeometry(1, .62); cardGeo.translate(.5, 0, 0);
  const clumpGeo = new THREE.PlaneGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(.55, 1, 1, 9, 4); trunkGeo.translate(0, .5, 0);

  const spots = placeTrees();
  const pines = spots.filter(s => s.kind === 'pine'), broads = spots.filter(s => s.kind === 'broad');
  const cards = new THREE.InstancedMesh(cardGeo, pineMat, pines.length * 120);
  const clumps = new THREE.InstancedMesh(clumpGeo, leafMat, broads.length * 150);
  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, spots.length * 7);
  cards.customDepthMaterial = depthFor(pineMat.map); clumps.customDepthMaterial = depthFor(leafMat.map);
  trunks.customDepthMaterial = patchWind(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), { bend: .0085, flutter: 0, tip: 'none' });

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), color = new THREE.Color();
  const qy = new THREE.Quaternion(), qz = new THREE.Quaternion(), qx = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
  let nc = 0, nl = 0, nt = 0;
  const addTrunk = (x, y, z, height, radius, tilt = new THREE.Quaternion()) => {
    m.compose(pos.set(x, y, z), tilt, scl.set(radius, height, radius)); trunks.setMatrixAt(nt++, m);
  };

  for (const t of pines) {
    const y0 = groundHeight(t.x, t.z), H = range(10, 15) * t.s, maxR = H * range(.27, .33);
    trees.push({ ...t, height: H, radius: maxR }); obstacles.push({ x: t.x, z: t.z, radius: .55 * t.s });
    addTrunk(t.x, y0 - .2, t.z, H * .92, .3 * t.s + .12);
    const tone = range(-.03, .03), whorls = Math.round(range(11, 15));
    for (let w = 0; w < whorls; w++) {
      const f = w / (whorls - 1), y = y0 + H * (.18 + f * .8), r = maxR * Math.pow(1 - f, .95) + .35;
      const count = Math.max(4, Math.round(9 - f * 4)), spin = random() * 6;
      for (let k = 0; k < count && nc < cards.count; k++) {
        const a = spin + k / count * Math.PI * 2 + range(-.25, .25), len = r * range(.8, 1.12);
        qy.setFromAxisAngle(Y, a); qz.setFromAxisAngle(Z, -range(.12, .42) + f * .25); qx.setFromAxisAngle(X, -Math.PI / 2 + range(-.35, .35));
        q.copy(qy).multiply(qz).multiply(qx);
        m.compose(pos.set(t.x + Math.cos(a) * .15, y + range(-.25, .25), t.z - Math.sin(a) * .15), q, scl.set(len, len * range(.85, 1.15), 1));
        cards.setMatrixAt(nc, m);
        // Lower branches sit in the canopy's own shade: darker and bluer.
        color.setHSL(.41 + tone + range(-.02, .02), range(.36, .48), .16 + f * .1 + range(-.02, .03)); cards.setColorAt(nc++, color);
      }
    }
    // A few upright sprays form the leader at the very top.
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + range(-.3, .3);
      qy.setFromAxisAngle(Y, a); qz.setFromAxisAngle(Z, range(1, 1.35)); q.copy(qy).multiply(qz);
      m.compose(pos.set(t.x, y0 + H * .9, t.z), q, scl.set(H * .07, H * .05, 1)); cards.setMatrixAt(nc, m);
      color.setHSL(.40 + tone, .35, .27); cards.setColorAt(nc++, color);
    }
  }

  for (const t of broads) {
    const y0 = groundHeight(t.x, t.z), H = range(8, 11) * t.s, crownR = H * .42, crownY = y0 + H * .68;
    trees.push({ ...t, height: H, radius: crownR }); obstacles.push({ x: t.x, z: t.z, radius: .6 * t.s });
    addTrunk(t.x, y0 - .2, t.z, H * .7, .38 * t.s + .1);
    for (let b = 0; b < 5; b++) {
      const a = b / 5 * Math.PI * 2 + range(-.3, .3);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), range(.6, .95));
      addTrunk(t.x, y0 + H * range(.35, .5), t.z, H * .3, .14 * t.s + .06, tilt);
    }
    const hue = range(.27, .33);
    for (let k = 0; k < 150 && nl < clumps.count; k++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()), h = range(-.7, 1);
      const px = t.x + Math.cos(a) * r * crownR, pz = t.z + Math.sin(a) * r * crownR;
      const py = crownY + h * crownR * .55 * (1 - r * r * .5);
      q.setFromEuler(new THREE.Euler(-Math.PI / 2 + range(-.5, .5), range(-.5, .5), random() * 6, 'YXZ'));
      const size = range(1.6, 2.6) * t.s;
      m.compose(pos.set(px, py, pz), q, scl.set(size, size, size)); clumps.setMatrixAt(nl, m);
      color.setHSL(hue + range(-.02, .02), range(.32, .45), .12 + (h + .7) * .07 + range(-.02, .02)); clumps.setColorAt(nl++, color);
    }
  }
  for (const [mesh, n] of [[cards, nc], [clumps, nl], [trunks, nt]]) {
    mesh.count = n; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  }
}

function makeRocks(scene) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
  const spots = [[5.5, 4.5, 1.25], [12, 6, 1], [-6, 12, .8], [9, -4, .6], [-18, -4, 1.4], [20, 14, 1.2], [-3, 22, 1], [16, -22, 1.3], [-24, 18, 1.1]];
  for (let i = 0; i < 26; i++) spots.push([range(-44, 44), range(-44, 44), range(.4, 1.1)]);
  for (const [x, z, s] of spots) {
    if (Math.abs(x - trailX(z)) < 2.5) continue;
    const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position, colors = [];
    const k = [range(0, 6), range(0, 6), range(0, 6)];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const n = 1 + .16 * Math.sin(v.x * 3 + k[0]) * Math.sin(v.y * 2.6 + k[1]) + .1 * Math.sin(v.z * 4 + k[2]);
      v.multiplyScalar(n); v.y = v.y > 0 ? v.y * .78 : v.y * .3; p.setXYZ(i, v.x, v.y, v.z);
      // Snow on top faces, cold grey rock on the sides.
      const snow = THREE.MathUtils.smoothstep(v.y, .15, .5);
      colors.push(THREE.MathUtils.lerp(.58, .95, snow), THREE.MathUtils.lerp(.6, .97, snow), THREE.MathUtils.lerp(.64, 1, snow));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, material); rock.position.set(x, groundHeight(x, z) + .05 * s, z);
    rock.scale.set(s * range(1, 1.4), s, s * range(.9, 1.2)); rock.rotation.y = random() * 6;
    rock.castShadow = rock.receiveShadow = true; scene.add(rock);
    obstacles.push({ x, z, radius: s * 1.05 });
  }
}

function makeGrass(scene, clouds) {
  // A tuft is a fan of thin blades; tips flutter in the wind.
  const verts = [], idx = [];
  for (let b = 0; b < 7; b++) {
    const a = b / 7 * Math.PI * 2, lean = .12 + (b % 3) * .05, h = .28 + (b % 4) * .07, n = verts.length / 3;
    const ox = Math.cos(a), oz = Math.sin(a);
    verts.push(-oz * .025, 0, ox * .025, oz * .025, 0, -ox * .025, ox * lean, h, oz * lean);
    idx.push(n, n + 1, n + 2);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const material = patchClouds(patchWind(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 }), { bend: 0, flutter: .18, tip: 'height' }), clouds);
  const grass = new THREE.InstancedMesh(geo, material, 2600);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color(); let n = 0;
  for (let i = 0; i < 2600; i++) {
    const x = range(-HALF, HALF), z = range(-HALF, HALF);
    if (Math.abs(x - trailX(z)) < 1.4) continue;
    const s = range(.6, 1.5);
    m.compose(new THREE.Vector3(x, groundHeight(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), random() * 6), new THREE.Vector3(s, s * range(.7, 1.3), s));
    grass.setMatrixAt(n, m);
    random() < .7 ? color.setHSL(range(.08, .11), range(.3, .45), range(.36, .5)) : color.setHSL(.07, .15, range(.26, .34));
    grass.setColorAt(n++, color);
  }
  grass.count = n; grass.castShadow = true; grass.receiveShadow = true; scene.add(grass);
}

function makeSnowfall(scene) {
  const count = 3200, positions = new Float32Array(count * 3), speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions.set([range(-30, 30), range(0, 26), range(-30, 30)], i * 3); speeds[i] = range(.5, 1.3); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const flake = canvas(32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffffffcc'); g.addColorStop(1, '#ffffff00'); ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  });
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(flake), size: .16, transparent: true, opacity: .9, depthWrite: false }));
  points.frustumCulled = false; scene.add(points);
  return {
    points,
    update(dt, time, center) {
      const p = geometry.attributes.position.array, drift = shared.uWind.value;
      for (let i = 0; i < count; i++) {
        let x = p[i * 3] + (Math.sin(time * .7 + i) * .25 + drift * 1.2) * dt, y = p[i * 3 + 1] - speeds[i] * dt, z = p[i * 3 + 2] + Math.cos(time * .5 + i * 1.3) * .2 * dt;
        if (y < 0) y += 26;
        // Wrap flakes around the camera focus so the snowfall never runs out.
        x = center.x + THREE.MathUtils.euclideanModulo(x - center.x + 30, 60) - 30;
        z = center.z + THREE.MathUtils.euclideanModulo(z - center.z + 30, 60) - 30;
        p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

export function buildForest(scene) {
  seed = 20261005; obstacles.length = 0; trees.length = 0;
  const clouds = cloudTexture();
  const ground = makeGround(scene, clouds);
  makeForest(scene); makeRocks(scene); makeGrass(scene, clouds);
  const snow = makeSnowfall(scene);
  return { ground, snow, update(dt, time, center) { shared.uTime.value = time; snow.update(dt, time, center); } };
}
