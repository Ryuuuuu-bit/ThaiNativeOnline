import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyMonsterFeedback, monsterFeedbackState } from '../src/combat/MonsterFeedback.js';

test('pure selection preserves inputs and existing hit/status priority', () => {
  const base = Object.freeze({ emissive: new THREE.Color('#8a6b42'), emissiveIntensity: .35, emissiveMap: {} });
  const flags = Object.freeze({ flash: .1, cursed: true, stunned: true, slowed: true });
  assert.deepEqual(monsterFeedbackState(base, flags), { emissive: '#ff6040', emissiveIntensity: 1, emissiveMap: null });
  assert.equal(monsterFeedbackState(base, { cursed: true, stunned: true, slowed: true }).emissive, '#4a1a5e');
  assert.equal(monsterFeedbackState(base, { stunned: true, slowed: true }).emissive, '#4a4214');
  assert.equal(monsterFeedbackState(base, { slowed: true }).emissive, '#1e3e58');
  assert.deepEqual(monsterFeedbackState(base), base);
  assert.equal(base.emissiveIntensity, .35);
});

test('painted .35 fill returns exactly after repeated hits and status transitions', () => {
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ color: '#abc382', emissive: '#638b48', emissiveIntensity: .35, map: texture, emissiveMap: texture });
  const fill = material.emissive.clone(), rgb = material.color.clone();
  let disposals = 0; texture.addEventListener('dispose', () => disposals++);
  const startVersion = material.version;
  applyMonsterFeedback(material, { flash: .1 });
  assert.ok(material.emissive.equals(new THREE.Color('#ff6040')));
  assert.equal(material.emissiveIntensity, 1); assert.equal(material.emissiveMap, null);
  assert.equal(material.version, startVersion + 1);
  applyMonsterFeedback(material, { flash: .05 });
  applyMonsterFeedback(material, { cursed: true });
  assert.equal(material.version, startVersion + 1, 'active feedback does not recompile every frame');
  applyMonsterFeedback(material, {});
  assert.ok(material.emissive.equals(fill)); assert.equal(material.emissiveIntensity, .35);
  assert.equal(material.emissiveMap, texture); assert.equal(material.map, texture);
  assert.ok(material.color.equals(rgb)); assert.equal(material.version, startVersion + 2);
  applyMonsterFeedback(material, {});
  assert.equal(material.version, startVersion + 2); assert.equal(disposals, 0);
});

test('zero and default emissive profiles flash at one and restore their own baseline', () => {
  for (const intensity of [0, 1]) {
    const material = new THREE.MeshStandardMaterial({ emissiveIntensity: intensity });
    applyMonsterFeedback(material, { stunned: true });
    assert.equal(material.emissiveIntensity, 1); assert.equal(material.emissiveMap, null);
    applyMonsterFeedback(material, {});
    assert.equal(material.emissive.getHex(), 0); assert.equal(material.emissiveIntensity, intensity);
  }
});

test('strong original glow retains its intensity during broad feedback', () => {
  const material = new THREE.MeshStandardMaterial({ emissive: '#6699bb', emissiveIntensity: 1.6 });
  applyMonsterFeedback(material, { slowed: true });
  assert.equal(material.emissiveIntensity, 1.6);
  applyMonsterFeedback(material, {});
  assert.ok(material.emissive.equals(new THREE.Color('#6699bb'))); assert.equal(material.emissiveIntensity, 1.6);
});

test('material arrays handle non-emissive entries and keep neighbouring clones isolated', () => {
  const texture = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial({ emissive: '#447744', emissiveIntensity: .35, emissiveMap: texture });
  const clone = source.clone(), basic = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  applyMonsterFeedback([clone, basic, null], { flash: .1 });
  assert.equal(clone.emissiveMap, null); assert.equal(source.emissiveMap, texture);
  assert.equal(source.emissiveIntensity, .35); assert.ok(source.emissive.equals(new THREE.Color('#447744')));
  assert.equal(basic.color.getHex(), 0xffffff);
  applyMonsterFeedback([clone, basic], {});
  assert.equal(clone.emissiveMap, texture); assert.equal(clone.emissiveIntensity, .35);
});

test('death dimming owns RGB while feedback changes only emissive', () => {
  const material = new THREE.MeshStandardMaterial({ color: '#b4aa87', emissive: '#b4aa87', emissiveIntensity: .35 });
  const dimmed = material.color.clone().multiplyScalar(.4); material.color.copy(dimmed);
  applyMonsterFeedback(material, { flash: .1, cursed: true });
  assert.ok(material.color.equals(dimmed));
  material.color.multiplyScalar(.5); const laterDimmed = material.color.clone();
  applyMonsterFeedback(material, { cursed: true }); applyMonsterFeedback(material, {});
  assert.ok(material.color.equals(laterDimmed)); assert.equal(material.emissiveIntensity, .35);
});
