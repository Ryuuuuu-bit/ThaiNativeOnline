import * as THREE from 'three';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: .45 } };
// Canopies and roofs between the camera and the player are dithered away so the
// traveller never disappears under the orthographic view.
export const fadeUniforms = {
  uFadeCenter: { value: new THREE.Vector3() }, uFadeDir: { value: new THREE.Vector3(15, 23, 22).normalize() }, uFadeOn: { value: 1 },
};

export function patchMaterial(material, { wind = 0, instanced = false, fade = false } = {}) {
  // Chains an earlier patch (e.g. patchFoliage from src/shared/foliage.js).
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, windUniforms, fade ? fadeUniforms : {});
    // The same material may serve instanced and merged meshes (bark), so the
    // world position branches on the USE_INSTANCING define, not on the option.
    const world = 'patchWorld(transformed)';
    shader.vertexShader = `uniform float uTime; uniform float uWind;\n${fade ? 'varying vec3 vFadeWorld;\n' : ''}${shader.vertexShader}`
      .replace('void main() {', `vec3 patchWorld(vec3 p) {
        #ifdef USE_INSTANCING
          return (modelMatrix * instanceMatrix * vec4(p, 1.0)).xyz;
        #else
          return (modelMatrix * vec4(p, 1.0)).xyz;
        #endif
      }
      void main() {`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      ${wind ? `{ vec3 windPos = ${world};
        float gust = sin(uTime * 1.35 + windPos.x * .32 + windPos.z * .24) + .4 * sin(uTime * 2.1 + windPos.z * .7);
        float reach = ${instanced ? 'pow(max(position.y, 0.0), 1.5)' : '1.0'};
        transformed.x += gust * uWind * ${wind.toFixed(3)} * reach;
        transformed.z += cos(uTime + windPos.x * .4) * uWind * ${(wind * .4).toFixed(3)} * reach; }` : ''}
      ${fade ? `vFadeWorld = ${world};` : ''}`);
    if (fade) shader.fragmentShader = 'uniform vec3 uFadeCenter; uniform vec3 uFadeDir; uniform float uFadeOn; varying vec3 vFadeWorld;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 rel = vFadeWorld - uFadeCenter; float along = dot(rel, uFadeDir); float dist = length(rel - along * uFadeDir);
        float hide = uFadeOn * smoothstep(.4, 1.4, along) * (1. - smoothstep(1.7, 3.4, dist));
        // Ordered 8x8 dither (as in the forest): the middle clears fully, only the rim is feathered.
        vec2 px = floor(gl_FragCoord.xy);
        float b2 = fract(px.x * .5 + px.y * px.y * .75);
        vec2 p4 = floor(px * .5); float b4 = fract(p4.x * .5 + p4.y * p4.y * .75) * .25 + b2;
        vec2 p8 = floor(px * .25); float b8 = fract(p8.x * .5 + p8.y * p8.y * .75) * .0625 + b4;
        if (hide > b8 * .999) discard; }`);
  };
  material.customProgramCacheKey = () => `${previousKey()}|patch-${wind}-${instanced}-${fade}`;
  return material;
}
