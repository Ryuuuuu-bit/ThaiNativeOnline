// GM commands (server/gm.js) and a healer's party support (src/training/kitCombat.js supportOf,
// server/combatants.js cast / aid).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gm, admins } from '../server/gm.js';
import { Presence } from '../server/presence.js';
import { Combatants } from '../server/combatants.js';
import { Character } from '../src/character/Character.js';
import { supportOf } from '../src/training/kitCombat.js';
import { EVO_LEVEL } from '../src/rules/data/evolutions.js';

const setup = () => {
  let t = 0; const presence = new Presence({ now: () => t }), combatants = new Combatants({ now: () => t }), sent = [];
  const join = (ws, name, cls, account) => {
    const r = presence.join(ws, { name, cls, map: 'city', x: 0, z: 0 });
    Object.assign(presence.players.get(ws), { account });
    combatants.load(r.you, { ...Character.create(name, cls).toJSON() }, { account, slot: 0 });
    return presence.players.get(ws);
  };
  const byId = id => { for (const [ws, p] of presence.players) if (p.id === id) return { ws, p }; return null; };
  const byName = n => { for (const [ws, p] of presence.players) if (p.name === n) return { ws, p }; return null; };
  const ctx = { presence, combatants, send: (ws, m) => sent.push([ws, m]), toAll: m => sent.push(['all', m]), toMap: () => {}, byId, byName, mutes: new Map(), worldOf: () => ({ monsters: [] }), route: () => {}, moveTo: () => {}, phase: () => 'day' };
  return { presence, combatants, sent, join, ctx };
};

test('GM: only listed accounts; own character on the server, others by name', () => {
  assert.deepEqual([...admins(' Ryuu, gm2 ,')], ['ryuu', 'gm2']);
  const { combatants, sent, join, ctx } = setup();
  const g = join('ws1', 'จีเอ็ม', 'warrior', 'ryuu'), p = join('ws2', 'แดง', 'hunter', 'red');
  const c = combatants.get(g.id).c;
  assert.match(gm(ctx, g, '/gm gold 500'), /520/);
  assert.match(gm(ctx, g, '/gm lv 10'), /เลเวล → 10/); assert.equal(c.level, 10);
  assert.match(gm(ctx, g, '/gm item sacred_ore 3'), /×3/); assert.equal(c.count('sacred_ore'), 3);
  assert.match(gm(ctx, g, '/gm card boar'), /การ์ด/); assert.equal(c.count('card_boar'), 1);
  assert.match(gm(ctx, g, '/gm refine weapon 7'), /\+7/); assert.equal(c.refine.weapon, 7);
  assert.match(gm(ctx, g, '/gm find ดาบ'), /wood_sword/);
  gm(ctx, g, '/gm hp 0'); assert.equal(c.alive, false); assert.ok(sent.some(([, m]) => m.t === 'gmhp' && m.pct === 0));
  gm(ctx, g, '/gm god'); assert.equal(combatants.get(g.id).god, true);
  assert.match(gm(ctx, g, '/gm give แดง gold 100'), /100/); assert.equal(combatants.get(p.id).c.gold, 120);
  assert.match(gm(ctx, g, '/gm give ใครก็ไม่รู้ gold 1'), /ไม่พบ/);
  gm(ctx, g, '/gm mute แดง 5'); assert.ok(ctx.mutes.get('red') > Date.now());
  gm(ctx, g, '/gm unmute แดง'); assert.equal(ctx.mutes.has('red'), false);
  assert.match(gm(ctx, g, '/gm who'), /2 คน/);
  assert.match(gm(ctx, g, '/gm nope'), /ไม่รู้จัก/);
  gm(ctx, g, '/gm map klong'); assert.ok(sent.some(([, m]) => m.t === 'gmwarp' && m.map === 'klong'));
});

test('a healer\'s party skill reaches the members near them; a revive stands the fallen up', () => {
  const mist = supportOf('heal_mist', 1, 10), khwan = supportOf('heal_khwan', 1, 10);
  assert.ok(mist.heal > 0 && mist.radius > 5 && !mist.revive);
  assert.ok(khwan.revive > 0); assert.equal(supportOf('heal_vine'), null, 'a single-target skill is not a party skill');
  let t = 0; const cs = new Combatants({ now: () => t });
  const all = Object.fromEntries(['heal_vine', 'heal_pill', 'heal_zone', 'heal_tiger', 'heal_khwan', 'heal_mortar', 'heal_mist'].map(id => [id, EVO_LEVEL]));
  cs.load(1, { ...Character.create('หมอ', 'herbalist').toJSON(), jobLevel: 50, skills: all }, { account: 'a', slot: 0 });
  cs.load(2, Character.create('เพื่อน', 'warrior').toJSON(), { account: 'b', slot: 0 });
  cs.get(1).c.mp = 999;
  cs.casting(1, 'heal_mist'); t += 2;
  const r = cs.cast(1, 'heal_mist'); assert.ok(r.ok && r.support, r.why);
  const friend = cs.get(2).c; friend.hp = 10;
  assert.ok(cs.aid(2, r.support).heal > 0); assert.ok(friend.hp > 10);
  friend.hp = 0;
  assert.equal(cs.aid(2, r.support), null, 'a heal does not raise the dead');
  t += 100; cs.casting(1, 'heal_khwan'); t += 5;
  const k = cs.cast(1, 'heal_khwan'); assert.ok(k.ok, k.why);
  assert.deepEqual(cs.aid(2, k.support), { revived: true }); assert.ok(friend.alive);
});
