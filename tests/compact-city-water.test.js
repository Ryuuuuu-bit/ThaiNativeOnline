import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCityWater, createCityWaterMaterial } from '../src/world/compact-city-render/buildCityWater.js';
import { waterUniforms, waterMaterials } from '../src/world/Water.js';

function shader(material) {
  const program = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(program, {}); return program;
}
function countDisposals(resource) {
  let count = 0; resource.addEventListener('dispose', () => count++); return () => count;
}

test('river adapts legacy flowing noise, orthographic Fresnel and filtered glints while retaining standard lighting', () => {
  let previousCalled = 0;
  const river = createCityWaterMaterial({ mat: (color, extra) => {
    const m = new THREE.MeshStandardMaterial({ color, ...extra });
    m.onBeforeCompile = () => previousCalled++;
    m.customProgramCacheKey = () => 'owner-material'; return m;
  } });
  try {
    const program = shader(river.material), f = program.fragmentShader;
    assert.equal(previousCalled, 1); assert.match(river.material.customProgramCacheKey(), /^owner-material\|city-water-v6-river$/);
    assert.match(f, /vec3 cityNoise1 = cityWaterNoise/); assert.match(f, /vec3 cityNoise2 = cityWaterNoise/);
    assert.match(f, /vec3 cityNoise3 = cityWaterNoise/); assert.match(f, /cityDrift = vec2\(0.55, 0.04\)/);
    assert.match(f, /vec3 cityView = isOrthographic/); assert.match(f, /cityFresnel = min\(.*0.22\)/);
    assert.match(f, /fwidth\(cityToSun\)/); assert.match(f, /cityGlintFilter.*cityWaterDetail/);
    assert.match(f, /#include <lights_fragment_maps>/); assert.match(f, /#include <fog_fragment>/);
    assert(f.indexOf('outgoingLight = mix') < f.indexOf('#include <tonemapping_fragment>'));
    assert.match(f, /directSpecular \*= 0.10/); assert.equal(river.material.map, null);
    assert.match(f, /cityBrightGain = mix\(0.50, 1.0, smoothstep\(0.0, 0.12, uCityWaterNight\)\)/);
    assert.match(f, /cityFresnel \* cityBrightGain/);
    assert.match(f, /cityFoam \*= cityBrightGain/);
    assert.match(f, /mix\(0.50, 0.38, smoothstep\(0.0, 0.12, uCityWaterNight\)\)/);
    assert.equal(river.material.transparent, false);
  } finally { river.dispose(); river.material.dispose(); }
});

test('fountain retains existing wave and ring treatment without river reflection or flowing-noise additions', () => {
  const fountain = createCityWaterMaterial({ mode: 'fountain', x: 0, z: -2.4 });
  try {
    const p = shader(fountain.material);
    assert.match(p.fragmentShader, /vec3 cityWave = cityWaterWaves\(cityWaterP \* 2.0\)/);
    assert.match(p.fragmentShader, /float cityRing = sin\(length\(cityWaterP\) \* 19.0/);
    assert.match(p.fragmentShader, /normalize\(vec3\(-cityWave.y \* 0.75, 1.0, -cityWave.z \* 0.75\)\)/);
    assert(!p.fragmentShader.includes('cityWaterNoise')); assert(!p.fragmentShader.includes('cityFresnel'));
    assert(!p.uniforms.uCityWaterSky); assert(fountain.uniforms.uCityWaterRipples.value.every(v => v.w === 0));
  } finally { fountain.dispose(); }
});

test('river borrows environment sky and sun without mutating shared uniforms or legacy resource registry', () => {
  const registry = waterMaterials.slice(), before = Object.fromEntries(Object.entries(waterUniforms)
    .map(([k, u]) => [k, u.value?.toArray?.() ?? u.value]));
  const river = createCityWaterMaterial();
  const allocations = [river.material], counts = allocations.map(countDisposals);
  const p = shader(river.material);
  assert.equal(p.uniforms.uCityWaterSky, waterUniforms.uSky);
  assert.equal(p.uniforms.uCityWaterSun, waterUniforms.uSun);
  assert.equal(p.uniforms.uCityWaterSunDir, waterUniforms.uSunDir);
  river.update(9, { night: .7 }); river.dispose(); river.dispose();
  assert.deepEqual(counts.map(read => read()), [1]); assert.deepEqual(waterMaterials, registry);
  assert.deepEqual(Object.fromEntries(Object.entries(waterUniforms)
    .map(([k, u]) => [k, u.value?.toArray?.() ?? u.value])), before);
});

test('river render topology and default anchors remain exact through updates and disposal', () => {
  const root = new THREE.Group(), river = buildCityWater({ root });
  const expected = new THREE.PlaneGeometry(200, 70), geometry = river.mesh.geometry;
  try {
    assert.deepEqual(geometry.attributes.position.array, expected.attributes.position.array);
    assert.deepEqual(geometry.index.array, expected.index.array);
    assert.deepEqual(river.mesh.position.toArray(), [0, -.32, 99.65]);
    assert.equal(river.mesh.rotation.x, -Math.PI / 2); assert.equal(geometry.attributes.position.count, 4);
    assert.deepEqual(river.uniforms.uCityWaterRipples.value.map(v => v.toArray().slice(0, 2)), [[-7, 65], [7, 65], [-20, 75], [-10, 70]]);
    const positions = geometry.attributes.position, indices = geometry.index;
    for (let i = 0; i < 120; i++) river.update(i / 60, 1 / 60, null, { night: i / 120 });
    assert.equal(geometry.attributes.position, positions); assert.equal(geometry.index, indices);
    assert.deepEqual(positions.array, expected.attributes.position.array);
    assert.equal(root.children.length, 1); assert.equal(river.stats.cityWaterTextures, 0);
  } finally { river.dispose(); expected.dispose(); }
  assert.equal(root.children.length, 0);
});

test('river factory ownership and attachment-failure cleanup remain idempotent', () => {
  for (const external of [false, true]) {
    const owned = [], root = new THREE.Group(); let resources, counts;
    root.add = mesh => { resources = [mesh.material, mesh.geometry]; counts = resources.map(countDisposals); throw new Error('water attachment failure'); };
    const options = external ? {
      mat: (color, extra) => { const m = new THREE.MeshStandardMaterial({ color, ...extra }); owned.push(m); return m; },
      geo: g => { owned.push(g); return g; },
    } : {};
    assert.throws(() => buildCityWater({ root, ...options }), /water attachment failure/);
    assert.deepEqual(counts.map(read => read()), external ? [0, 0] : [1, 1]);
    if (external) { assert.deepEqual(owned, resources); owned.forEach(r => r.dispose()); assert.deepEqual(counts.map(read => read()), [1, 1]); }
    assert.equal(root.children.length, 0);
  }
});

test('legacy analytic noise slopes agree with finite differences across moving samples', () => {
  const fract = x => x - Math.floor(x);
  const hash = (x, z) => {
    x = 50 * fract(x * .3183099 + .71); z = 50 * fract(z * .3183099 + .113);
    return -1 + 2 * fract(x * z * (x + z));
  };
  const noise = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = fract(x), fz = fract(z);
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1), k = a - b - c + d;
    return [a + (b-a)*ux + (c-a)*uz + k*ux*uz,
      6*fx*(1-fx)*(b-a+k*uz), 6*fz*(1-fz)*(c-a+k*ux)];
  };
  for (let i = 0; i < 80; i++) {
    const x = .137 + i * .419, z = -.213 - i * .317, eps = .00001, n = noise(x, z);
    assert(Math.abs((noise(x+eps,z)[0]-noise(x-eps,z)[0])/(2*eps)-n[1]) < 1e-5);
    assert(Math.abs((noise(x,z+eps)[0]-noise(x,z-eps)[0])/(2*eps)-n[2]) < 1e-5);
    assert(Math.abs(n[0]) <= 1);
  }
});
