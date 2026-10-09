import test from 'node:test';
import assert from 'node:assert/strict';
import { MeshStandardMaterial, ShaderChunk } from 'three';
import { applyBossFog } from '../src/combat/BossMaterial.js';

test('boss fog retains both native fog modes and leaves shared materials untouched', () => {
  const source = new MeshStandardMaterial(), boss = source.clone();
  const sourceCompile = source.onBeforeCompile;
  applyBossFog(boss, .45);
  const shader = { fragmentShader: 'before\n#include <fog_fragment>\nafter' };
  boss.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('fogColor, fogFactor * 0.4500'));
  assert.ok(shader.fragmentShader.includes('FOG_EXP2'));
  assert.ok(shader.fragmentShader.includes('smoothstep( fogNear, fogFar, vFogDepth )'));
  assert.equal(source.onBeforeCompile, sourceCompile);
  assert.ok(ShaderChunk.fog_fragment.includes('fogColor, fogFactor )'));
  assert.equal(boss.fog, true);
  assert.notEqual(source.customProgramCacheKey(), boss.customProgramCacheKey());
});

test('untuned monsters retain their original shader and invalid fog scales fail closed', () => {
  const material = new MeshStandardMaterial(), compile = material.onBeforeCompile;
  applyBossFog(material);
  assert.equal(material.onBeforeCompile, compile);
  for (const scale of [NaN, Infinity, -1, 1.1]) assert.throws(() => applyBossFog(material, scale), RangeError);
});
