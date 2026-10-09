import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Character } from '../src/character/Character.js';
import { Combat } from '../src/combat/Combat.js';
import { Player, WALK_SPEED, RUN_SPEED } from '../src/entities/Player.js';
import { Presence, LIMITS, BUDGET_SECS } from '../server/presence.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function avatar() {
  const scene = new THREE.Scene(), player = new Player(scene), character = Character.create('ทดสอบ', 'hunter');
  const combat = new Combat(character, { playerPos: () => player.position, canStand: () => true });
  player.bindCombat({ ready: true, combat });
  return { player, character };
}
const ground = (extra = {}) => ({ speedAt: () => 1, canStand: () => true, heightAt: () => 0, ...extra });
function presence(options = {}) {
  let seconds = 0; const now = () => seconds;
  const P = new Presence({ now, ...options }), conn = {};
  P.join(conn, { map: 'paddy', x: 0, z: 0 });
  return { P, conn, p: P.players.get(conn), advance: dt => { seconds += dt; } };
}

test('actual Player.move applies live walk/run bonus, terrain scaling, cap and expiry', () => {
  const { player, character } = avatar(), dir = new THREE.Vector3(1, 0, 0);
  const land = ground({ speedAt: () => .75, heightAt: (x, z) => x * .1 + z });
  player.move(dir, .2, land, false); near(player.position.x, WALK_SPEED * .75 * .2);
  character.addBuff({ id: 'speed', duration: 1, speed: .3 });
  player.position.set(0, 0, 0); player.move(dir, .2, land, true); near(player.position.x, RUN_SPEED * 1.3 * .75 * .2);
  character.addBuff({ id: 'other', duration: 1, speed: .4 });
  player.position.set(0, 0, 0); player.move(dir, .2, land, false); near(player.position.x, WALK_SPEED * 1.5 * .75 * .2);
  near(player.position.y, land.heightAt(player.position.x, player.position.z));
  character.tick(1, true);
  player.position.set(0, 0, 0); player.move(dir, .2, land, true); near(player.position.x, RUN_SPEED * .75 * .2);
  sceneCleanup(player);
});
function sceneCleanup(player) {
  player.group.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
}

test('boosted long-frame movement still stops at a thin obstacle and slides along walls', () => {
  const { player, character } = avatar(); character.addBuff({ id: 'speed', duration: 5, speed: .5 });
  const fence = ground({ canStand: x => x < .5 || x > .7 });
  player.move(new THREE.Vector3(1, 0, 0), 2, fence, true);
  assert.ok(player.position.x > 0 && player.position.x < .5, 'Body-width substeps cannot jump the fence');
  player.position.set(.49, 0, 0);
  assert.equal(player.move(new THREE.Vector3(1, 0, 1).normalize(), .5, ground({ canStand: x => x < .5 }), true), true);
  assert.ok(player.position.x < .5 && player.position.z > 1, 'Existing obstacle sliding remains effective');
  player.position.set(.49, 0, .49);
  assert.equal(player.move(new THREE.Vector3(1, 0, 1).normalize(), .5,
    ground({ canStand: (x, z) => x < .5 && z < .5 }), true), false);
  sceneCleanup(player);
});

test('unbound Player and invalid speed values retain base movement', () => {
  const player = new Player(new THREE.Scene()), dir = new THREE.Vector3(0, 0, 1), land = ground();
  player.move(dir, .1, land, true); near(player.position.z, RUN_SPEED * .1);
  for (const speedBonus of [NaN, Infinity, -.5]) {
    player.combat = { character: { speedBonus } }; player.position.set(0, 0, 0);
    player.move(dir, .1, land, false); near(player.position.z, WALK_SPEED * .1);
  }
  player.combat = { character: { speedBonus: 100 } }; player.position.set(0, 0, 0);
  player.move(dir, .1, land, true); near(player.position.z, RUN_SPEED * 1.5 * .1);
  sceneCleanup(player);
});

test('only the trusted third argument raises Presence.move budget refill and accepted storage cap', () => {
  const trusted = presence(), untrusted = presence();
  trusted.P.move(trusted.conn, { x: 0, z: 0 }, .5);
  untrusted.P.move(untrusted.conn, { x: 0, z: 0, speedBonus: .5, speed: 999, budget: 999 });
  trusted.p.budget = untrusted.p.budget = 0;
  trusted.advance(1); untrusted.advance(1);
  assert.equal(trusted.P.move(trusted.conn, { x: 12, z: 0 }, .5), true);
  assert.equal(untrusted.P.move(untrusted.conn, { x: 12, z: 0, speedBonus: .5, speed: 999, budget: 999 }), false);
  assert.equal(untrusted.p.x, 0);
  trusted.advance(10); trusted.P.move(trusted.conn, { x: 12, z: 0 }, .5);
  near(trusted.p.budget, LIMITS.speed * 1.5 * BUDGET_SECS);
  untrusted.advance(10); untrusted.P.move(untrusted.conn, { x: 0, z: 0 }); near(untrusted.p.budget, LIMITS.speed * BUDGET_SECS);
});

test('speed activation cannot multiply saved budget or refill past time at the new rate; expiry clamps boost slack', () => {
  const { P, conn, p, advance } = presence();
  P.move(conn, { x: 0, z: 0 }); const normalCap = LIMITS.speed * BUDGET_SECS;
  assert.equal(P.move(conn, { x: normalCap + .1, z: 0 }, .5), false, 'No instant bonus distance on activation');
  near(p.budget, normalCap);
  advance(2); P.move(conn, { x: 0, z: 0 }, .5); near(p.budget, normalCap * 1.5);
  assert.equal(P.move(conn, { x: normalCap + .1, z: 0 }, 0), false, 'Expired extra slack cannot be spent');
  near(p.budget, normalCap);
  for (let i = 0; i < 12; i++) P.move(conn, { x: 0, z: 0 }, i % 2 ? 0 : .5);
  near(p.budget, normalCap, 'Zero-time rate toggles give no distance');
  p.budget = 0; advance(1);
  assert.equal(P.move(conn, { x: LIMITS.speed + .1, z: 0 }, .5), false, 'New boost does not backdate the preceding second');
});

test('trusted movement bonus is finite and capped; repeated small packets retain the total-speed bound', () => {
  for (const value of [.5, 99, Infinity, NaN, -.1, '0.5']) {
    const { P, conn, p, advance } = presence();
    P.move(conn, { x: 0, z: 0 }, value); p.budget = 0; advance(1);
    const boosted = Number.isFinite(value) && value > 0;
    assert.equal(P.move(conn, { x: 12, z: 0 }, value), boosted);
    assert.equal(p.budgetSpeed, LIMITS.speed * (boosted ? 1.5 : 1));
  }
  const { P, conn, p, advance } = presence(); P.move(conn, { x: 0, z: 0 }, .5);
  let accepted = 0;
  for (let i = 1; i <= 40; i++) { advance(.025); if (P.move(conn, { x: i * .9, z: 0 }, .5)) accepted++; }
  assert.ok(accepted < 40); assert.ok(p.x <= LIMITS.speed * BUDGET_SECS + LIMITS.speed * 1.5 + .01);
});

test('trusted speed still obeys navigation, finite-coordinate and death checks', () => {
  const { P, conn, p } = presence({ navigation: () => ({ canStand: () => true, clear: (_from, to) => to.x < 1 }) });
  assert.equal(P.move(conn, { x: 2, z: 0 }, .5), false);
  assert.equal(P.move(conn, { x: Infinity, z: 0 }, .5), false);
  p.dead = true; assert.equal(P.move(conn, { x: .5, z: 0 }, .5), false);
  assert.equal(p.x, 0);
});
