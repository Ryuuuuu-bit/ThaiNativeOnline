import * as THREE from 'three';
import { patchMaterial, windUniforms } from '../shaders.js';

// Global time/wind are borrowed, never disposed or reset by a city build.
const WIND = `
vec3 cityWindWorld(vec3 p) {
  #ifdef USE_INSTANCING
    return (modelMatrix * instanceMatrix * vec4(p, 1.0)).xyz;
  #else
    return (modelMatrix * vec4(p, 1.0)).xyz;
  #endif
}
vec3 cityWindLocal(vec3 delta) {
  mat3 basis = mat3(modelMatrix);
  #ifdef USE_INSTANCING
    basis = basis * mat3(instanceMatrix);
  #endif
  // Columns are orthogonal for our rotation/scale instances. Undo scale too,
  // so a large crown and small leaf tip move by the same measured world amount.
  return vec3(dot(delta, basis[0]) / max(dot(basis[0], basis[0]), 0.00001),
    dot(delta, basis[1]) / max(dot(basis[1], basis[1]), 0.00001),
    dot(delta, basis[2]) / max(dot(basis[2], basis[2]), 0.00001));
}
`;

export function applyCityFoliageWind(material, { fade = true } = {}) {
  if (material.userData.cityFoliageWind) return material;
  material.userData.cityFoliageWind = { fade };
  const previous = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = function(shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.uCityWindTime = windUniforms.uTime;
    shader.uniforms.uCityWindStrength = windUniforms.uWind;
    shader.vertexShader = 'uniform float uCityWindTime; uniform float uCityWindStrength;\n'
      + shader.vertexShader.replace('void main() {', WIND + '\nvoid main() {');
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec3 cityWindPosition = cityWindWorld(transformed);
      float cityWindReach = smoothstep(2.4, 6.5, cityWindPosition.y);
      float cityWindGust = sin(uCityWindTime * 0.48 + cityWindPosition.x * 0.13
        + cityWindPosition.z * 0.09);
      float cityWindFlutter = sin(uCityWindTime * 1.7 + cityWindPosition.x * 1.3
        + cityWindPosition.z * 0.9) * 0.018;
      float cityWindAmount = clamp(uCityWindStrength, 0.0, 1.0) * cityWindReach;
      vec3 cityWindDelta = vec3(0.15 * cityWindGust + cityWindFlutter, 0.0,
        0.055 * sin(uCityWindTime * 0.39 + cityWindPosition.x * 0.08));
      transformed += cityWindLocal(cityWindDelta * cityWindAmount);
      ${fade ? 'vFadeWorld = cityWindWorld(transformed);' : ''}
      #include <project_vertex>`);
  };
  material.customProgramCacheKey = function() { return `${key.call(this)}|city-wind-v2-${fade}`; };
  return material;
}

// Call AFTER StaticBatcher/InstanceSet assembly. Borrowed surface materials are
// untouched. Pass ownMaterial to register depth/distance materials with Main's
// disposer; without it this controller owns them. Call dispose before root clear.
export function attachCityFoliageShadows(root, { ownMaterial } = {}) {
  const resources = new Set(), bindings = [], cache = new Map();
  let disposed = false;
  try {
    root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.castShadow || !mesh.material?.userData.cityFoliageWind) return;
      let pair = cache.get(mesh.material);
      if (!pair) {
        const fade = mesh.material.userData.cityFoliageWind.fade;
        pair = [new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
          new THREE.MeshDistanceMaterial()];
        for (const m of pair) {
          resources.add(m); if (ownMaterial) ownMaterial(m);
          m.side = mesh.material.side;
          patchMaterial(m, { fade }); applyCityFoliageWind(m, { fade });
        }
        cache.set(mesh.material, pair);
      }
      bindings.push([mesh, mesh.customDepthMaterial, mesh.customDistanceMaterial]);
      [mesh.customDepthMaterial, mesh.customDistanceMaterial] = pair;
    });
  } catch (error) {
    for (const [mesh, depth, distance] of bindings) {
      mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance;
    }
    if (!ownMaterial) for (const m of resources) m.dispose();
    throw error;
  }
  return { materials: resources.size, meshes: bindings.length,
    dispose() {
      if (disposed) return; disposed = true;
      for (const [mesh, depth, distance] of bindings) {
        mesh.customDepthMaterial = depth; mesh.customDistanceMaterial = distance;
      }
      if (!ownMaterial) for (const m of resources) m.dispose();
      bindings.length = 0; resources.clear(); cache.clear();
    } };
}
