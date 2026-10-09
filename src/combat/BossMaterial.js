import { ShaderChunk } from 'three';

// The orthographic camera puts combatants at almost the same fog depth as the
// distant ground. Retain atmospheric tint while preserving boss colour blocks.
// Called only on an instance-owned material; cached source materials stay intact.
export function applyBossFog(material, scale) {
  if (scale === undefined) return;
  if (!Number.isFinite(scale) || scale < 0 || scale > 1) throw new RangeError('Fog contribution must be in 0..1');
  const chunk = ShaderChunk.fog_fragment.replace('fogColor, fogFactor', `fogColor, fogFactor * ${scale.toFixed(4)}`);
  if (!chunk.includes(`fogFactor * ${scale.toFixed(4)}`)) throw new Error('Unsupported fog shader');
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', chunk);
  };
  material.customProgramCacheKey = () => `boss-fog-${scale.toFixed(4)}`;
}
