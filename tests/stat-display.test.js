// The sheet shows stats RO style: a base from 1 plus the points put in, and the class / level /
// gear bonus on top (Character.statParts, src/character/ui/CharacterUI.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { STATS } from '../src/character/data/classes.js';

test('every stat starts at 1; the class, the levels and the gear show as a bonus', () => {
  for (const cls of ['muaythai', 'warrior', 'hunter', 'shaman', 'herbalist']) {
    const c = Character.create('ทดสอบ', cls);
    for (const k of STATS) {
      const p = c.statParts(k);
      assert.equal(p.base, 1, `${cls} ${k} starts at 1`); assert.ok(p.cls >= 0);
      assert.equal(p.base + p.bonus, c.stat(k), `${cls} ${k} adds up`);
    }
  }
  const c = Character.create('ทดสอบ', 'hunter'); c.gainExp(c.expNeeded); c.allocate('dex'); c.allocate('dex');
  const p = c.statParts('dex');
  assert.equal(p.base, 3); assert.equal(p.base + p.bonus, c.stat('dex'));
});
