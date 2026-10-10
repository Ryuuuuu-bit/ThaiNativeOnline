import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Emitter } from '../src/character/Emitter.js';
import { createViewPrefs } from '../src/ui/viewPrefs.js';
import { CombatView, MONSTER_STYLE } from '../src/combat/CombatView.js';

test('new and legacy device preferences stay 3D after unrelated or pixel updates', t => {
  let stored;
  const globals = {
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    document: { documentElement: { style: { setProperty() {} } }, body: { classList: { toggle() {} } } },
    innerWidth: 1600, innerHeight: 900, addEventListener() {},
  };
  for (const [key, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; });
  }
  for (const saved of [null, '{"monsters":"pixel","hud":1.2}', '{"monsters":"3d"}']) {
    stored = saved;
    const prefs = createViewPrefs();
    assert.equal(prefs.monsters, '3d');
    prefs.set({ hud: 1.3 });
    assert.equal(JSON.parse(stored).monsters, '3d');
    prefs.set({ monsters: 'pixel' });
    assert.equal(prefs.monsters, '3d');
    assert.equal(JSON.parse(stored).monsters, '3d');
    assert.equal(prefs.hud, 1.3);
  }
});

test('sprite-supported monsters load 3D models even after a legacy pixel restyle', async t => {
  const loads = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    loads.push(url);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    return { scene, animations: [] };
  });
  const monster = { id: '3d-boar', type: 'boar', alive: true, def: { shape: 'boar', color: '#647357', size: 2 } };
  const combat = new Emitter(); combat.monsters = [monster];
  const view = new CombatView(new THREE.Scene(), combat, () => 0);
  t.after(() => { for (const v of view.views.values()) view.disposeModel(v.group); });
  const initial = view.views.get(monster.id);
  await initial.group.userData.ready;
  assert.equal(initial.group.userData.modelLoaded, true);
  assert.equal(initial.group.scale.x, 2);
  assert.equal(initial.group.userData.face, undefined);
  assert.ok(loads.some(url => url.includes('/models/monsters/boar.glb')));
  view.restyle('pixel');
  const redrawn = view.views.get(monster.id);
  await redrawn.group.userData.ready;
  assert.notEqual(redrawn.group, initial.group);
  assert.equal(initial.group.parent, null);
  assert.equal(redrawn.monster, monster);
  assert.equal(redrawn.group.userData.modelLoaded, true);
  assert.equal(redrawn.group.userData.face, undefined);
  assert.equal(redrawn.group.scale.x, 2);
  assert.equal(MONSTER_STYLE, '3d');
  assert.equal(view.monsterById(monster.id), monster);
  assert.deepEqual(view.pickables, [redrawn.group]);
});
