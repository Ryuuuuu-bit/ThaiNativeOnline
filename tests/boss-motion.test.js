import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Emitter } from '../src/character/Emitter.js';
import { BossMotion, BOSS_MOTION_PROFILES, bossMotionClip, createBossAnimator } from '../src/combat/BossMotion.js';
import { MAP_BOSSES } from '../src/combat/data/boss-skills.js';
import { makeMonsterModel } from '../src/combat/MonsterModels.js';
import { CombatView } from '../src/combat/CombatView.js';
import { disposeCombatModel, isCombatModelDisposed } from '../src/combat/CombatResources.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const cast = (serial = 1, extra = {}) => ({ serial, windup: 2, remaining: 2, shape: 'circle', ...extra });
function fixture(type = 'dusk_fort_3', names = ['idle', 'walk', 'attack', 'hurt', 'die']) {
  const root = new THREE.Group(); root.name = 'body';
  const clips = names.map(name => new THREE.AnimationClip(name, 1, [new THREE.NumberKeyframeTrack('.position[y]',
    [0, .3, .6, 1], name.includes('idle') ? [0, 0, 0, 0] : [0, .3, .6, 1])]));
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(clips.map(clip => [clip.name, mixer.clipAction(clip)]));
  return { root, mixer, actions, clips, player: createBossAnimator(type, mixer, actions), motion: new BossMotion(type) };
}
function step(f, dt, extra = {}) {
  const sampled = f.motion.update(dt, extra);
  f.player.update(dt, false, false, { ...extra, bossMotion: sampled });
  return sampled;
}

test('all twelve primary bosses have distinct bounded cadence and preparation profiles', () => {
  assert.deepEqual(Object.keys(BOSS_MOTION_PROFILES).sort(), Object.values(MAP_BOSSES).sort());
  assert.equal(new Set(Object.values(BOSS_MOTION_PROFILES).map(p => `${p.idleRate}/${p.walkRate}`)).size, 12);
  for (const p of Object.values(BOSS_MOTION_PROFILES)) {
    assert.ok(p.holdFraction >= .2 && p.holdFraction <= .4);
    assert.ok(p.peakFraction >= .5 && p.peakFraction <= .65);
    assert.ok(p.releaseSeconds < p.recoverySeconds); assert.equal(p.recoverySeconds, 1.1);
  }
  assert.equal(createBossAnimator('boar', new THREE.AnimationMixer(new THREE.Group()), {}), null);
});

test('windup holds indefinitely without predicting an impact for every boss and duration', () => {
  for (const type of Object.keys(BOSS_MOTION_PROFILES)) for (const windup of [1.8, 2, 2.4]) {
    const motion = new BossMotion(type), c = cast(1, { windup, remaining: windup });
    const original = JSON.stringify(c);
    motion.event({ stage: 'windup', cast: c });
    near(motion.update(windup / 2).poseFraction, motion.profile.holdFraction / 2);
    const held = motion.update(20);
    assert.equal(held.phase, 'hold'); near(held.poseFraction, motion.profile.holdFraction);
    assert.equal(JSON.stringify(c), original, 'no mutation of gameplay cast remaining');
  }
});

test('late remaining seeks preparation; duplicates cannot rewind, release again or cancel newer casts', () => {
  const m = new BossMotion('chalawan');
  assert.equal(m.event({ stage: 'windup', cast: cast(3, { remaining: .5 }) }), true);
  near(m.state().poseFraction, .32 * .75);
  m.event({ stage: 'windup', cast: cast(3) }); near(m.state().poseFraction, .32 * .75);
  m.event({ stage: 'impact', cast: cast(3) }); const start = m.state().poseFraction;
  near(start, .32 * .75);
  m.update(.1); const fraction = m.state().poseFraction;
  assert.equal(m.event({ stage: 'impact', cast: cast(3) }), false); near(m.state().poseFraction, fraction);
  m.event({ stage: 'windup', cast: cast(4) });
  assert.equal(m.event({ stage: 'cancel', cast: cast(3) }), false); assert.equal(m.state().phase, 'windup');
  m.event({ stage: 'cancel', cast: cast(4) });
  assert.equal(m.event({ stage: 'impact', cast: cast(4) }), false); assert.equal(m.state().phase, 'none');
});

test('impact without windup releases once, then completes the authoritative 1.1 second recovery', () => {
  const m = new BossMotion('buffalo'); m.event({ stage: 'impact', cast: cast(7) });
  near(m.state().poseFraction, .2);
  near(m.update(m.profile.releaseSeconds).poseFraction, .62);
  assert.equal(m.update(.2).phase, 'recovery');
  assert.equal(m.update(1.1).phase, 'none');
  assert.equal(m.event({ stage: 'impact', cast: cast(7) }), false);
  // A newer impact cannot inherit the previous cast's pose or selected clip.
  m.event({ stage: 'windup', cast: cast(8) }); m.update(.1);
  m.event({ stage: 'impact', cast: cast(9) }); near(m.state().poseFraction, .2);
});

test('clear, death, stale and malformed events cannot release; a fresh snapshot or respawn can resume', () => {
  const m = new BossMotion('dusk_fort_3'); m.event({ stage: 'windup', cast: cast(2) });
  m.clear(); assert.equal(m.event({ stage: 'impact', cast: cast(2) }), false);
  assert.equal(m.event({ stage: 'windup', cast: cast(2) }), false);
  assert.equal(m.event({ stage: 'windup', cast: cast(2, { remaining: .1 }), snapshot: true }), true);
  m.update(0, { dying: true }); assert.equal(m.state().phase, 'death');
  assert.equal(m.event({ stage: 'impact', cast: cast(3) }), false);
  m.reset(); assert.equal(m.event({ stage: 'impact', cast: cast(1) }), true);
  for (const invalid of [null, {}, { serial: NaN }, { serial: -1 }, { serial: 1.5 }]) assert.equal(m.event({ stage: 'impact', cast: invalid }), false);
});

test('real AnimationMixer holds a sampled pose and crosses impact without action reset or a blend gap', () => {
  const f = fixture(); f.motion.event({ stage: 'windup', cast: cast() });
  step(f, 2); near(f.actions.attack.time, .28); near(f.root.position.y, .28);
  const action = f.actions.attack, weight = action.getEffectiveWeight();
  for (let i = 0; i < 8; i++) step(f, .1);
  near(f.root.position.y, .28); near(action.time, .28);
  f.motion.event({ stage: 'impact', cast: cast() }); step(f, 0);
  assert.equal(f.actions.attack, action); near(action.time, .28); near(action.getEffectiveWeight(), weight);
  near(f.root.position.y, .28);
  step(f, f.motion.profile.releaseSeconds); near(f.root.position.y, .56); near(action.time, .56);
  step(f, 1.1); step(f, .12); assert.equal(f.player.state().clip, 'idle'); near(f.root.position.y, 0);
});

test('cast preparation outranks hurt and basic attack, but die overrides and stays unpaused', () => {
  const f = fixture(); f.motion.event({ stage: 'windup', cast: cast() });
  f.player.update(.2, true, true, { hurt: true, bossMotion: f.motion.update(.2) });
  assert.equal(f.player.state().clip, 'attack'); assert.equal(f.actions.attack.paused, true);
  step(f, .1, { dying: true }); assert.equal(f.player.state().clip, 'die');
  assert.equal(f.actions.die.paused, false); near(f.actions.die.timeScale, 1.4);
});

test('cancel recovers smoothly and does not replay a lingering basic attack flag', () => {
  const f = fixture(); f.motion.event({ stage: 'windup', cast: cast() }); step(f, 2);
  f.motion.event({ stage: 'cancel', cast: cast() });
  f.player.update(.06, false, true, { bossMotion: f.motion.update(.06) });
  assert.ok(f.root.position.y > 0 && f.root.position.y < .28);
  f.player.update(.06, false, true, { bossMotion: f.motion.update(.06) });
  assert.equal(f.player.state().clip, 'idle'); near(f.root.position.y, 0);
});

test('optional Meshy selection follows skill and actual prop ownership, with original attack fallback', () => {
  for (const type of ['buffalo', 'takian', 'pusom', 'sunken_city_3']) assert.equal(bossMotionClip(type, { shape: 'ring' }), 'attack');
  assert.equal(bossMotionClip('sealed_mine_3', { shape: 'cone' }), 'cast-meshy');
  assert.equal(bossMotionClip('dusk_fort_3', { shape: 'cone' }), 'cast-meshy');
  for (const type of ['giant_valley_3', 'fallen_city_3']) assert.equal(bossMotionClip(type, { shape: 'cone' }), 'slash-meshy');
  assert.equal(bossMotionClip('giant_valley_3', { shape: 'ring' }), 'ritual-meshy');
  const f = fixture('giant_valley_3', ['idle', 'walk', 'attack', 'cast-meshy', 'ritual-meshy', 'slash-meshy']);
  f.motion.event({ stage: 'windup', cast: cast(1, { shape: 'cone' }) }); step(f, .2);
  assert.equal(f.player.state().clip, 'slash-meshy');
  f.motion.event({ stage: 'cancel', cast: cast(1) }); step(f, .2);
  f.motion.event({ stage: 'windup', cast: cast(2, { shape: 'ring' }) }); step(f, .2);
  assert.equal(f.player.state().clip, 'ritual-meshy');
  const missing = fixture('giant_valley_3'); missing.motion.event({ stage: 'impact', cast: cast() }); step(missing, .1);
  assert.equal(missing.player.state().clip, 'attack');
});

test('missing clips and separate mixers remain safe and isolated', () => {
  const empty = fixture('takian', []); empty.motion.event({ stage: 'impact', cast: cast() });
  assert.doesNotThrow(() => step(empty, .1)); assert.doesNotThrow(() => step(empty, .1, { dying: true }));
  const idleOnly = fixture('pusom', ['idle']); idleOnly.motion.event({ stage: 'windup', cast: cast() }); step(idleOnly, 4);
  assert.equal(idleOnly.player.state().clip, 'idle');
  const a = fixture(), b = fixture(); a.motion.event({ stage: 'impact', cast: cast() }); step(a, .15); step(b, .15);
  assert.ok(a.root.position.y > 0); near(b.root.position.y, 0); assert.equal(b.motion.serial, 0);
});

test('late optional overlay does not replace an in-progress held cast; next cast uses it', () => {
  const f = fixture(); f.motion.event({ stage: 'windup', cast: cast() }); step(f, 2);
  const clip = new THREE.AnimationClip('cast-meshy', 3, [new THREE.NumberKeyframeTrack('.position[y]', [0, 3], [0, 3])]);
  f.actions['cast-meshy'] = f.mixer.clipAction(clip); f.player.refresh(); step(f, .1);
  assert.equal(f.player.state().clip, 'attack'); near(f.root.position.y, .28);
  f.motion.event({ stage: 'cancel', cast: cast() }); step(f, .2);
  f.motion.event({ stage: 'windup', cast: cast(2) }); step(f, 2);
  assert.equal(f.player.state().clip, 'cast-meshy'); near(f.actions['cast-meshy'].time, .28 * 3);
});

function body() {
  const f = fixture(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  f.root.add(new THREE.Mesh(geometry, material));
  return { scene: f.root, animations: f.clips };
}
test('body ready is independent of pending or failed overlays, and late load seeks current phase', async () => {
  let resolveBody;
  const g = makeMonsterModel('chalawan', new THREE.Group(), 'late', {
    loadModel: () => new Promise(resolve => { resolveBody = resolve; }), loadMotions: () => new Promise(() => {}),
  });
  await Promise.resolve();
  g.userData.bossMotionEvent({ stage: 'windup', cast: cast(5, { remaining: .2 }) });
  g.userData.animate(10, false, false); g.userData.animate(10.1, false, false);
  resolveBody(body()); await g.userData.ready;
  assert.equal(g.userData.modelLoaded, true); assert.equal(g.userData.animationState().castSerial, 5);
  near(g.userData.animationState().clipTime, .32 * .95);
  const failed = makeMonsterModel('chalawan', new THREE.Group(), 'failed', { loadModel: async () => body(), loadMotions: async () => { throw new Error('optional 404'); } });
  await failed.userData.ready; assert.equal(await failed.userData.motionsReady, false); assert.equal(failed.userData.modelLoaded, true);
  for (const model of [g, failed]) disposeCombatModel(model);
});

test('retiring a loading model prevents a stale clone from attaching after map/style changes', async () => {
  let resolve;
  const g = makeMonsterModel('takian', new THREE.Group(), 'retired', { loadModel: () => new Promise(r => { resolve = r; }) });
  await Promise.resolve(); disposeCombatModel(g); disposeCombatModel(g); resolve(body());
  assert.equal(await g.userData.ready, null); assert.equal(g.userData.modelLoaded, undefined); assert.equal(g.children.length, 1);
});

test('shared cleanup invokes root retirement and resource release only once', () => {
  const group = new THREE.Group(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial();
  group.add(new THREE.Mesh(geometry, material)); let retired = 0, geometries = 0, materials = 0;
  group.userData.dispose = () => { retired++; };
  geometry.addEventListener('dispose', () => { geometries++; }); material.addEventListener('dispose', () => { materials++; });
  disposeCombatModel(group); disposeCombatModel(group);
  assert.deepEqual([retired, geometries, materials], [1, 1, 1]);
  assert.equal(isCombatModelDisposed(group), true);
  assert.equal(isCombatModelDisposed(group.clone()), false, 'disposal tracks identity, not copied userData');
});

function lifecycleFixture(type) {
  const monster = { id: `lifecycle-${type}`, type, alive: true, def: { shape: 'boar', color: '#647357', size: 2 } };
  const combat = new Emitter(); combat.monsters = [monster];
  const view = new CombatView(new THREE.Scene(), combat, () => 0);
  return { monster, combat, view };
}

test('same Monster rebuilds its disposed view/controller through ensure and offline spawn', async t => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => body());
  const { monster, combat, view } = lifecycleFixture('dusk_fort_3');
  t.after(() => { for (const v of view.views.values()) view.disposeModel(v.group); });
  let previous = view.views.get(monster.id); await previous.group.userData.ready;
  assert.equal(view.ensure(monster), previous, 'a live view still reuses its instance');
  for (const trigger of ['ensure', 'spawn']) {
    previous.bossMotion.event({ stage: 'windup', cast: cast(9) });
    previous.bossMotion.update(0, { dying: true });
    view.disposeModel(previous.group);
    assert.equal(isCombatModelDisposed(previous.group), true);
    if (trigger === 'ensure') view.ensure(monster, previous.bossMotion);
    else combat.emit('spawn', monster);
    const fresh = view.views.get(monster.id);
    assert.notEqual(fresh, previous); assert.equal(fresh.monster, monster);
    assert.notEqual(fresh.group, previous.group); assert.notEqual(fresh.bossMotion, previous.bossMotion);
    assert.equal(fresh.bossMotion.dead, false); assert.equal(fresh.bossMotion.serial, 0);
    assert.equal(isCombatModelDisposed(fresh.group), false);
    assert.equal(previous.group.parent, null); assert.equal(fresh.group.parent, view.root);
    await fresh.group.userData.ready;
    assert.equal(fresh.group.userData.modelLoaded, true);
    fresh.group.userData.animate(0, false, false); fresh.group.userData.animate(.1, false, false);
    assert.equal(fresh.group.userData.animationState().clip, 'idle');
    assert.ok(fresh.group.userData.animationState().clipTime > 0, 'fresh animation clock is running');
    assert.equal(view.ensure(monster), fresh); previous = fresh;
  }
});

test('same-Monster replacement attaches a shared late body load only to the fresh view', async t => {
  let resolveBody;
  t.mock.method(GLTFLoader.prototype, 'loadAsync', url => url.includes('/motions/') ? Promise.resolve({ animations: [] }) : new Promise(resolve => { resolveBody = resolve; }));
  const { monster, combat, view } = lifecycleFixture('demon_rift_3');
  t.after(() => { for (const v of view.views.values()) view.disposeModel(v.group); });
  const retired = view.views.get(monster.id); await Promise.resolve();
  const children = [...retired.group.children];
  view.disposeModel(retired.group); combat.emit('spawn', monster);
  const fresh = view.views.get(monster.id); assert.notEqual(fresh, retired);
  resolveBody(body());
  const [oldResult, newResult] = await Promise.all([retired.group.userData.ready, fresh.group.userData.ready]);
  assert.equal(oldResult, null); assert.ok(newResult);
  assert.equal(retired.group.userData.modelLoaded, undefined); assert.deepEqual(retired.group.children, children);
  assert.equal(retired.group.parent, null); assert.equal(fresh.group.userData.modelLoaded, true);
  assert.equal(fresh.group.parent, view.root); assert.equal(isCombatModelDisposed(fresh.group), false);
});

test('optional completion after shared disposal cannot install tracks or revive animation', async () => {
  let resolveLibrary;
  const g = makeMonsterModel('chalawan', new THREE.Group(), 'late-library', {
    loadModel: async () => body(), loadMotions: () => new Promise(resolve => { resolveLibrary = resolve; }),
  });
  await g.userData.ready; g.userData.animate(0, false, false);
  const previousClip = g.userData.animationState().clip;
  disposeCombatModel(g);
  resolveLibrary({ animations: fixture('chalawan', ['idle-meshy', 'cast-meshy']).clips });
  assert.equal(await g.userData.motionsReady, false);
  g.userData.animate(1, false, true); assert.equal(g.userData.animationState().clip, previousClip);
});

test('nonboss models retain their original one-shot playback and never request optional libraries', async () => {
  let requests = 0;
  const source = body(), original = source.animations.map(c => [c.name, c.duration, [...c.tracks[0].values]]);
  const g = makeMonsterModel('boar', new THREE.Group(), 'ordinary', {
    loadModel: async () => source, loadMotions: async () => { requests++; return null; },
  });
  await g.userData.ready; assert.equal(await g.userData.motionsReady, false); assert.equal(requests, 0);
  g.userData.animate(0, false, false); g.userData.animate(.1, false, true);
  assert.equal(g.userData.animationState().clip, 'attack');
  for (let i = 2; i <= 15; i++) g.userData.animate(i * .1, false, true);
  assert.equal(g.userData.animationState().clip, 'idle');
  assert.deepEqual(source.animations.map(c => [c.name, c.duration, [...c.tracks[0].values]]), original);
  disposeCombatModel(g);
});

test('render sampling reuses per-instance state and keeps different instances independent', () => {
  const a = new BossMotion('dusk_fort_3'), b = new BossMotion('dusk_fort_3');
  const first = a.state(); a.event({ stage: 'windup', cast: cast() });
  assert.equal(a.update(.1), first); assert.notEqual(a.state(), b.state());
  const f = fixture(), status = f.player.state(); step(f, .1);
  assert.equal(f.player.state(), status);
});

test('fresh remaining samples do not add the frame twice; repeated snapshots predict and never release', async () => {
  const g = makeMonsterModel('chalawan', new THREE.Group(), 'snapshot-clock', {
    loadModel: async () => body(), loadMotions: async () => null,
  });
  await g.userData.ready;
  const snapshot = cast(6);
  g.userData.bossMotionEvent({ stage: 'windup', cast: snapshot });
  g.userData.animate(0, false, false, { bossCast: snapshot });
  for (let frame = 1; frame <= 5; frame++) {
    snapshot.remaining = 2 - frame * .1;
    g.userData.animate(frame * .1, false, false, { bossCast: snapshot });
    near(g.userData.animationState().clipTime, .32 * frame * .1 / 2);
  }
  // An unchanged received value predicts forward while waiting for packets.
  g.userData.animate(.6, false, false, { bossCast: snapshot });
  near(g.userData.animationState().clipTime, .32 * .6 / 2);
  snapshot.remaining = 0;
  g.userData.animate(.7, false, false, { bossCast: snapshot });
  assert.equal(g.userData.animationState().phase, 'hold'); near(g.userData.animationState().clipTime, .32);
  g.userData.animate(.8, false, false, { bossCast: snapshot });
  assert.equal(g.userData.animationState().phase, 'hold');
  g.userData.bossMotionEvent({ stage: 'impact', cast: snapshot });
  snapshot.remaining = .01; // Outdated windup data cannot freeze the release.
  g.userData.animate(.9, false, false, { bossCast: snapshot });
  assert.equal(g.userData.animationState().phase, 'release'); assert.ok(g.userData.animationState().clipTime > .32);
  disposeCombatModel(g);
});

test('basic attacks keep the approved body clip even when every Meshy gesture is installed', () => {
  const f = fixture('giant_valley_3', ['idle', 'walk', 'attack', 'idle-meshy', 'cast-meshy', 'ritual-meshy', 'slash-meshy']);
  f.player.update(.1, false, true);
  assert.equal(f.player.state().clip, 'attack');
  f.motion.event({ stage: 'windup', cast: cast(1, { shape: 'cone' }) }); step(f, .1);
  assert.equal(f.player.state().clip, 'slash-meshy');
});

test('CombatView bridge handles observer impact, serial cancellation and map clear without a damage packet', () => {
  const monster = { id: 's1', type: 'chalawan', alive: true };
  const view = { monster, bossMotion: new BossMotion(monster.type) }, events = [];
  const bridge = Object.create(CombatView.prototype);
  bridge.combat = { monsters: [monster] }; bridge.views = new Map([[monster.id, view]]);
  bridge.bossTelegraphs = { items: new Map(), event: e => events.push(e.stage), clear() { this.items.clear(); } };
  bridge.bossSkill({ monster, stage: 'impact', cast: cast(3) }); assert.equal(view.bossMotion.state().phase, 'release');
  bridge.bossSkill({ monster, stage: 'cancel', cast: cast(2) }); assert.deepEqual(events, ['impact']);
  bridge.clearBossMotions(); bridge.bossSkill({ monster, stage: 'impact', cast: cast(3) });
  assert.equal(view.bossMotion.state().phase, 'none'); assert.deepEqual(events, ['impact']);
  const replaced = { ...monster }; bridge.bossSkill({ monster: replaced, stage: 'impact', cast: cast(4) });
  assert.deepEqual(events, ['impact']);
});
