import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { Character } from '../src/character/Character.js';
import { applyCombatState } from '../src/net/combatState.js';
import { selfEffects } from '../src/training/kitCombat.js';
import { KIT_SKILL_IDS } from '../src/character/data/kits.js';
import { fullKit } from '../src/character/data/skilltree.js';

test('real HTTP/WS: timed party healing, cleanse, protected revival, guest healing and rejected aliases', { timeout: 20000 }, async t => {
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  // Seed stored progress only. Casts, party consent, timers and network replies use production handlers.
  const bootstrap = `
    import { MemoryStore } from './server/store.js';
    import { Character } from './src/character/Character.js';
    import { KIT_SKILL_IDS } from './src/character/data/kits.js';
    import { fullKit } from './src/character/data/skilltree.js';
    const create = MemoryStore.prototype.createAccount;
    MemoryStore.prototype.createAccount = async function(...args) {
      const ok = await create.apply(this, args), id = args[0];
      if (ok && ['effecthealer', 'effectfriend', 'effectfallen'].includes(id)) {
        const cls = id === 'effecthealer' ? 'herbalist' : 'warrior';
        const c = new Character({ name: id, classId: cls, level: 60, jobLevel: 50,
          skills: fullKit(cls, KIT_SKILL_IDS[cls]) });
        c.hp = 100;
        this.slots.set(id, new Map([[0, { data: { 'tno.character.v1': JSON.stringify(c) }, updated: 1 }]]));
        await this.init();
      }
      return ok;
    };
    await import('./server/index.js');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', bootstrap], {
    cwd: new URL('../', import.meta.url), windowsHide: true,
    env: { ...process.env, PORT: String(port), DATABASE_URL: '', GM_ID: '', GM_PASSWORD: '', ADMIN_IDS: 'effectfallen' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', d => logs += d); child.stderr.on('data', d => logs += d);
  const sockets = [], sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  t.after(async () => {
    for (const ws of sockets) ws.terminate();
    if (child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  });
  for (let i = 0; i < 150 && !logs.includes('ThaiNative Online on'); i++) await sleep(20);
  assert.match(logs, /ThaiNative Online on/);
  const api = async (path, token, method = 'GET', body) => {
    const r = await fetch(`http://127.0.0.1:${port}${path}`, { method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(r.ok, `${path}: ${r.status}`); return r.json();
  };
  async function connect(account = null, z = 52) {
    const auth = account ? await api('/api/register', null, 'POST', { id: account, password: 'effect-test-secret' }) : null;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`), messages = []; sockets.push(ws);
    ws.on('message', d => messages.push(JSON.parse(d))); await once(ws, 'open');
    const send = m => ws.send(JSON.stringify(m));
    const wait = async predicate => {
      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        const index = messages.findIndex(predicate);
        if (index >= 0) return messages.splice(index, 1)[0];
        await sleep(5);
      }
      throw Error(`Effect WS timeout: ${JSON.stringify(messages.slice(-8))} ${logs}`);
    };
    send({ t: 'hello', ...(auth ? { token: auth.token, slot: 0 } : { name: 'Guest', cls: 'herbalist' }), map: 'city', x: 0, z });
    const id = (await wait(m => m.t === 'welcome')).you;
    const initial = auth ? (await wait(m => m.t === 'sync')).c : null;
    await wait(m => m.t === 'mlist');
    const position = await wait(m => m.t === 'position');
    return { id, send, wait, messages, initial, position, token: auth?.token };
  }
  const healer = await connect('effecthealer'), friend = await connect('effectfriend'), fallen = await connect('effectfallen');
  healer.send({ t: 'cast', skill: 'heal_vine', ally: friend.id });
  assert.equal((await healer.wait(m => m.t === 'nope')).why, 'ally');
  assert.equal((await healer.wait(m => m.t === 'skill-state')).state.mp, healer.initial.mp, 'invalid ally costs no MP');
  async function invite(player) {
    healer.send({ t: 'pinv', id: player.id }); await player.wait(m => m.t === 'pinv');
    player.send({ t: 'pans', from: healer.id, ok: true }); await player.wait(m => m.t === 'party' && m.id);
  }
  await invite(friend); await invite(fallen);
  fallen.send({ t: 'c', text: '/gm hp 0' }); await fallen.wait(m => m.t === 'gmhp' && m.pct === 0);
  const started = Date.now();
  healer.send({ t: 'cast', skill: 'heal_vine', ally: friend.id });
  const paid = await healer.wait(m => m.t === 'skill-state' && m.skill === 'heal_vine');
  assert.ok(paid.state.hp < 110, 'a friend heal does not heal the caster');
  const pulse = await friend.wait(m => m.t === 'aid' && m.skill === 'heal_vine');
  assert.ok(Date.now() - started >= 350, 'first pulse waits for the timer');
  assert.ok(pulse.amount > 0); assert.equal(pulse.hp, pulse.amount); assert.equal(pulse.state.owned, true);
  const local = new Character(friend.initial);
  applyCombatState(local, pulse.state); const exact = local.hp;
  applyCombatState(local, pulse.state); assert.equal(local.hp, exact, 'a snapshot cannot double-pay healing');
  healer.send({ t: 'cast', skill: 'heal_tiger' });
  const tiger = await friend.wait(m => m.t === 'aid' && m.skill === 'heal_tiger');
  assert.equal(tiger.buff.cleanse, true);
  assert.equal(tiger.buff.speed, selfEffects('heal_tiger', healer.initial.skills.heal_tiger).buff.speed);
  assert.ok(tiger.state.buffs.some(b => b.id === 'kit_heal_tiger' && b.remaining > 0));
  healer.send({ t: 'casting', skill: 'heal_khwan' }); await sleep(1250);
  healer.send({ t: 'cast', skill: 'heal_khwan' });
  const revived = await fallen.wait(m => m.t === 'aid' && m.skill === 'heal_khwan');
  assert.ok(revived.revive > 0); assert.ok(revived.state.hp > 0);
  assert.ok(revived.state.buffs.some(b => b.undying && b.remaining > 0 && b.remaining <= 10));
  friend.send({ t: 'pleave' }); await friend.wait(m => m.t === 'party' && !m.id);
  friend.messages.length = 0; await sleep(650);
  assert.equal(friend.messages.filter(m => m.t === 'aid' && m.skill === 'heal_vine').length, 0);
  friend.send({ t: 'cast', skill: 'guard' });
  assert.equal((await friend.wait(m => m.t === 'nope')).why, 'not_yours');
  const rejected = await friend.wait(m => m.t === 'skill-state' && m.skill === 'guard');
  assert.equal(rejected.state.buffs.some(b => b.id === 'guard'), false);
  const guest = await connect();
  const guestSheet = { ...Character.create('Guest', 'herbalist').toJSON(), jobLevel: 50, skills: fullKit('herbalist', KIT_SKILL_IDS.herbalist) };
  guest.send({ t: 'ch', data: guestSheet });
  guest.send({ t: 'cast', skill: 'heal_vine' });
  const accepted = await guest.wait(m => m.t === 'skill-state');
  assert.equal(accepted.state.owned, false); assert.equal(accepted.self.hp, 0);
  assert.ok((await guest.wait(m => m.t === 'aid' && m.skill === 'heal_vine')).hp > 0);
  guest.send({ t: 'dead', v: true }); guest.send({ t: 'cast', skill: 'heal_vine' });
  assert.equal((await guest.wait(m => m.t === 'nope')).why, 'dead');
  assert.deepEqual((await guest.wait(m => m.t === 'skill-state')).state.buffs, []);
  guest.send({ t: 'dead', v: false }); await guest.wait(m => m.t === 'position');
  guest.send({ t: 'cast', skill: 'heal_vine' });
  assert.equal((await guest.wait(m => m.t === 'nope')).why, 'cooldown', 'death does not reset cast cooldown');
  const guestFriend = await connect(null, 55); assert.equal(guestFriend.position.z, 55);
  guestFriend.send({ t: 'ch', data: guestSheet });
  guest.send({ t: 'pinv', id: guestFriend.id }); await guestFriend.wait(m => m.t === 'pinv');
  guestFriend.send({ t: 'pans', from: guest.id, ok: true }); await guestFriend.wait(m => m.t === 'party' && m.id);
  guestFriend.send({ t: 'dead', v: true });
  guestFriend.send({ t: 'cast', skill: 'heal_vine' });
  assert.equal((await guestFriend.wait(m => m.t === 'nope')).why, 'dead');
  guest.send({ t: 'casting', skill: 'heal_khwan' }); await sleep(1250);
  guest.send({ t: 'cast', skill: 'heal_khwan' });
  const guestRevive = await guestFriend.wait(m => m.t === 'aid' && m.skill === 'heal_khwan');
  assert.ok(guestRevive.revive > 0); assert.equal(guestRevive.state.owned, false);
  guestFriend.send({ t: 'dead', v: false }); // the client's player-revived echo
  guestFriend.send({ t: 'cast', skill: 'heal_vine' });
  const afterRevive = await guestFriend.wait(m => m.t === 'skill-state' && m.skill === 'heal_vine' && m.self);
  assert.ok(afterRevive.state.buffs.some(b => b.undying));
  await sleep(150);
  assert.equal(guestFriend.messages.some(m => m.t === 'position'), false, 'healer revival keeps the fallen location');
  assert.ok(guestFriend.messages.some(m => m.t === 'tick' && m.p.some(row => row[0] === guestFriend.id && row[2] === 55)), 'guest remains where they fell');
  const stored = await api('/api/slots/0', healer.token, 'PUT', { data: { 'tno.character.v1': JSON.stringify(healer.initial) } });
  assert.ok(stored.ok);
  const slots = await api('/api/slots', healer.token);
  assert.equal(JSON.parse(slots.slots[0].data['tno.character.v1']).buffs, undefined, 'transient buffs stay out of saves');
  assert.doesNotMatch(logs, /unhandled|message .*Error|Character save failed/);
});
