import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Character } from '../src/character/Character.js';
import { sortedInventory, gearScore, compareToWorn } from '../src/character/bag.js';
import { ITEMS } from '../src/character/data/items.js';
import { Emitter } from '../src/character/Emitter.js';
import { attachNetProgress } from '../src/net/NetProgress.js';

const url = new URL('../src/character/ui/InventoryWorkspace.js', import.meta.url);
const source = (await readFile(url, 'utf8')).replace(/import '\.\/[^']+\.css';/g, '')
  .replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, url).href}'`);
const { InventoryWorkspace, compareToEquipped, equipDestination } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness() {
  const c = Character.create('QA', 'warrior');
  const host = () => ({ hidden: true, innerHTML: '', querySelectorAll: () => [], scrollIntoView() {} });
  const panel = Object.create(InventoryWorkspace.prototype);
  Object.assign(panel, { ui: { c, detail: host(), grid: host(), sheet: host(), cardPick: host(), feed: { log() {} }, openCardPick(i) { this.picked = i; } },
    wornDetail: host(), renderCard: item => `<div>${item.id}</div>`, labels: { weapon: 'weapon', charm: 'charm', charm2: 'charm2' } });
  return { c, panel };
}

test('selecting consumables and equipment does not mutate the character', () => {
  const { c, panel } = harness(); c.addItem('potion_s', 3); c.addItem('iron_dap');
  const before = JSON.stringify(c.toJSON());
  panel.select(c.inventory.findIndex(s => s?.id === 'potion_s'));
  assert.match(panel.ui.detail.innerHTML, /data-item-action="use"/);
  panel.select(c.inventory.findIndex(s => s?.id === 'iron_dap'));
  assert.match(panel.ui.detail.innerHTML, /data-item-action="equip"/);
  assert.equal(JSON.stringify(c.toJSON()), before);
});

test('explicit use consumes once, and a repeated action has no selection', () => {
  const { c, panel } = harness(); c.addItem('potion_s', 3); c.hp = 1;
  const count = c.count('potion_s');
  panel.select(c.inventory.findIndex(s => s?.id === 'potion_s')); panel.act('use'); panel.act('use');
  assert.equal(c.count('potion_s'), count - 1); assert.equal(panel.selected, null);
});

test('sorting or authoritative replacement invalidates an old selection', () => {
  const { c, panel } = harness(); c.addItem('hide'); c.addItem('iron_dap');
  const index = c.inventory.findIndex(s => s?.id === 'hide'); panel.select(index);
  c.inventory = sortedInventory(c.inventory);
  const before = JSON.stringify(c.toJSON()); panel.act('use');
  assert.equal(JSON.stringify(c.toJSON()), before); assert.equal(panel.selected, null);
  const weapon = c.inventory.findIndex(s => s?.id === 'iron_dap'); panel.select(weapon);
  c.inventory[weapon] = { ...c.inventory[weapon], plus: 4 }; panel.act('equip');
  assert.notEqual(c.equipment.weapon, 'iron_dap'); assert.equal(panel.selected, null);
});

test('selected locked gear still equips and retains its lock', () => {
  const { c, panel } = harness(); c.addItem('iron_dap');
  const index = c.inventory.findIndex(s => s?.id === 'iron_dap'); c.setItemLock(index, true);
  panel.select(index); panel.act('equip');
  assert.equal(c.equipment.weapon, 'iron_dap'); assert.equal(c.isLocked('weapon'), true);
});

test('worn selection requires explicit removal and refuses a full bag', () => {
  const { c, panel } = harness(); const before = c.equipment.weapon;
  panel.select(null, 'weapon'); assert.equal(c.equipment.weapon, before);
  c.inventory = c.inventory.map(s => s ?? { id: 'hide', qty: 1 });
  panel.refreshDetail(); assert.match(panel.wornDetail.innerHTML, /data-item-action="unequip" disabled/);
  panel.act('unequip'); assert.equal(c.equipment.weapon, before);
});

test('desktop worn selection keeps the character column still and actions use its real slot', () => {
  const { c, panel } = harness(); panel.desktopQuery = { matches: true };
  let leftScrolls = 0, rightScrolls = 0;
  panel.wornDetail.scrollIntoView = () => leftScrolls++;
  panel.ui.detail.scrollIntoView = () => rightScrolls++;
  const id = c.equipment.weapon;
  panel.select(null, 'weapon');
  assert.equal(leftScrolls, 0); assert.equal(rightScrolls, 1);
  assert.equal(panel.wornDetail.hidden, true);
  assert.match(panel.ui.detail.innerHTML, /data-item-action="unequip"/);
  assert.equal(c.equipment.weapon, id);
  panel.act('unequip'); assert.equal(c.equipment.weapon, null);
  assert.ok(c.inventory.some(s => s?.id === id));
});

test('resize migrates current worn detail between desktop bag and mobile equipment without changing selection', () => {
  const { c, panel } = harness(); panel.desktopQuery = { matches: true };
  panel.select(null, 'weapon'); const selected = panel.selected, before = JSON.stringify(c.toJSON());
  panel.desktopQuery.matches = false; panel.refreshDetail();
  assert.equal(panel.wornDetail.hidden, false);
  assert.match(panel.wornDetail.innerHTML, /data-item-action="unequip"/);
  panel.desktopQuery.matches = true; panel.refreshDetail();
  assert.equal(panel.wornDetail.hidden, true);
  assert.match(panel.ui.detail.innerHTML, /data-item-action="unequip"/);
  assert.equal(panel.selected, selected); assert.equal(JSON.stringify(c.toJSON()), before);
});

test('comparison identifies the actual charm destination, then the occupied first slot', () => {
  const { c, panel } = harness();
  const id = Object.keys(ITEMS).find(id => ITEMS[id].type === 'equip' && ITEMS[id].slot === 'charm' && !ITEMS[id].retired);
  c.addItem(id); c.equip(c.inventory.findIndex(s => s?.id === id)); c.addItem(id);
  panel.select(c.inventory.findIndex(s => s?.id === id));
  assert.match(panel.ui.detail.innerHTML, /ช่องที่จะสวม: charm2/);
  c.equipment.charm2 = id; panel.refreshDetail();
  assert.match(panel.ui.detail.innerHTML, /ช่องที่จะสวม: charm<\/b>/);
});

test('both charms occupied: arrow and detail compare with stronger first charm that equip replaces', () => {
  const { c, panel } = harness();
  const charms = Object.keys(ITEMS).filter(id => ITEMS[id].type === 'equip' && ITEMS[id].slot === 'charm' && !ITEMS[id].retired)
    .sort((a, b) => gearScore(c.cls, a) - gearScore(c.cls, b));
  const weak = charms[0], strong = charms.at(-1);
  const candidate = charms.find(id => gearScore(c.cls, id) > gearScore(c.cls, weak) + .5 && gearScore(c.cls, id) < gearScore(c.cls, strong) - .5);
  assert.ok(candidate, 'fixture requires three distinct charm scores');
  c.equipment.charm = strong; c.equipment.charm2 = weak; c.addItem(candidate);
  assert.equal(compareToWorn(c, candidate), 1, 'old weaker-charm heuristic points up');
  assert.equal(equipDestination(c, candidate), 'charm'); assert.equal(compareToEquipped(c, candidate), -1);
  panel.renderCard = (item, cmp) => `<div data-cmp="${cmp}">${item.id}</div>`;
  panel.select(c.inventory.findIndex(s => s?.id === candidate));
  assert.match(panel.ui.detail.innerHTML, /data-cmp="-1"/);
  assert.match(panel.ui.detail.innerHTML, new RegExp(`data-cmp="0">${strong}`));
  panel.act('equip'); assert.equal(c.equipment.charm, candidate); assert.equal(c.equipment.charm2, weak);
});

test('free second charm compares as empty; occupied second charm does not change first-slot arrow', () => {
  const { c } = harness();
  const charms = Object.keys(ITEMS).filter(id => ITEMS[id].type === 'equip' && ITEMS[id].slot === 'charm' && !ITEMS[id].retired)
    .sort((a, b) => gearScore(c.cls, a) - gearScore(c.cls, b));
  const weak = charms[0], strong = charms.at(-1);
  c.equipment.charm = strong; c.equipment.charm2 = null;
  assert.equal(equipDestination(c, weak), 'charm2'); assert.equal(compareToEquipped(c, weak), 1);
  c.equipment.charm2 = weak;
  assert.equal(equipDestination(c, weak), 'charm'); assert.equal(compareToEquipped(c, weak), -1);
  assert.equal(compareToEquipped(c, strong), 0);
});

test('socket action opens the existing picker without consuming the card', () => {
  const { c, panel } = harness();
  const id = Object.keys(ITEMS).find(id => ITEMS[id].type === 'card'); c.addItem(id);
  const index = c.inventory.findIndex(s => s?.id === id), before = JSON.stringify(c.toJSON());
  panel.select(index); panel.act('socket');
  assert.equal(panel.ui.picked, index); assert.equal(JSON.stringify(c.toJSON()), before);
  c.setItemLock(index, true); panel.select(index);
  assert.match(panel.ui.detail.innerHTML, /data-item-action="socket" disabled/);
});

test('explicit equipment action retains the online operation contract, without sending on selection', () => {
  const { c, panel } = harness(); c.addItem('iron_dap');
  const sent = [], net = new Emitter(); net.online = true; net.send = msg => sent.push(msg);
  attachNetProgress(net, c); net.emit('sync', { c: { ...c.toJSON(), ack: 0 } });
  panel.select(c.inventory.findIndex(s => s?.id === 'iron_dap'));
  assert.equal(sent.length, 0);
  panel.act('equip');
  assert.equal(sent.length, 1); assert.equal(sent[0].t, 'op'); assert.equal(sent[0].op, 'use'); assert.equal(sent[0].id, 'iron_dap');
});

