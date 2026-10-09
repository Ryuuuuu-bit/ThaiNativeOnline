import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Character } from '../src/character/Character.js';
import { Emitter } from '../src/character/Emitter.js';
import { attachNetProgress } from '../src/net/NetProgress.js';
import { Combatants } from '../server/combatants.js';
import { shopSpot } from '../src/data/shopSites.js';

// Load the production panel unchanged apart from its bundler-only CSS import.
// Minimal DOM surfaces exercise real delegated clicks and the actual Character/NetProgress events.
const panelURL = new URL('../src/ui/ShopPanel.js', import.meta.url);
const source = (await readFile(panelURL, 'utf8')).replace("import './shop.css';", '')
  .replace(/from '(\.[^']+)'/g, (_, path) => `from '${new URL(path, panelURL).href}'`);
const { ShopPanel } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function harness(t, { online = false, plus = 0, roll = 0 } = {}) {
  const previous = globalThis.document, nodes = new Map();
  globalThis.document = { getElementById: id => {
    if (!nodes.has(id)) nodes.set(id, { hidden: true, innerHTML: '', textContent: '', listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelector() { return null; } });
    return nodes.get(id);
  } };
  const c = Character.create('QA', 'warrior');
  c.gold = 50000; c.addItem('sacred_ore', 20); c.addItem('gold_leaf', 20);
  c.equipment.weapon = 'iron_dap'; c.refine.weapon = plus; c.cards.weapon = ['card_boar'];
  const messages = [], notices = [], server = new Combatants({ now: () => 100, random: () => roll });
  server.load(1, c.toJSON(), { account: 'qa', slot: 0 });
  const net = new Emitter(); net.online = true; net.send = msg => messages.push(msg);
  if (online) { attachNetProgress(net, c); net.emit('sync', { c: { ...c.toJSON(), ack: 0 } }); }
  const panel = new ShopPanel((...args) => notices.push(args)), npc = { def: { shopType: 'enhance', name: 'QA forge' } };
  panel.show(npc, c);
  t.after(() => { panel.unsub?.(); globalThis.document = previous; });
  return { c, panel, net, server, npc, messages, notices,
    get html() { return nodes.get('shop-list').innerHTML; },
    click(key = 'w:weapon') {
      nodes.get('shop-list').listeners.click({ target: { closest(selector) { return selector === '[data-refine]' ? { dataset: { refine: key } } : null; } } });
    },
    result() {
      assert.equal(messages.length, 1);
      server.op(1, messages[0], shopSpot('enhance'));
      net.emit('refined', server.get(1).refined);
    },
    sync() { net.emit('sync', { c: { ...server.me(1), ack: 1 } }); },
  };
}

test('offline guest success emits immediately and releases the lock once, with real updated bonuses', t => {
  const h = harness(t); const gold = h.c.gold;
  h.click();
  assert.equal(h.c.refine.weapon, 1); assert.equal(h.c.gold, gold - 100);
  assert.equal(h.panel.refinePending, null);
  assert.equal(h.notices.length, 1); assert.match(h.notices[0][0], /สำเร็จ.*\+1/);
  assert.match(h.html, /eh-result success/); assert.match(h.html, /เพิ่ม \+3/);
  assert.match(h.html, /ขั้นถัดไปเพิ่ม/); assert.match(h.html, /พลังไอเท็มรวม 16 → 19/);
});

test('signed-in delayed refinement sends one request, has no early success or local roll, and rejects accurately', t => {
  const h = harness(t, { online: true }), before = JSON.stringify(h.c.toJSON());
  h.click(); h.click();
  assert.equal(h.messages.length, 1); assert.equal(JSON.stringify(h.c.toJSON()), before);
  assert.ok(h.panel.refinePending); assert.equal(h.panel.forgeResult, null);
  assert.match(h.html, /eh-result waiting/); assert.doesNotMatch(h.html, /eh-result success|eh-result broke/);
  assert.match(h.html, /data-refine="w:weapon"[^>]*disabled/); assert.equal(h.notices.length, 0);
  h.net.emit('refined', { pending: true, ok: true }); assert.equal(h.notices.length, 0);
  h.net.emit('refined', { ok: false, why: 'no_shop', outcome: 'up', item: 'iron_dap', to: 1 });
  assert.equal(h.panel.refinePending, null); assert.match(h.html, /eh-result rejected/);
  assert.doesNotMatch(h.html, /eh-result success|eh-result broke/);
  assert.match(h.notices[0][0], /โรงหลอม/); assert.equal(JSON.stringify(h.c.toJSON()), before);
});

test('risky confirmation preserves odds; success feedback uses authoritative item/to before sync and blocks repeat', t => {
  const h = harness(t, { online: true, plus: 6 });
  h.click(); assert.equal(h.messages.length, 0); assert.equal(h.panel.armed, 'w:weapon');
  assert.match(h.html, /ล้มเหลว 60%: อุปกรณ์และการ์ด 1 ใบสูญเสียถาวร/);
  h.click(); assert.equal(h.messages.length, 1);
  h.panel.enhSel = 'w:armor'; // A changed display cannot decide which item the result names.
  h.result();
  assert.equal(h.c.refine.weapon, 6, 'authoritative sync has not arrived');
  assert.equal(h.panel.forgeResult.item, 'iron_dap'); assert.equal(h.panel.forgeResult.to, 7);
  assert.match(h.html, /ตีบวกสำเร็จ · \+7 ดาบเหล็กลาย/);
  assert.match(h.html, /โจมตี \+30 → \+42 \(เพิ่ม \+12\)/); assert.match(h.html, /ถึงขั้นชำนาญ \+7/);
  assert.ok(h.panel.refinePending); h.click(); assert.equal(h.messages.length, 1);
  h.sync(); assert.equal(h.c.refine.weapon, 7); assert.equal(h.panel.refinePending, null);
  assert.deepEqual(h.c.cards.weapon, ['card_boar']); assert.equal(h.notices.length, 1);
});

test('authoritative destruction shows exact consumed resources and card loss, with no false success', t => {
  const h = harness(t, { online: true, plus: 4, roll: .99 }), gold = h.c.gold, ore = h.c.count('sacred_ore');
  h.click(); h.click(); h.result();
  assert.match(h.html, /eh-result broke/); assert.doesNotMatch(h.html, /eh-result success/);
  assert.match(h.html, /ตีบวก \+5 ล้มเหลว.*ดาบเหล็กลายแตกสลาย/);
  assert.match(h.html, /พร้อมการ์ดหมูป่า/); assert.match(h.html, /ใช้ 500 ทอง \+ แร่ศักดิ์สิทธิ์ 1 ชิ้น/);
  assert.equal(h.c.equipment.weapon, 'iron_dap', 'destruction waits for authoritative sync');
  h.sync(); assert.equal(h.c.equipment.weapon, null); assert.deepEqual(h.c.cards.weapon, []);
  assert.equal(h.c.gold, gold - 500); assert.equal(h.c.count('sacred_ore'), ore - 1);
  assert.equal(h.panel.refinePending, null); assert.match(h.html, /eh-result broke/);
});

test('+10 success retains selectable completed gear, bonus and milestone without another request', t => {
  const h = harness(t, { online: true, plus: 9 });
  h.click(); h.click(); h.result(); h.sync();
  assert.equal(h.c.refine.weapon, 10); assert.equal(h.panel.refinePending, null);
  assert.match(h.html, /ตีบวกสำเร็จ · \+10 ดาบเหล็กลาย/); assert.match(h.html, /โจมตี \+75 → \+99 \(เพิ่ม \+24\)/);
  assert.match(h.html, /ถึงขั้นตำนาน \+10/); assert.match(h.html, /โบนัสสูงสุด/);
  assert.match(h.html, /data-refine="w:weapon"[^>]*disabled/);
  h.click(); assert.equal(h.messages.length, 1);
});

test('close/reopen while awaiting acknowledgement keeps the lock and accepts the late result', t => {
  const h = harness(t, { online: true }); h.click(); h.panel.close();
  h.panel.show(h.npc, h.c); h.click(); assert.equal(h.messages.length, 1);
  h.result(); h.sync();
  assert.equal(h.c.refine.weapon, 1); assert.equal(h.panel.refinePending, null);
  assert.equal(h.notices.length, 1); assert.match(h.html, /eh-result success/);
});

test('disconnect releases the unknown attempt but blocks offline rerolls until a fresh character is adopted', t => {
  const h = harness(t, { online: true }), before = JSON.stringify(h.c.toJSON());
  h.click();
  h.server.op(1, h.messages[0], shopSpot('enhance')); // Server rolled; its result never reached the browser.
  h.net.online = false; h.net.emit('status', false);
  assert.equal(h.panel.refinePending, null); assert.equal(h.c.refineRecovering, true);
  assert.equal(JSON.stringify(h.c.toJSON()), before); assert.equal(h.notices.length, 0);
  assert.match(h.html, /ยังไม่ได้รับผลครั้งก่อน/);
  assert.match(h.html, /data-refine="w:weapon"[^>]*disabled/);
  h.click(); assert.deepEqual(h.c.refineGear('weapon'), { ok: false, why: 'connection' });
  h.panel.close(); h.panel.show(h.npc, h.c); h.click();
  assert.equal(h.messages.length, 1); assert.equal(JSON.stringify(h.c.toJSON()), before);
  h.net.emit('refined', h.server.get(1).refined); // A late old-session result cannot play an effect.
  assert.equal(h.notices.length, 0);
  h.net.online = true; h.net.emit('status', true); h.click();
  assert.equal(h.c.refineRecovering, true); assert.equal(h.messages.length, 1);
  h.net.emit('sync', { c: { ...h.server.me(1), ack: 0 } }); // New connection restarts operation numbering.
  assert.equal(h.c.refine.weapon, 1); assert.equal(h.c.refineRecovering, false);
  assert.equal(h.panel.refinePending, null); assert.equal(h.notices.length, 0);
  assert.match(h.html, /อัปเดตอุปกรณ์ล่าสุดแล้ว/);
  assert.doesNotMatch(h.html, /eh-result success|eh-result broke|data-refine="w:weapon"[^>]*disabled/);
  assert.equal(h.messages.length, 1, 'reconnection only adopts state; never resends a random action');
});

test('acknowledged resync releases a missing result without inferring success or destruction', t => {
  for (const roll of [0, .99]) {
    const h = harness(t, { online: true, plus: 4, roll });
    h.click(); h.click(); h.server.op(1, h.messages[0], shopSpot('enhance'));
    h.sync();
    assert.equal(h.panel.refinePending, null); assert.equal(h.c.refineRecovering, false);
    assert.equal(h.c.equipment.weapon, roll === 0 ? 'iron_dap' : null);
    assert.equal(h.notices.length, 0); assert.equal(h.messages.length, 1);
    assert.match(h.html, /อัปเดตอุปกรณ์ล่าสุดแล้ว/);
    assert.doesNotMatch(h.html, /eh-result success|eh-result broke/);
    h.net.emit('refined', h.server.get(1).refined);
    assert.equal(h.notices.length, 0, 'discarded late result cannot become fresh feedback');
  }
});

test('stale state keeps the action locked; an acknowledged heartbeat requests fresh state once, never another roll', t => {
  const h = harness(t, { online: true }), initial = h.c.toJSON();
  h.click(); h.net.emit('sync', { c: { ...initial, ack: 0 } });
  assert.ok(h.panel.refinePending); assert.equal(h.c.refine.weapon, 0);
  h.server.op(1, h.messages[0], shopSpot('enhance'));
  const heartbeat = h.server.me(1);
  h.net.emit('me', heartbeat); h.net.emit('me', heartbeat);
  assert.deepEqual(h.messages.map(m => m.t), ['op', 'resync']);
  assert.ok(h.panel.refinePending); assert.equal(h.notices.length, 0);
  h.sync(); assert.equal(h.panel.refinePending, null); assert.equal(h.c.refine.weapon, 1);
  assert.equal(h.notices.length, 0); assert.doesNotMatch(h.html, /eh-result success|eh-result broke/);
});

test('authoritative result is correlated to the outstanding item/level and duplicate feedback is ignored', t => {
  const h = harness(t, { online: true }); h.click();
  h.net.emit('refined', { ok: true, outcome: 'up', item: 'wood_sword', to: 1 });
  h.net.emit('refined', { ok: true, outcome: 'up', item: 'iron_dap', to: 2 });
  assert.ok(h.panel.refinePending); assert.equal(h.notices.length, 0);
  h.result(); h.net.emit('refined', h.server.get(1).refined);
  assert.equal(h.notices.length, 1); assert.ok(h.panel.refinePending);
  h.sync(); assert.equal(h.panel.refinePending, null); assert.equal(h.c.refine.weapon, 1);
});

test('disconnect after a confirmed result preserves that result and waits for fresh equipment before another try', t => {
  const h = harness(t, { online: true }); h.click(); h.result();
  h.net.online = false; h.net.emit('status', false);
  assert.equal(h.panel.refinePending, null); assert.equal(h.c.refineRecovering, true);
  assert.match(h.html, /eh-result success/); assert.equal(h.notices.length, 1);
  assert.match(h.html, /data-refine="w:weapon"[^>]*disabled/);
  h.net.online = true; h.sync();
  assert.equal(h.c.refineRecovering, false); assert.equal(h.c.refine.weapon, 1);
  assert.match(h.html, /eh-result success/); assert.equal(h.notices.length, 1);
  assert.equal(h.messages.length, 1);
});
