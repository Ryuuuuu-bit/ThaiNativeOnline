import * as THREE from 'three';

// Broadleaf foliage for Ayutthaya (first made for the snowy forest prototype)
// (src/world/Vegetation.js): dense clumps of small leaves whose texture stores data,
// not colour — R = leaf shade, G = snow mask, A = coverage. The per-instance colour
// tints the leaves, so one texture gives every tree its own hue and a darker,
// self-shaded interior.

// `rand()` → [0, 1). Pass the caller's seeded generator so its layout stays stable.
export function leafClumpTexture(rand, { snow = true } = {}) {
  const range = (a, b) => a + rand() * (b - a);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 100, x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
    ctx.save(); ctx.translate(x, y); ctx.rotate(range(-Math.PI, Math.PI));
    ctx.fillStyle = `rgb(${Math.floor(range(60, 235) - r * .5 + 40)},0,0)`;
    ctx.beginPath(); ctx.ellipse(0, 0, range(9, 18), range(4, 8), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if (snow) for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 80;
    ctx.fillStyle = 'rgba(230,255,0,.95)';
    ctx.beginPath(); ctx.ellipse(128 + Math.cos(a) * r, 120 + Math.sin(a) * r, range(6, 16), range(4, 8), range(0, 3), 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}

// Shade a data-texture material: leaves = instance colour × (0.32 + shade), snow
// (G × snow amount) stays white. Chains any earlier onBeforeCompile.
export function patchFoliage(material, snow = 0) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uSnow = { value: snow };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;')
      .replace('#include <map_fragment>', `
        vec4 leafData = texture2D(map, vMapUv);
        #if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)
          vec3 leafTint = vColor.rgb;
        #else
          vec3 leafTint = diffuse;
        #endif
        vec3 leaf = leafTint * (.32 + leafData.r * 1.05);
        diffuseColor.rgb = mix(leaf, vec3(.94, .96, 1.), clamp(leafData.g * uSnow, 0., 1.));
        diffuseColor.a *= leafData.a;`)
      .replace('#include <color_fragment>', '');
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}-foliage`;
  return material;
}
