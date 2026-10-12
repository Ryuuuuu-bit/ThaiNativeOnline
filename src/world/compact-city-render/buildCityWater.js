import * as THREE from 'three';

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
    shader.fragmentShader = WAVES + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 cityWaterP = vCityWaterWorld.xz - uCityWaterOrigin;
      // Screen derivatives describe meters covered by a pixel, for perspective
      // and orthographic captures alike. Drop fine glints before they alias.
      vec2 cityWaterPixel = fwidth(vCityWaterWorld.xz);
      float cityWaterDetail = 1.0 - smoothstep(0.08, 0.28, max(cityWaterPixel.x, cityWaterPixel.y));
      vec3 cityWave = ${fountain ? 'cityWaterWaves(cityWaterP * 2.0)' : 'cityRiverWaves(cityWaterP, cityWaterDetail)'};
      ${fountain ? '' : 'cityWave += cityWaterDisturbance(vCityWaterWorld.xz) * cityWaterDetail;'}
      float cityBroad = sin(dot(cityWaterP, vec2(0.13, 0.08)) - uCityWaterTime * 0.08);
      float cityPools = sin(dot(cityWaterP, vec2(-0.055, 0.16)) + sin(cityWaterP.x * 0.09));
      float cityShallows = 1.0 - smoothstep(0.0, 9.0, max(vCityWaterWorld.z - uCityWaterShore, 0.0));
      vec3 cityWaterTint = mix(uCityWaterDeep, uCityWaterShallow,
        clamp(0.38 + cityBroad * 0.22 + cityPools * 0.12 + cityShallows * 0.14, 0.10, 0.85));
      diffuseColor.rgb = mix(diffuseColor.rgb, cityWaterTint, 0.65) * (0.97 + cityWave.x * 0.25);
      float cityFoam = 0.0;
      ${fountain ? `
        float cityRing = sin(length(cityWaterP) * 19.0 - uCityWaterTime * 1.5);
        cityFoam = smoothstep(0.89, 1.0, cityRing) * 0.11;
      ` : `
        float cityShoreDistance = max(vCityWaterWorld.z - uCityWaterShore, 0.0);
        float cityShorePhase = cityShoreDistance * 5.4 - uCityWaterTime * 0.80
          + sin(vCityWaterWorld.x * 0.72) * 0.60;
        cityFoam = (1.0 - smoothstep(0.15, 2.4, cityShoreDistance))
          * smoothstep(0.70, 0.97, sin(cityShorePhase)) * 0.22 * mix(0.6, 1.0, cityWaterDetail);
        float cityCrest = smoothstep(0.055, 0.085, cityWave.x);
        cityFoam += cityCrest * 0.015 * cityWaterDetail;
      `}
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.49, 0.65, 0.54), cityFoam);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Analytic slopes feed StandardMaterial's existing sun specular/shadows.
      // Keep broad highlights; tiny high-frequency normals cause shimmering.
      vec3 cityWaterNormal = normalize(vec3(-cityWave.y * ${fountain ? '0.75' : '1.0'},
        1.0, -cityWave.z * ${fountain ? '0.75' : '1.0'}));
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
      '#include <lights_fragment_end>\nreflectedLight.directSpecular *= 0.10 * mix(0.65, 1.0, cityWaterDetail);\nreflectedLight.indirectSpecular *= 0.16;');
  };
  material.customProgramCacheKey = function() { return `${key.call(this)}|city-water-v4-${mode}`; };
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
    stats: { cityWaterDraws: 1, cityWaterTextures: 0, cityWaterWaveBands: 4, cityWaterRippleSources: 4 },
    setRipples: surface.setRipples,
    update(t, dt, focus, env) { if (!disposed) surface.update(t, env); },
    dispose() {
      if (disposed) return; disposed = true;
      mesh.removeFromParent(); surface.dispose(); if (!geo) geometry.dispose();
    } };
}
