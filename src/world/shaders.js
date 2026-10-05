import * as THREE from 'three';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: .45 } };
// Canopies and roofs between the camera and the player are dithered away so the
// traveller never disappears under the orthographic view.
export const fadeUniforms = {
  uFadeCenter: { value: new THREE.Vector3() }, uFadeDir: { value: new THREE.Vector3(15, 23, 22).normalize() }, uFadeOn: { value: 1 },
};

export function patchMaterial(material, { wind = 0, instanced = false, fade = false } = {}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, windUniforms, fade ? fadeUniforms : {});
    const world = `(modelMatrix * ${instanced ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz`;
    shader.vertexShader = `uniform float uTime; uniform float uWind;\n${fade ? 'varying vec3 vFadeWorld;\n' : ''}${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      ${wind ? `{ vec3 windPos = ${world};
        float gust = sin(uTime * 1.35 + windPos.x * .32 + windPos.z * .24) + .4 * sin(uTime * 2.1 + windPos.z * .7);
        float reach = ${instanced ? 'pow(max(position.y, 0.0), 1.5)' : '1.0'};
        transformed.x += gust * uWind * ${wind.toFixed(3)} * reach;
        transformed.z += cos(uTime + windPos.x * .4) * uWind * ${(wind * .4).toFixed(3)} * reach; }` : ''}
      ${fade ? `vFadeWorld = ${world};` : ''}`);
    if (fade) shader.fragmentShader = 'uniform vec3 uFadeCenter; uniform vec3 uFadeDir; uniform float uFadeOn; varying vec3 vFadeWorld;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 rel = vFadeWorld - uFadeCenter; float along = dot(rel, uFadeDir); float dist = length(rel - along * uFadeDir);
        float hide = uFadeOn * smoothstep(.4, 1.4, along) * (1. - smoothstep(1.7, 3.4, dist));
        float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
        if (dither < hide * .85) discard; }`);
  };
  material.customProgramCacheKey = () => `patch-${wind}-${instanced}-${fade}`;
  return material;
}
