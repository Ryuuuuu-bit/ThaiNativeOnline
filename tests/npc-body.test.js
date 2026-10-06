// Townsfolk bodies: every part builds a clean geometry, every look resolves its colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PARTS } from '../src/npc/NPCRenderer.js';
import { merge } from '../src/npc/body/shape.js';
import { kneeBend, elbowBend, straightRightArm, FRAMES } from '../src/npc/body/rig.js';
import { makeLook } from '../src/npc/NPCData.js';
import { NPCS } from '../src/data/npcs.js';

test('every body part, garment and prop builds a finite geometry with colour', () => {
  for (const def of PARTS) {
    const g = merge(def.geo()), p = g.attributes.position.array;
    assert.ok(g.attributes.normal && g.attributes.color, `${def.name}: normal + color`);
    assert.ok(p.length >= 9 && p.every(Number.isFinite), `${def.name}: finite triangles`);
    for (const f of def.frames) assert.ok(FRAMES.includes(f), `${def.name}: frame ${f}`);
  }
});

test('looks are deterministic and every worn part gets a colour', () => {
  for (const def of NPCS) {
    const look = makeLook(def);
    assert.deepEqual(makeLook(def), look, def.id);
    assert.ok(look.trim && look.hairStyle, `${def.id}: trim + hairStyle`);
    for (const part of PARTS) if (!part.when || part.when(look)) for (const f of part.frames) assert.match(part.color(look, f), /^#[0-9a-f]{6}$/i, `${def.id}: ${part.name}`);
  }
});

test('women wear a สไบ unless in a sleeved shirt; monks never wear a shirt', () => {
  const sabai = PARTS.find(p => p.name === 'sabai');
  assert.ok(sabai.when(makeLook({ id: 't1', occupation: 'merchant', gender: 'f' })));
  assert.ok(!sabai.when(makeLook({ id: 't2', occupation: 'guard', gender: 'f' })));
  assert.equal(makeLook({ id: 't3', occupation: 'monk' }).shirt, false);
});

test('implied joints: knees bend on the back swing and when seated, long tools keep the arm straight', () => {
  assert.equal(kneeBend(-.4, false), 0);
  assert.ok(kneeBend(.4, false) > 0);
  assert.ok(kneeBend(-1.45, true) > 0);
  assert.ok(elbowBend(-1.2) > elbowBend(0));
  assert.ok(straightRightArm({ props: ['spear'] }) && !straightRightArm({ props: ['hammer'] }));
});
