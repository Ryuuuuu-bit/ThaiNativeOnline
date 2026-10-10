import * as THREE from 'three';
import { BOUNDS } from './CityMap.js';
import { waterSurfaces } from './water-surfaces.js';
import { windUniforms } from './shaders.js';

// One shader family for every water surface. aShore runs 0 at the bank to 1 in
// open water; it drives depth colour, the bank foam and how far the waves reach.
// Waves: four summed directional sine waves (shared by the vertex displacement
// and the per-pixel normal) travelling along uFlow, plus three scrolling noise
// ripple layers. Lighting: fresnel sky reflection warmed toward the sun, soft
// diffuse wave shading, a sun/moon glint and dancing sparkles. No scene lights,
// so it stays one cheap pass with fog. uSunDir points toward the sun (the moon
// at night) and is set by Environment.
export const waterUniforms = {
  uSky: { value: new THREE.Color('#c7d6c4') }, uNight: { value: 0 }, uSun: { value: new THREE.Color('#fff0c6') },
  uSunDir: { value: new THREE.Vector3(-.49, .77, -.41).normalize() },
};
export const waterMaterials = [];

const WAVES = /* glsl */`
  uniform float uTime; uniform float uAmp; uniform float uScale; uniform vec2 uFlow;
  // Height and x/z slope of four directional waves (wavelengths 9, 5.3, 3.7, 2.4).
  vec3 waveSum(vec2 p) {
    vec3 h = vec3(0.);
    vec2 f = normalize(uFlow + vec2(1e-3, 0.)), s = vec2(-f.y, f.x);
    float speed = .9 + length(uFlow);
    vec4 A = vec4(.5, .3, .2, .12), K = vec4(.698, 1.185, 1.698, 2.618) * uScale;
    vec2 D[4]; D[0] = f; D[1] = normalize(f + .65 * s); D[2] = normalize(f - .5 * s); D[3] = normalize(.35 * f + s);
    for (int i = 0; i < 4; i++) {
      float ph = dot(D[i], p) * K[i] - uTime * K[i] * speed * (i == 3 ? .5 : 1.) + float(i) * 1.7;
      h.x += A[i] * sin(ph); h.yz += A[i] * K[i] * cos(ph) * D[i];
    }
    return h * uAmp;
  }`;

// amp: wave height (peak is ~1.1x amp); ripple: noise normal strength;
// flow: drift direction and speed (world units/s); glint: sun glint/sparkle strength.
function waterMaterial(shallow, deep, { foam = 1, scale = 1, reflect = 1, amp = .16, ripple = 1, flow = [.5, 0], glint = 1 } = {}) {
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: foam }, uScale: { value: scale },
      uReflect: { value: reflect }, uAmp: { value: amp }, uRipple: { value: ripple }, uFlow: { value: new THREE.Vector2(...flow) }, uGlint: { value: glint },
    }]),
    vertexShader: `attribute float aShore; varying float vShore; varying vec3 vWorld;
      ${WAVES}
      #include <fog_pars_vertex>
      void main() {
        vShore = aShore; vWorld = (modelMatrix * vec4(position, 1.)).xyz;
        vWorld.y += waveSum(vWorld.xz).x * smoothstep(0., .35, aShore);
        vec4 mvPosition = viewMatrix * vec4(vWorld, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight;
      uniform float uFoam; uniform float uReflect; uniform float uRipple; uniform float uGlint;
      varying float vShore; varying vec3 vWorld;
      ${WAVES}
      #include <fog_pars_fragment>
      float hash(vec2 p) { p = 50. * fract(p * .3183099 + vec2(.71, .113)); return -1. + 2. * fract(p.x * p.y * (p.x + p.y)); }
      // Value noise with analytic derivatives: (value, d/dx, d/dy), value in -1..1.
      vec3 noised(vec2 x) {
        vec2 i = floor(x), f = fract(x), u = f * f * (3. - 2. * f), du = 6. * f * (1. - f);
        float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
        return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
      }
      void main() {
        vec2 p = vWorld.xz;
        float edge = smoothstep(0., .35, vShore), depth = smoothstep(0., 1., vShore);
        vec2 drift = uFlow + vec2(.04, .03);
        vec3 w = waveSum(p) * edge;
        float hN = w.x / (1.12 * max(uAmp, 1e-3));
        // Scrolling ripple layers, each rotated a little so they never line up.
        vec3 n1 = noised(p * vec2(.42, .7) * uScale - drift * uTime * .55);
        vec3 n2 = noised(mat2(.8, -.6, .6, .8) * p * 1.15 * uScale + vec2(drift.y, -drift.x) * uTime * .25 - drift * uTime * .5);
        vec3 n3 = noised(mat2(.6, .8, -.8, .6) * p * 2.6 * uScale - drift * uTime * .9);
        vec2 grad = w.yz * 2.6 + (n1.yz * vec2(.42, .7) * .2 + n2.yz * .1 + n3.yz * .04) * uScale * uRipple * (.45 + .55 * edge);
        vec3 N = normalize(vec3(-grad.x, 1., -grad.y));
        vec3 camZ = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        vec3 V = isOrthographic ? camZ : normalize(cameraPosition - vWorld);
        vec3 L = normalize(uSunDir), R = reflect(-V, N);

        // Body colour: light shallows, deeper channel, lit crests and darker troughs.
        vec3 col = mix(uShallow, uDeep, depth);
        col *= mix(vec3(1.), vec3(.62, .74, .98), uNight * .85) * (1. - uNight * .72);
        col *= .86 + .2 * clamp(dot(N, L), 0., 1.) + .2 * hN;
        col = mix(col, col * 1.18 + vec3(.02, .03, .025), smoothstep(.35, 1., hN) * .55 * edge);

        // Fresnel sky reflection: hazy horizon, clearer zenith, warmer toward the sun.
        float fres = clamp(.08 + .8 * pow(1. - clamp(dot(N, V), 0., 1.), 2.6), 0., .6) * uReflect;
        float toSun = max(dot(R, L), 0.);
        vec3 sky = mix(uSky * 1.08, uSky * vec3(.82, .92, 1.06), clamp(R.y, 0., 1.)) * (1. - uNight * .6);
        // Night: lantern-warm low reflections under the cool moonlit sky.
        sky += vec3(.5, .3, .14) * (1. - clamp((R.y - .3) * 2., 0., 1.)) * uNight * .14;
        sky += uSun * pow(toSun, 5.) * .3 * (1. - uNight * .5);
        col = mix(col, sky, fres);

        // Glint and dancing sparkles (they twinkle where two drifting noise fields peak together).
        float spec = pow(toSun, 300.) * 1.25 + pow(toSun, 40.) * .1;
        vec2 sp = p * 2.3 * uScale;
        float tw = noised(sp + drift * uTime * 1.3).x * noised(sp * 1.37 - drift.yx * uTime * 1.1 + 7.3).x;
        float sparkle = smoothstep(.34, .5, tw) * pow(toSun, 14.) * edge;
        col += uSun * (spec + sparkle * .9) * uGlint * (1. - uNight * .5);
        // Foam: a broken line on the bank, bands lapping just off it, rare crest caps.
        float fn = noised(p * .9 * uScale + vec2(uTime * .12, -uTime * .08)).x;
        float shoreLine = 1. - smoothstep(.0, .09 + .04 * fn, vShore);
        float lap = smoothstep(.55, .95, sin(vShore * 70. - uTime * 1.6 + fn * 2.5)) * (1. - smoothstep(.08, .24, vShore)) * smoothstep(-.2, .4, fn);
        float caps = smoothstep(.82, 1., hN) * smoothstep(.15, .6, n2.x) * edge * .5;
        float foam = clamp(shoreLine * .75 + lap * .6 + caps, 0., 1.) * uFoam;
        col = mix(col, vec3(.9, .93, .88) * mix(1., .36, uNight), foam);

        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  Object.assign(material.uniforms, { uTime: windUniforms.uTime, uSky: waterUniforms.uSky, uNight: waterUniforms.uNight, uSun: waterUniforms.uSun, uSunDir: waterUniforms.uSunDir });
  waterMaterials.push(material);
  return material;
}

function surface(positions, shore, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  g.setIndex(indices); g.computeBoundingSphere(); return g;
}
function addMesh(scene, geometry, material) {
  const m = new THREE.Mesh(geometry, material); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m;
}

// Only surfaces that reach into `rect` (one map's built extent) are created.
// dispose() frees the surfaces and forgets their materials.
export function buildWater(scene, rect = BOUNDS) {
  const meshes = [];
  const add = (geometry, material) => { meshes.push(addMesh(scene, geometry, material)); };
  // The river flows east (+x) with real rolling waves; the smaller waters are calmer.
  const river = waterMaterial('#6a9580', '#3a6862', { foam: 1, amp: .2, ripple: .8, flow: [.55, .04] });
  const canal = waterMaterial('#6c8c74', '#4c7468', { foam: .8, scale: 1.2, reflect: .8, amp: .05, ripple: .7, flow: [.25, 0], glint: .6 });
  const stream = waterMaterial('#4d6458', '#33483f', { foam: .5, scale: 1.4, amp: .04, ripple: 1, flow: [.8, 0], glint: .6 });
  const paddy = waterMaterial('#6a8450', '#587a50', { foam: .2, scale: 1.6, reflect: .45, amp: .012, ripple: .35, flow: [0, 0], glint: .5 });
  const marsh = waterMaterial('#4f5f44', '#34442f', { foam: .25, scale: 1.3, reflect: .55, amp: .03, ripple: .6, flow: [.18, 0], glint: .45 });
  const materials = [river, canal, stream, paddy, marsh];

  const byKind = { river, canal, stream, paddy, marsh };
  for (const data of waterSurfaces(rect)) add(surface(data.positions, data.shore, data.indices), byKind[data.kind]);
  return {
    river, canal, stream, paddy, marsh, meshes,
    dispose() {
      for (const m of meshes) { m.removeFromParent(); m.geometry.dispose(); }
      for (const m of materials) { m.dispose(); const i = waterMaterials.indexOf(m); if (i >= 0) waterMaterials.splice(i, 1); }
    },
  };
}
