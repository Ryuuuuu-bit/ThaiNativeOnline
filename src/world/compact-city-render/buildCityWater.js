import * as THREE from 'three';
import { waterUniforms } from '../Water.js';

// Four analytic wave bands: no reflection pass, texture, vertex tessellation,
// transparency sorting, navigation change or per-frame geometry allocation.
const WAVES = `
uniform float uCityWaterTime;
uniform float uCityWaterNight;
uniform float uCityWaterShore;
uniform vec2 uCityWaterOrigin;
uniform vec3 uCityWaterDeep;
uniform vec3 uCityWaterShallow;
uniform vec4 uCityWaterRipples[4];
varying vec3 vCityWaterWorld;
vec3 cityWaterBand(vec2 p, vec2 direction, float frequency, float speed, float amplitude) {
  float phase = dot(p, direction) * frequency - uCityWaterTime * speed;
  return vec3(sin(phase) * amplitude, direction * cos(phase) * amplitude * frequency);
}
vec3 cityWaterWaves(vec2 p) {
  return cityWaterBand(p, vec2(0.94, 0.342), 0.72, 0.62, 0.065)
    + cityWaterBand(p, vec2(-0.45, 0.893), 1.38, 0.83, 0.035)
    + cityWaterBand(p, vec2(0.707, -0.707), 2.80, 1.12, 0.018)
    + cityWaterBand(p, vec2(0.196, 0.981), 4.10, 1.43, 0.009);
}
vec3 cityRiverWaves(vec2 p, float fineDetail) {
  // Slow, large domain bends prevent regular crossings from reading as cloth.
  float bendX = p.y * 0.19 + uCityWaterTime * 0.047;
  float bendZ = p.x * 0.13 - uCityWaterTime * 0.031;
  vec2 warped = p + vec2(sin(bendX) * 1.4, sin(bendZ) * 1.1);
  vec3 wave = cityWaterBand(warped, vec2(0.930, 0.368), 0.637, 0.43, 0.040)
    + cityWaterBand(warped, vec2(-0.523, 0.852), 1.173, 0.71, 0.026)
    + cityWaterBand(warped, vec2(0.813, -0.582), 2.617, 1.03, 0.008 * fineDetail)
    + cityWaterBand(warped, vec2(0.257, 0.966), 4.137, 1.37, 0.004 * fineDetail);
  // Chain rule keeps normals faithful to the bent wave field.
  return vec3(wave.x, wave.y + wave.z * cos(bendZ) * 0.143,
    wave.z + wave.y * cos(bendX) * 0.266);
}
vec3 cityWaterDisturbance(vec2 worldP) {
  vec3 result = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 source = uCityWaterRipples[i];
    vec2 offset = worldP - source.xy;
    float distanceToSource = max(length(offset), 0.03);
    float radius = max(source.z, 0.1);
    float envelope = max(0.0, 1.0 - distanceToSource / radius);
    float phase = distanceToSource * 6.0 - uCityWaterTime * 1.30 + float(i) * 1.7;
    float height = sin(phase) * envelope * envelope * source.w;
    float slope = (cos(phase) * 6.0 * envelope * envelope
      - sin(phase) * 2.0 * envelope / radius) * source.w;
    result += vec3(height, offset / distanceToSource * slope);
  }
  return result;
}
`;

// Adapted from world/Water.js: scrolling value noise with analytic slopes,
// Fresnel sky colour and sparse sun glints. No scene reflection render/texture.
const RIVER_LIGHT = `
uniform vec3 uCityWaterSky;
uniform vec3 uCityWaterSun;
uniform vec3 uCityWaterSunDir;
float cityWaterHash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
}
vec3 cityWaterNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = cityWaterHash(i), b = cityWaterHash(i + vec2(1.0, 0.0));
  float c = cityWaterHash(i + vec2(0.0, 1.0)), d = cityWaterHash(i + vec2(1.0));
  return vec3(a + (b-a)*u.x + (c-a)*u.y + (a-b-c+d)*u.x*u.y,
    du * (vec2(b-a, c-a) + (a-b-c+d)*u.yx));
}
`;

// When mat is supplied Main owns this material, even on failure. Otherwise the
// controller owns it. update(t, env) borrows only numbers from Environment.state.
export function createCityWaterMaterial({ mat, mode = 'river', shoreZ = 64.65,
  x = 0, z = 99.65, ripples } = {}) {
  const fountain = mode === 'fountain';
  const material = mat ? mat('#438f89', { roughness: .38, metalness: .02 })
    : new THREE.MeshStandardMaterial({ color: '#438f89', roughness: .38, metalness: .02 });
  const uniforms = {
    uCityWaterTime: { value: 0 }, uCityWaterNight: { value: 0 },
    uCityWaterShore: { value: shoreZ }, uCityWaterOrigin: { value: new THREE.Vector2(x, z) },
    uCityWaterDeep: { value: new THREE.Color('#347d80') },
    uCityWaterShallow: { value: new THREE.Color('#70aaa0') },
    uCityWaterRipples: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  };
  // Borrow Environment's existing sky/sun values; never mutate them or join
  // Water.js's shared material registry. Fountain keeps its previous uniforms.
  if (!fountain) Object.assign(uniforms, {
    uCityWaterSky: waterUniforms.uSky,
    uCityWaterSun: waterUniforms.uSun,
    uCityWaterSunDir: waterUniforms.uSunDir,
  });
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  let disposed = false;
  function setRipples(sources = []) {
    if (disposed) return;
    for (let i = 0; i < 4; i++) {
      const source = sources[i], target = uniforms.uCityWaterRipples.value[i];
      if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.z)
        || !Number.isFinite(source.radius) || !Number.isFinite(source.strength)) {
        target.set(0, 0, 1, 0); continue;
      }
      target.set(source.x, source.z, THREE.MathUtils.clamp(source.radius, .1, 12),
        THREE.MathUtils.clamp(source.strength, 0, .035));
    }
  }
  // World-space anchors match existing pier posts and hulls. Main may replace
  // them with setRipples; no meshes, collision or shared resources are touched.
  setRipples(ripples ?? (fountain ? [] : [
    { x: -7, z: 65, radius: 2.2, strength: .018 },
    { x: 7, z: 65, radius: 2.2, strength: .018 },
    { x: -20, z: 75, radius: 4.8, strength: .015 },
    { x: -10, z: 70, radius: 3.8, strength: .012 },
  ]));
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vCityWaterWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 cityWaterLocal = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cityWaterLocal = instanceMatrix * cityWaterLocal;
      #endif
      vCityWaterWorld = (modelMatrix * cityWaterLocal).xyz;
      #include <project_vertex>`);
    shader.fragmentShader = WAVES + (fountain ? '' : RIVER_LIGHT) + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 cityWaterP = vCityWaterWorld.xz - uCityWaterOrigin;
      // Screen derivatives describe meters covered by a pixel, for perspective
      // and orthographic captures alike. Drop fine glints before they alias.
      vec2 cityWaterPixel = fwidth(vCityWaterWorld.xz);
      float cityWaterDetail = 1.0 - smoothstep(0.08, 0.28, max(cityWaterPixel.x, cityWaterPixel.y));
      vec3 cityWave = ${fountain ? 'cityWaterWaves(cityWaterP * 2.0)' : 'cityRiverWaves(cityWaterP, cityWaterDetail)'};
      ${fountain ? '' : 'cityWave += cityWaterDisturbance(vCityWaterWorld.xz) * cityWaterDetail;'}
      ${fountain ? '' : `
        // Daytime reflections were reading as white marble; retain the existing
        // evening response while halving the bright overlay under sunshine.
        float cityBrightGain = mix(0.50, 1.0, smoothstep(0.0, 0.12, uCityWaterNight));
        vec2 cityDrift = vec2(0.55, 0.04) * uCityWaterTime;
        vec3 cityNoise1 = cityWaterNoise(cityWaterP * vec2(0.42, 0.70) - cityDrift * 0.55);
        vec3 cityNoise2 = cityWaterNoise(mat2(0.8, -0.6, 0.6, 0.8) * cityWaterP * 1.15
          - cityDrift * 0.50 + cityDrift.yx * vec2(0.25, -0.25));
        vec3 cityNoise3 = cityWaterNoise(mat2(0.6, 0.8, -0.8, 0.6) * cityWaterP * 2.6 - cityDrift * 0.9);
        vec2 cityRiverSlope = cityWave.yz * 1.65
          + cityNoise1.yz * vec2(0.42, 0.70) * 0.16
          + mat2(0.8, 0.6, -0.6, 0.8) * cityNoise2.yz * 0.075 * cityWaterDetail
          + mat2(0.6, -0.8, 0.8, 0.6) * cityNoise3.yz * 0.025 * cityWaterDetail;
      `}
      float cityBroad = sin(dot(cityWaterP, vec2(0.13, 0.08)) - uCityWaterTime * 0.08);
      float cityPools = sin(dot(cityWaterP, vec2(-0.055, 0.16)) + sin(cityWaterP.x * 0.09));
      float cityShallows = 1.0 - smoothstep(0.0, 9.0, max(vCityWaterWorld.z - uCityWaterShore, 0.0));
      vec3 cityWaterTint = mix(uCityWaterDeep, uCityWaterShallow,
        clamp(0.38 + cityBroad * 0.22 + cityPools * 0.12 + cityShallows * 0.14, 0.10, 0.85));
      diffuseColor.rgb = mix(diffuseColor.rgb, cityWaterTint, 0.65) * (0.97 + cityWave.x * 0.25);
      ${fountain ? '' : `
        // Crest/trough contrast, with irregular moving pools between wave bands.
        diffuseColor.rgb *= 0.92 + 0.15 * clamp(cityWave.x / 0.10, -1.0, 1.0)
          + cityNoise1.x * 0.055 + cityNoise2.x * 0.025;
      `}
      float cityFoam = 0.0;
      ${fountain ? `
        float cityRing = sin(length(cityWaterP) * 19.0 - uCityWaterTime * 1.5);
        cityFoam = smoothstep(0.89, 1.0, cityRing) * 0.11;
      ` : `
        float cityShoreDistance = max(vCityWaterWorld.z - uCityWaterShore, 0.0);
        float cityShorePhase = cityShoreDistance * 5.4 - uCityWaterTime * 0.80
          + cityNoise1.x * 2.5;
        cityFoam = (1.0 - smoothstep(0.15, 2.4, cityShoreDistance))
          * smoothstep(0.70, 0.97, sin(cityShorePhase)) * 0.22 * mix(0.6, 1.0, cityWaterDetail);
        float cityCrest = smoothstep(0.055, 0.085, cityWave.x);
        cityFoam += cityCrest * 0.015 * cityWaterDetail;
        cityFoam *= cityBrightGain;
      `}
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.49, 0.65, 0.54), cityFoam);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Analytic slopes feed StandardMaterial's existing sun specular/shadows.
      // Keep broad highlights; tiny high-frequency normals cause shimmering.
      vec3 cityWaterNormal = ${fountain ? 'normalize(vec3(-cityWave.y * 0.75, 1.0, -cityWave.z * 0.75))' : 'normalize(vec3(-cityRiverSlope.x, 1.0, -cityRiverSlope.y))'};
      normal = normalize(mat3(viewMatrix) * cityWaterNormal);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + abs(cityWave.x) * 0.5
        + uCityWaterNight * 0.06, 0.36, 0.50);
    `);
    // The orthographic port view catches a broad sun lobe. Keep its moving
    // glints subordinate to turquoise diffuse water instead of a milky sheet.
    if (!fountain) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular *= 0.10 * mix(0.65, 1.0, cityWaterDetail) * cityBrightGain;\nreflectedLight.indirectSpecular *= 0.16 * cityBrightGain;');
    if (!fountain) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      // Correct view direction for the orthographic gameplay camera, as in the
      // legacy river. A position-to-camera ray would distort reflection bands.
      vec3 cityView = isOrthographic
        ? normalize(vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]))
        : normalize(cameraPosition - vCityWaterWorld);
      vec3 cityN = cityWaterNormal;
      vec3 cityL = normalize(uCityWaterSunDir), cityR = reflect(-cityView, cityN);
      float cityFacing = clamp(dot(cityN, cityView), 0.0, 1.0);
      float cityFresnel = min(0.045 + 0.30 * pow(1.0-cityFacing, 2.6), 0.22);
      float cityToSun = max(dot(cityR, cityL), 0.0);
      vec3 citySky = mix(uCityWaterSky * 0.82,
        uCityWaterSky * vec3(0.68, 0.80, 0.95), clamp(cityR.y, 0.0, 1.0));
      citySky *= 1.0 - uCityWaterNight * 0.55;
      citySky += uCityWaterSun * pow(cityToSun, 5.0) * 0.055;
      // Cap the reflected sky separately; never bleach the whole water body.
      outgoingLight = mix(outgoingLight, min(citySky, vec3(0.55, 0.62, 0.64)), cityFresnel * cityBrightGain);
      float cityGlintFilter = (1.0-smoothstep(0.004, 0.020, fwidth(cityToSun))) * cityWaterDetail;
      float cityGlint = pow(cityToSun, 160.0) * 0.16 + pow(cityToSun, 40.0) * 0.012;
      float cityTwinkle = smoothstep(mix(0.50, 0.38, smoothstep(0.0, 0.12, uCityWaterNight)), 0.60,
        cityNoise2.x * cityNoise3.x) * pow(cityToSun, 14.0) * 0.07;
      outgoingLight += uCityWaterSun * (cityGlint + cityTwinkle) * cityGlintFilter
        * (1.0-uCityWaterNight*0.65) * cityBrightGain;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = function() { return `${key.call(this)}|city-water-v6-${mode}`; };
  return { material, uniforms, setRipples,
    update(t, env) {
      if (disposed) return;
      if (Number.isFinite(t)) uniforms.uCityWaterTime.value = t;
      const night = env?.night;
      if (Number.isFinite(night)) uniforms.uCityWaterNight.value = THREE.MathUtils.clamp(night, 0, 1);
    },
    dispose() { if (disposed) return; disposed = true; if (!mat) material.dispose(); } };
}

// Replace the old river AND box-ripple group with this one opaque draw. Supplied
// mat/geo factories must register allocations before returning, as buildCityArt
// does. Main's disposer remains authoritative; this dispose only detaches mesh.
export function buildCityWater({ root, mat, geo, width = 200, depth = 70,
  x = 0, z = 99.65, y = -.32, shoreZ = z - depth / 2, ripples } = {}) {
  if (!root?.isObject3D) throw new Error('City water requires a root');
  if (!!mat !== !!geo) throw new Error('City water requires both owned mat/geo factories or neither');
  let surface, geometry, mesh, disposed = false;
  try {
    surface = createCityWaterMaterial({ mat, shoreZ, x, z, ripples });
    geometry = new THREE.PlaneGeometry(width, depth);
    if (geo) geometry = geo(geometry);
    mesh = new THREE.Mesh(geometry, surface.material);
    mesh.name = 'compact-city-river'; mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z); mesh.castShadow = false; mesh.receiveShadow = true;
    root.add(mesh);
  } catch (error) {
    mesh?.removeFromParent(); surface?.dispose(); if (!geo) geometry?.dispose(); throw error;
  }
  return { mesh, material: surface.material, uniforms: surface.uniforms,
    stats: { cityWaterDraws: 1, cityWaterTextures: 0, cityWaterWaveBands: 4, cityWaterRippleSources: 4,
      cityWaterRippleLayers: 3, cityWaterSkyReflection: true },
    setRipples: surface.setRipples,
    update(t, dt, focus, env) { if (!disposed) surface.update(t, env); },
    dispose() {
      if (disposed) return; disposed = true;
      mesh.removeFromParent(); surface.dispose(); if (!geo) geometry.dispose();
    } };
}
