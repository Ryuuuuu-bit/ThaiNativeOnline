import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Character } from '../src/character/Character.js';
import { CLASSES, START_ITEMS } from '../src/character/data/classes.js';
import { fromSave } from '../server/progress.js';
import { Combatants } from '../server/combatants.js';

test('every old class receives missing starter equipment once through server load', () => {
  for (const classId of Object.keys(CLASSES)) {
    const old = new Character({ name: 'Old', classId });
    const migrated = fromSave(old.toJSON());
    for (const id of START_ITEMS[classId]) assert.ok(Object.values(migrated.equipment).includes(id), `${classId}: ${id}`);
    assert.equal(migrated.starterEquipmentVersion, 1);
    migrated.unequip('weapon');
    const index = migrated.inventory.findIndex(x => x?.id === START_ITEMS[classId][0]);
    migrated.inventory[index] = null;
    const again = fromSave(migrated.toJSON());
    assert.equal(again.equipment.weapon, null);
    assert.ok(!again.inventory.some(x => x?.id === START_ITEMS[classId][0]));
  }
});

test('backfill preserves upgraded gear, existing bag items, vitals and full bags', () => {
  const c = new Character({ name: 'Old', classId: 'warrior', equipment: { weapon: 'iron_dap' }, refine: { weapon: 4 }, hp: 1, inventory: Array.from({ length: 24 }, () => ({ id: 'hide', qty: 1 })) });
  c.grantMissingStarterEquipment();
  assert.equal(c.equipment.weapon, 'iron_dap'); assert.equal(c.refine.weapon, 4);
  assert.equal(c.equipment.armor, 'cloth_vest'); assert.equal(c.hp, 1);
  assert.equal(c.inventory.filter(x => x?.id === 'hide').length, 24);
  const bagged = new Character({ name: 'Bag', classId: 'shaman', inventory: [{ id: 'reed_wand', qty: 1, plus: 2 }] });
  bagged.grantMissingStarterEquipment();
  assert.equal(bagged.inventory.filter(x => x?.id === 'reed_wand').length, 1);
  assert.equal(bagged.inventory.find(x => x?.id === 'reed_wand').plus, 2);
});

test('server queues migrated old characters for saving and new characters are already marked', () => {
  const cs = new Combatants();
  cs.load(1, new Character({ name: 'Old', classId: 'hunter' }).toJSON(), { account: 'old', slot: 0 });
  assert.equal(cs.get(1).dirty, true);
  assert.equal(Character.create('New', 'hunter').starterEquipmentVersion, 1);
});
