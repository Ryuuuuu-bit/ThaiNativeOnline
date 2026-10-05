// Shared wind uniforms and the vertex-shader patch that sways foliage.
// (No three.js import: it only patches a material's shader.)
export const windUniforms = { uTime: { value: 0 }, uWind: { value: .45 } };

export function windMaterial(material, amplitude, instanced = false) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = windUniforms.uTime; shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = `uniform float uTime; uniform float uWind;\n${shader.vertexShader}`;
    const worldPos = instanced ? '(instanceMatrix * vec4(position, 1.0)).xyz' : '(modelMatrix * vec4(position, 1.0)).xyz';
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec3 windPos = ${worldPos};
      float gust = sin(uTime * 1.35 + windPos.x * 0.32 + windPos.z * 0.24) + 0.4 * sin(uTime * 2.1 + windPos.z * 0.7);
      transformed.x += gust * uWind * ${amplitude.toFixed(3)} * ${instanced ? 'pow(max(position.y, 0.0), 1.5)' : '1.0'};
      transformed.z += cos(uTime + windPos.x * 0.4) * uWind * ${(amplitude * .4).toFixed(3)};
    `);
  };
  material.customProgramCacheKey = () => `wind-${amplitude}-${instanced}`;
  return material;
}
