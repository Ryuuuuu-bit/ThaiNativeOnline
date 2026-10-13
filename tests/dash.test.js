// Shift dash (src/data/dash.js): the player's burst, its cooldown, the server's allowance and
// the clip every class model carries.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { gltfLoader } from '../src/core/gltf.js';
import { DASH, DASH_SERVER } from '../src/data/dash.js';
import { Player, RUN_SPEED } from '../src/entities/Player.js';
import { Presence, LIMITS, BUDGET_SECS } from '../server/presence.js';

const ground = (extra = {}) => ({ speedAt: () => 1, canStand: () => true, heightAt: () => 0, ...extra });
const run = (player, frames, dt, dir = new THREE.Vector3(), world = ground()) => { for (let i = 0; i < frames; i++) player.move(dir, dt, world, false); };

test('a dash covers its distance in its time, whatever the keys say, then waits out the cooldown', () => {
  const player = new Player(new THREE.Scene());
  assert.ok(player.dashReady);
  assert.equal(player.dash(new THREE.Vector3(1, 0, 0)), true);
  assert.equal(player.dash(new THREE.Vector3(1, 0, 0)), false, 'no second dash during the first');
  let frames = 0;
  while (player.dashing && frames++ < 100) player.move(new THREE.Vector3(0, 0, 1), .01, ground(), false);   // keys pull the other way
  assert.ok(Math.abs(frames - DASH.time / .01) <= 1, `frames ${frames}`);
  assert.ok(Math.abs(player.position.x - DASH.distance) < 1e-6, `x ${player.position.x}`);
  assert.equal(player.position.z, 0);
  assert.ok(Math.abs(player.group.rotation.y - Math.PI / 2) < 1e-6, 'faces the dash');
  assert.equal(player.dashReady, false, 'cooling down');
  run(player, Math.round((DASH.cooldown - DASH.time) / .01) + 2, .01);
  assert.equal(player.dashReady, true);
});

test('a long frame cannot dash through a wall; the dash stops at it', () => {
  const player = new Player(new THREE.Scene());
  player.dash(new THREE.Vector3(1, 0, 0));
  run(player, 1, 1, new THREE.Vector3(), ground({ canStand: x => x < 2 }));   // one hidden-tab sized frame
  assert.ok(player.position.x < 2 && player.position.x > 1.8, `x ${player.position.x}`);
  assert.equal(player.dashing, null);
});

test('with no direction the dash goes the way the player faces, and plays the model clip sped up', () => {
  const player = new Player(new THREE.Scene()), played = [];
  player.setAvatar({ group: new THREE.Group(), update() {}, has: c => c === 'dash', clipLength: () => 1.4667, attack: (clip, sp) => played.push([clip, sp]) });
  player.group.rotation.y = Math.PI;   // facing −z
  player.dash(new THREE.Vector3());
  run(player, 40, .01);
  assert.ok(Math.abs(player.position.z + DASH.distance) < 1e-6 && Math.abs(player.position.x) < 1e-6);
  assert.equal(played.length, 1); assert.equal(played[0][0], 'dash');
  assert.ok(Math.abs(played[0][1] - 1.4667 / DASH.clipTime) < 1e-6);
  assert.ok(played[0][1] <= 3, 'within the relay speed limit');
});

test('the server lets a running dash through once per cooldown, never while down', () => {
  let t = 0; const P = new Presence({ now: () => t }), conn = {};
  P.join(conn, { map: 'paddy', x: 0, z: 0 });
  let x = 0;
  const step = (dt, d) => { t += dt; x += d; return P.move(conn, { x, z: 0 }); };
  // spend the saved budget (a lag catch-up): what is left is less than a dash
  assert.ok(step(.1, LIMITS.speed * BUDGET_SECS));
  assert.equal(step(.1, DASH.distance), false, 'a burst without a dash is refused');
  x -= DASH.distance;
  assert.ok(P.anim(conn, { clip: 'dash', sp: 2.7 }), 'relayed');
  assert.equal(step(.1, DASH.distance), true, 'the dash burst passes');
  assert.equal(P.anim(conn, { clip: 'dash' }), null, 'a second dash inside the cooldown is not relayed');
  assert.equal(step(.1, DASH.distance), false, '… and grants nothing');
  x -= DASH.distance;
  t += DASH_SERVER.every;
  P.setDead(conn, true);
  assert.equal(P.anim(conn, { clip: 'dash' }), null, 'not while down');
  assert.ok(DASH_SERVER.every < DASH.cooldown && DASH_SERVER.slack >= DASH.distance);
  assert.ok(RUN_SPEED * BUDGET_SECS < LIMITS.speed * BUDGET_SECS, 'running alone stays inside the budget');
});

test('every class model carries a dash clip that plays in place', async () => {
  const loader = gltfLoader().register(() => ({ name: 'QA_TEXTURES', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  for (const id of ['warrior', 'hunter', 'shaman', 'herbalist', 'muay-thai-fighter']) {
    const bytes = await readFile(new URL(`../public/models/${id}.glb`, import.meta.url));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const clip = gltf.animations.find(c => c.name === DASH.clip);
    assert.ok(clip, `${id} dash`);
    assert.ok(clip.duration > 1 && clip.duration < 2, `${id} ${clip.duration}`);
    for (const track of clip.tracks) assert.ok(Array.from(track.values).every(Number.isFinite), `${id} ${track.name}`);
    assert.ok(clip.tracks.some(t => /Hips\.position$/.test(t.name)) && clip.tracks.filter(t => t.name.endsWith('.quaternion')).length >= 20, id);
  }
});
