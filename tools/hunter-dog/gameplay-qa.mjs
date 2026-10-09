import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, rename } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately gated: preparation/help/syntax checks never launch Edge.
// Run only after the owner publishes the candidate and releases the capture slot.
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cases = [
  { id: 'arch_poison', rawHits: [[150, true], [70, false], [70, false]], actors: 1 },
  { id: 'arch_garuda', rawHits: [[90, false]], actors: 1 },
  { id: 'arch_rain', rawHits: [[110, false], [110, false], [110, true]], actors: 3 },
  { id: 'arch_snipe', rawHits: [[120, false]], actors: 1 },
  { id: 'arch_meteor', rawHits: [[120, false], [120, false], [120, false], [120, false], [120, false], [260, true]], actors: 3 },
  { id: 'arch_poison-repeat', skill: 'arch_poison', rawHits: [[150, true], [70, false], [70, false]], actors: 1 },
];
const limits = [
  'Actual Character, Combat.updatePet, CombatView, production makeDog and wrapped CLASS_KITS.hunter runner in the existing VFX review scene; not a full Game/KitCaster/server combat session.',
  'The rules damage hook is observed without supplying a synthetic roll: createDummy receives the production FX preview damage and its normal seeded +/-10% spread. This is callback integration, not a balance or authoritative damage audit.',
  'Current preview near() measures 3D distance to the ground target position. Poison arrow height 1.55 exceeds radius 1.5; snipe arrow height 1.70 exceeds radius 1.6. Their arrow damage is absent in this unmodified review fixture; dog hits are asserted separately.',
  'Finite skinned vertices/transforms are sampled at 10 Hz plus all captured frames. No skin strain, all-frame anatomy, terrain contacts, planted-foot IK or jaw animation approval is implied.',
  'Rig has no automatically animated jaw; bite evidence is the actual procedural body/head attack, not a claim that the mouth opens.',
  'No account, profile, localStorage, save, API or WebSocket flow is used. Full-app guest follow remains untested.',
  'Existing Vite/HMR is left untouched. Source or asset changes/reloads during capture invalidate the run.',
];

async function installHarness() {
  const r = window.vfxReview;
  if (!r?.ready || r.id !== 'hunter') throw new Error('Actual hunter VFX review page did not boot');
  r.setAuto(false);
  // Vite rewrites changed imports with ?t=. Use the exact module instance that
  // the live kit/CombatView use; an unversioned import creates a second registry.
  const hunterModule = await (await fetch('/src/classes/fx/hunter-skills.js')).text();
  const dogImport = hunterModule.match(/^import[^\n]*from\s+['"]([^'"]*\/dog\.js[^'"]*)['"]/m);
  if (!dogImport) throw new Error('Cannot resolve the actual kit dog-module import');
  const dogModuleUrl = dogImport[1];
  const [{ V, createFx }, { preloadDog, followerDog, followerAway }, { createDummy }, { Character }, { Combat, Monster }, { CombatView }] = await Promise.all([
    import('/src/classes/fx/engine.js'), import(dogModuleUrl),
    import('/src/classes/fx/dummy.js'), import('/src/character/Character.js'),
    import('/src/combat/Combat.js'), import('/src/combat/CombatView.js'),
  ]);
  const source = await preloadDog();
  if (!source) throw new Error('Production dog GLB failed to load; primitive fallback is not acceptable');
  // The page's original runner/dummy stay idle and detached. These are new instances
  // of the same real production factories, enabling onHit/damage instrumentation.
  r.fx.clearTasks();
  r.scene.remove(r.fx.root);
  const labels = document.getElementById('labels');
  labels.replaceChildren();
  const fx = createFx({ scene: r.scene, camera: r.camera, renderer: r.renderer, labels, size: r.fx.K });
  const player = r.character.group;
  const c = new Character({ name: 'QA hunter companion', classId: 'hunter' });
  const combat = new Combat(c, { canStand: () => true, playerPos: () => player.position, stop() {}, moveTo() {} });
  const view = new CombatView(r.scene, combat, () => 0);
  const pet = view.pet; // CombatView itself calls nontransient makeDog(), scale .8.
  await Promise.resolve();
  let time = 0, active = null, lastGeometryAt = -Infinity, nextActor = 1;
  const actors = [], lifecycle = [];
  let lastPetAnimation = null;
  const actualPetAnimate = pet.userData.animate;
  pet.userData.animate = (...args) => {
    lastPetAnimation = { time, elapsed: args[0], moving: args[1], attacking: args[2], options: { ...(args[3] ?? {}) } };
    active?.petAnimations.push(lastPetAnimation);
    return actualPetAnimate(...args);
  };
  combat.on('pet-bite', event => active?.petEvents.push({ time, amount: event.amount, monsterId: event.monster.id }));
  const actualAdd = fx.add, actualKill = fx.kill;
  fx.add = object => {
    const result = actualAdd(object);
    if (object.name === 'hunter-dog') {
      const entry = { key: 'dog-' + nextActor++, dog: object, born: time, caseId: active?.id, retired: null };
      actors.push(entry);
      active?.actorKeys.push(entry.key);
    }
    return result;
  };
  fx.kill = object => {
    const entry = actors.find(a => a.dog === object);
    if (entry) entry.retired = time;
    return actualKill(object);
  };
  const dummy = createDummy(fx, labels, V(0, 0, -3), () => 0, {
    hp: 1e8,
    onHit(event) { active?.events.push({ type: 'hit', time, ...event }); },
  });
  const actualHurt = dummy.hurt;
  dummy.hurt = (...args) => {
    active?.events.push({ type: 'hurt', time, skill: active.lastResolvedSkill, rawAmount: args[0], crit: !!args[1], exact: !!args[4] });
    return actualHurt(...args);
  };
  const runner = r.kit.createSkills({
    fx, character: r.character, player, dummy, groundHeight: () => 0, canStand: () => true, labels,
    dim: document.createElement('div'),
    damage(id) {
      if (active) { active.lastResolvedSkill = id; active.events.push({ type: 'damage-callback', time, skill: id }); }
      // Preserve the page's original FX-preview damage path, including dummy hurt.
      return undefined;
    },
  });
  const live = () => actors.filter(a => a.dog.parent && a.retired == null);
  const posedBones = dog => {
    const result = [];
    dog.traverse(n => { if (n.isBone) result.push({ name: n.name, position: n.position.toArray(), quaternion: n.quaternion.toArray(), scale: n.scale.toArray() }); });
    return result;
  };
  const finiteDog = dog => {
    r.scene.updateMatrixWorld(true);
    let meshes = 0, skinned = 0, vertices = 0, bones = 0, maxEmissive = 0;
    const errors = [], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], p = V();
    dog.traverse(n => {
      if (![...n.matrixWorld.elements, ...n.position.toArray(), ...n.quaternion.toArray(), ...n.scale.toArray()].every(Number.isFinite)) errors.push('Nonfinite transform ' + n.name);
      if (n.isBone) bones++;
      if (!n.isMesh) return;
      meshes++; if (n.isSkinnedMesh) { skinned++; n.skeleton.update(); }
      for (const m of [].concat(n.material ?? [])) maxEmissive = Math.max(maxEmissive, Number(m.emissiveIntensity) || 0);
      for (const key of ['position', 'normal', 'skinWeight']) {
        const attribute = n.geometry.getAttribute(key);
        if (attribute && !Array.from(attribute.array).every(Number.isFinite)) errors.push('Nonfinite attribute ' + key);
      }
      const positions = n.geometry.getAttribute('position');
      if (!positions) { errors.push('Missing positions'); return; }
      for (let i = 0; i < positions.count; i++) {
        n.getVertexPosition(i, p).applyMatrix4(n.matrixWorld); vertices++;
        const values = p.toArray();
        if (!values.every(Number.isFinite)) { errors.push('Nonfinite posed vertex ' + i); break; }
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], values[k]); max[k] = Math.max(max[k], values[k]); }
      }
    });
    if (!vertices) errors.push('No dog vertices');
    return { meshes, skinned, vertices, bones, maxEmissive, bounds: { min, max }, finite: errors.length === 0, errors };
  };
  const snapshot = (withBones = false) => {
    const dogs = [ { key: 'world-follower', dog: pet }, ...live() ];
    return {
      time, caseTime: active ? time - active.start : 0, followerUuid: pet.uuid,
      followerRegistered: followerDog() === pet, followerAway: followerAway(), away: !!pet.userData.away, visible: pet.visible,
      followerScale: pet.getWorldScale(V()).toArray(), player: player.position.toArray(),
      heelDistance: Math.hypot(combat.pet.x - (player.position.x - 1.1), combat.pet.z - (player.position.z + .9)),
      busy: runner.busy, fxTasks: fx.tasks, liveActorKeys: live().map(a => a.key),
      petAnimation: lastPetAnimation, petCooldown: combat.pet.attackTimer,
      dogs: dogs.map(({ key, dog }) => ({ key, uuid: dog.uuid, visible: dog.visible, position: dog.getWorldPosition(V()).toArray(),
        worldScale: dog.getWorldScale(V()).toArray(), ...finiteDog(dog), ...(withBones ? { pose: posedBones(dog) } : {}) })),
    };
  };
  let lastLifecycle = '';
  async function tick(dt) {
    time += dt; runner.update(dt);
    r.character.update(dt, time, false, runner.facing);
    const previousCooldown = combat.pet.attackTimer;
    combat.updatePet(dt, player.position);
    view.update(dt, time, r.camera);
    if (active && combat.pet.attackTimer > previousCooldown) active.cooldownResets.push({ time, previousCooldown,
      cooldown: combat.pet.attackTimer, animation: lastPetAnimation, petHitCount: active.petEvents.length });
    dummy.update(dt); fx.update(dt, time, 0);
    // makeDog's cached-source attachment is asynchronous even when already loaded.
    await Promise.resolve(); await Promise.resolve();
    const state = { away: !!pet.userData.away, visible: pet.visible, actors: live().map(a => a.key) };
    const signature = JSON.stringify(state);
    if (signature !== lastLifecycle) {
      const event = { time, ...state }; lifecycle.push(event); active?.lifecycle.push(event); lastLifecycle = signature;
    }
    if (active) {
      active.awaySeen ||= !!pet.userData.away;
      active.movingSeen ||= !!combat.pet.moving;
      active.maxActors = Math.max(active.maxActors, live().length);
      if (time - lastGeometryAt >= .1 - 1e-9) {
        const sample = snapshot(); active.geometry.push(sample); lastGeometryAt = time;
      }
    }
  }
  function render() { r.scene.updateMatrixWorld(true); r.renderer.render(r.scene, r.camera); }
  async function advance(seconds) {
    for (let remaining = seconds; remaining > 1e-9;) {
      const dt = Math.min(1 / 60, remaining); await tick(dt); remaining -= dt;
    }
    render(); return snapshot(true);
  }
  async function until(condition, timeout = 12) {
    const isReady = () => {
      if (condition === 'away') return !!pet.userData.away && live().every(a => finiteDog(a.dog).skinned > 0);
      if (condition === 'hit') return active.events.some(e => e.type === 'hurt');
      if (condition === 'poison-landing') return active.events.some(e => e.type === 'hurt' && e.skill === 'arch_poison' && e.rawAmount === 150);
      if (condition === 'poison-airborne') return live().some(a => a.dog.position.y > .45) && !active.events.some(e => e.type === 'hurt' && e.skill === 'arch_poison' && e.rawAmount === 150);
      if (condition === 'auto-first') return active.cooldownResets.length >= 1;
      if (condition === 'auto-second') return active.cooldownResets.length >= 2;
      if (condition === 'returned') return active.awaySeen && !pet.userData.away && pet.visible && live().length === 0;
      if (condition === 'recast') return !runner.busy && !!pet.userData.away;
      throw new Error('Unknown condition ' + condition);
    };
    const stop = time + timeout;
    while (!isReady() && time < stop) await tick(1 / 60);
    render(); return { met: isReady(), condition, ...snapshot(true) };
  }
  async function begin(id) {
    if (pet.userData.away || live().length) throw new Error('Previous dog actor has not returned');
    await advance(3);
    if (runner.busy) throw new Error('Previous runner lock has not cleared');
    player.position.set(0, 0, 1); combat.target = null;
    combat.pet.placed = false; combat.pet.attackTimer = 0; combat.updatePet(0, player.position);
    view.update(0, 0, r.camera);
    dummy.hp = dummy.maxHp; dummy.alive = true; dummy.off.set(0, 0, 0); dummy.update(0);
    active = { id, start: time, events: [], casts: [], geometry: [], lifecycle: [], actorKeys: [], petEvents: [], petAnimations: [], cooldownResets: [], awaySeen: false, movingSeen: false, maxActors: 0,
      idlePoseBefore: posedBones(pet) };
    lastGeometryAt = -Infinity; render(); return snapshot(true);
  }
  function cast(skill) {
    const duration = runner.cast(skill, true);
    active.casts.push({ skill, time, duration }); render(); return { duration, ...snapshot(true) };
  }
  function blockedCast() {
    const before = { events: active.events.length, actors: actors.length, current: runner.current };
    const result = runner.cast('arch_quick', true);
    return { result, unchanged: before.events === active.events.length && before.actors === actors.length && before.current === runner.current };
  }
  async function finish() {
    await advance(3);
    combat.target = null; combat.updatePet(0, player.position); view.update(0, 0, r.camera); render();
    return { ...active, idlePoseAfter: posedBones(pet), final: snapshot(true),
      actors: actors.filter(a => a.caseId === active.id).map(a => ({ key: a.key, born: a.born, retired: a.retired })),
      // Native leap onLand runs at u=1; that same frame passes bite=u*.55 to animate.
      attackContract: { leapDuration: .42, leapLandingBitePhase: .55, biteOnSnapPhase: .55, geometrySampleHz: 10 } };
  }
  await begin('initial');
  const initial = snapshot(true);
  if (followerDog() !== pet || !initial.dogs[0].skinned) throw new Error('Actual CombatView follower is not registered/GLB-skinned');
  window.hunterDogGameplayQA = {
    initial, begin, cast, blockedCast, advance, until, snapshot: () => snapshot(true), finish,
    async follow() {
      await begin('world-follow');
      const start = player.position.x;
      for (let i = 1; i <= 90; i++) { player.position.x = start + i / 90 * 2; await tick(1 / 60); }
      render(); return snapshot(true);
    },
    async startAutoAttack(haste) {
      await begin(haste ? 'world-autoattack-haste' : 'world-autoattack');
      c.buffs = [];
      if (haste) c.addBuff({ id: 'qa-aspd', aspd: .35, duration: 60 });
      const target = new Monster('boar', {}, combat.pet.x + .5, combat.pet.z);
      target.maxHp = target.hp = 1e6;
      combat.target = target; combat.combatTimer = 10;
      active.attackSpeed = c.attackSpeed; active.expectedCooldown = 1.3 * (1 - c.attackSpeed);
      return snapshot(true);
    },
    async stopAutoAttack() {
      combat.target = null; combat.combatTimer = 0; c.buffs = [];
      return advance(.35);
    },
    source: { bones: posedBones(source).length, productionFactory: 'CombatView -> makeDog() -> preloadDog()', scale: .8, dogModuleUrl },
    async shutdown() {
      fx.clearTasks();
      for (const a of live()) fx.kill(a.dog);
      pet.visible = true; pet.userData.away = false;
      view.root.remove(pet); followerDog(); r.scene.remove(view.root); r.scene.remove(fx.root);
    },
  };
  return { initial, source: window.hunterDogGameplayQA.source, skills: r.kit.skills.map(s => ({ id: s.id, hits: s.hits, duration: s.duration })) };
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || !argv.length) {
    console.log('Owner release required. Usage: node tools/hunter-dog/gameplay-qa.mjs --published-sha256 <64-hex SHA256> [--label final-1]');
    console.log(JSON.stringify({ cases: ['world-follow', 'world-autoattack', 'world-autoattack-haste', ...cases.map(c => c.id), 'late-callback-owner', 'borrowed-command-recast'], limits }, null, 2));
    return;
  }
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert.ok(['--published-sha256', '--label'].includes(argv[i]) && argv[i + 1], 'Unknown/missing argument: ' + argv[i]);
    options[argv[i]] = argv[i + 1];
  }
  const expectedHash = options['--published-sha256'];
  assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/i, 'A published candidate SHA-256 is mandatory before browser launch');
  const label = options['--label'] ?? ('final-' + new Date().toISOString().replace(/[:.]/g, '-'));
  assert.match(label, /^[a-zA-Z0-9_-]{1,80}$/, 'Invalid output label');
  const base = process.env.TNO_QA_URL || 'http://127.0.0.1:5191';
  const assetPath = resolve(root, 'public/models/hunter-dog.glb');
  const bytes = await readFile(assetPath);
  assert.equal(hash(bytes), expectedHash.toLowerCase(), 'Public dog does not match the owner-released hash; browser not launched');
  const output = resolve(root, 'docs/art/reviews/hunter-dog/gameplay', label);
  const reportPath = resolve(output, 'report.json');
  try { await access(reportPath); throw new Error('Receipt exists; choose a fresh --label'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const moduleFiles = ['src/classes/dog.js', 'src/classes/fx/hunter-skills.js', 'src/classes/hunter-moves.js',
    'src/classes/tempo.js', 'src/classes/index.js', 'src/classes/fx/class-detail.js', 'src/classes/fx/dummy.js',
    'src/classes/fx/engine.js', 'src/combat/Combat.js', 'src/combat/CombatView.js', 'src/character/Character.js', 'tools/vfx-review.html'];
  const modules = await Promise.all(moduleFiles.map(async path => ({ path, beforeSha256: hash(await readFile(resolve(root, path))) })));
  await mkdir(output, { recursive: true });
  const report = {
    schema: 1, startedAt: new Date().toISOString(), scope: 'published dog actual skill/follower component integration',
    url: base + '/tools/vfx-review.html?class=hunter', asset: { path: assetPath, bytes: bytes.length, sha256: hash(bytes), loadedResponses: [] },
    modules, browser: { channel: 'msedge', headless: true, instances: 1, pages: 1, closed: false },
    limits, cases: [], images: [], failures: [], pageErrors: [], requestErrors: [], warnings: [],
  };
  const check = (ok, message) => { if (!ok) report.failures.push(message); };
  let browser, page;
  const pending = new Set();
  let receiptSerial = 0;
  const persist = async () => {
    const temporary = resolve(output, 'report-' + receiptSerial++ + '.tmp');
    const content = JSON.stringify(report, null, 2) + '\n';
    for (let attempt = 0; ; attempt++) {
      try { await writeFile(temporary, content); await rename(temporary, reportPath); return; }
      catch (error) {
        if (attempt >= 5 || !['UNKNOWN', 'EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
        await delay(50 * (attempt + 1));
      }
    }
  };
  const shot = async (id, receipt) => {
    const path = resolve(output, id + '.png');
    await page.locator('canvas').screenshot({ path });
    const png = await readFile(path);
    report.images.push({ id, path, width: png.readUInt32BE(16), height: png.readUInt32BE(20), sha256: hash(png), receipt });
    await persist();
  };
  const examine = record => {
    check(record.final.followerRegistered, record.id + ': followerDog() changed');
    check(record.final.visible && !record.final.away && !record.final.followerAway, record.id + ': follower visibility/away did not restore');
    check(record.final.liveActorKeys.length === 0 && record.actors.every(a => a.retired != null), record.id + ': transient dog left in scene');
    check(record.final.followerScale.every(k => Math.abs(k - .8) < 1e-6), record.id + ': world follower scale drift');
    check(JSON.stringify(record.idlePoseBefore) === JSON.stringify(record.idlePoseAfter), record.id + ': follower idle pose retained attack residue');
    for (const sample of record.geometry) for (const dog of sample.dogs) check(dog.finite, record.id + ': nonfinite dog geometry ' + dog.key);
    const callbacks = record.events.filter(e => e.type === 'damage-callback'), hurts = record.events.filter(e => e.type === 'hurt'), hits = record.events.filter(e => e.type === 'hit');
    check(callbacks.length === hurts.length && hurts.length === hits.length, record.id + ': damage callback/hurt/onHit order count mismatch');
    for (let i = 0; i < hurts.length; i++) {
      check(callbacks[i].skill === hurts[i].skill && callbacks[i].time === hurts[i].time && hits[i].time === hurts[i].time, record.id + ': callback/hurt/hit did not pair at index ' + i);
      check(Number.isFinite(hits[i].amount) && hits[i].amount > 0, record.id + ': nonpositive/nonfinite real dummy damage');
    }
  };
  try {
    const require = createRequire(import.meta.url);
    const { chromium } = require(process.env.TNO_PLAYWRIGHT_DIR || 'C:/Users/panup/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(30000);
    page.on('pageerror', e => report.pageErrors.push(e.message));
    page.on('requestfailed', req => report.requestErrors.push({ url: req.url(), error: req.failure()?.errorText }));
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) report.warnings.push({ type: msg.type(), text: msg.text() }); });
    page.on('response', response => {
      if (response.status() >= 400) report.requestErrors.push({ url: response.url(), status: response.status() });
      if (new URL(response.url()).pathname !== '/models/hunter-dog.glb' || (response.status() >= 300 && response.status() < 400)) return;
      const task = response.body().then(data => report.asset.loadedResponses.push({ url: response.url(), status: response.status(), bytes: data.length, sha256: hash(data) }))
        .catch(e => report.failures.push('GLB response hash failed: ' + e.message));
      pending.add(task); task.finally(() => pending.delete(task));
    });
    await page.addInitScript(() => {
      let seed = 3334;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    });
    await page.goto(report.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.vfxReview?.ready && window.vfxReview.id === 'hunter', null, { timeout: 60000 });
    report.boot = await page.evaluate(installHarness);
    await shot('world-follow-idle', report.boot.initial);
    const moving = await page.evaluate(() => window.hunterDogGameplayQA.follow());
    await shot('world-follow-trot', moving);
    const following = await page.evaluate(() => window.hunterDogGameplayQA.finish());
    check(following.movingSeen, 'world-follow: Combat.updatePet never moved');
    check(following.final.heelDistance <= .61, 'world-follow: dog failed to heel after player movement');
    examine(following); report.cases.push(following);
    await shot('world-follow-settled', following.final);
    for (const haste of [false, true]) {
      const start = await page.evaluate(haste => window.hunterDogGameplayQA.startAutoAttack(haste), haste);
      const id = haste ? 'world-autoattack-haste' : 'world-autoattack';
      await shot(id + '-before', start);
      const strike = await page.evaluate(() => window.hunterDogGameplayQA.until('auto-first', 3));
      check(strike.met && Math.abs((strike.petAnimation?.options.bite ?? -1) - .55) < 1e-9, id + ': cooldown reset did not start native bite phase .55');
      await shot(id + '-impact-055', strike);
      const recovering = await page.evaluate(() => window.hunterDogGameplayQA.advance(.125));
      check(recovering.petAnimation?.options.bite > .55 && recovering.petAnimation.options.bite < 1, id + ': native attack recovery did not advance');
      await shot(id + '-recovery', recovering);
      const cleared = await page.evaluate(() => window.hunterDogGameplayQA.advance(.15));
      check(cleared.petAnimation?.options.bite == null, id + ': bite phase remained after .25 second recovery');
      const repeat = await page.evaluate(() => window.hunterDogGameplayQA.until('auto-second', 3));
      check(repeat.met && Math.abs((repeat.petAnimation?.options.bite ?? -1) - .55) < 1e-9, id + ': second actual cooldown reset lost impact alignment');
      await shot(id + '-repeat-impact-055', repeat);
      await page.evaluate(() => window.hunterDogGameplayQA.stopAutoAttack());
      const record = await page.evaluate(() => window.hunterDogGameplayQA.finish());
      examine(record);
      check(record.petEvents.length > 0 && record.petEvents.every(e => Number.isFinite(e.amount) && e.amount > 0), id + ': no positive actual Combat pet-bite damage observed');
      if (record.cooldownResets.length >= 2) {
        const [first, second] = record.cooldownResets;
        check(Math.abs(second.time - first.time - record.expectedCooldown) <= 2 / 60, id + ': repeated native cooldown spacing differed');
      }
      check(!record.awaySeen && record.maxActors === 0, id + ': normal world attack borrowed or duplicated the follower');
      report.cases.push(record); await shot(id + '-idle-reset', record.final);
      await persist();
    }
    for (const test of cases) {
      const skill = test.skill ?? test.id;
      const before = await page.evaluate(id => window.hunterDogGameplayQA.begin(id), test.id);
      await shot(test.id + '-before', before);
      const cast = await page.evaluate(skill => window.hunterDogGameplayQA.cast(skill), skill);
      check(Number.isFinite(cast.duration) && cast.duration > 0, test.id + ': cast rejected');
      check(await page.evaluate(() => { const r = window.hunterDogGameplayQA.blockedCast(); return r.result === false && r.unchanged; }), test.id + ': busy cast changed active skill/dog');
      const away = await page.evaluate(() => window.hunterDogGameplayQA.until('away', 4));
      check(away.met && !away.visible && away.followerAway, test.id + ': real world dog was not hidden/borrowed');
      check(away.dogs.slice(1).every(d => d.skinned > 0), test.id + ': transient copy remained a primitive fallback');
      await shot(test.id + '-borrowed', away);
      if (skill === 'arch_poison') {
        const airborne = await page.evaluate(() => window.hunterDogGameplayQA.until('poison-airborne', 3));
        check(airborne.met, test.id + ': native leap preparation not witnessed before landing damage');
        await shot(test.id + '-airborne-preparation', airborne);
      }
      const impact = await page.evaluate(skill => window.hunterDogGameplayQA.until(skill === 'arch_poison' ? 'poison-landing' : 'hit', 6), skill);
      check(impact.met, test.id + ': expected damage callback never occurred');
      if (skill === 'arch_poison') impact.phaseEvidence = { source: 'native leap onLand frame; u=1, animate bite=u*.55', bite: .55, timingOverride: false };
      await shot(test.id + (skill === 'arch_poison' ? '-landing-bite-055' : '-impact'), impact);
      const action = await page.evaluate(() => window.hunterDogGameplayQA.advance(.55));
      await shot(test.id + '-action', action);
      const returned = await page.evaluate(() => window.hunterDogGameplayQA.until('returned', 12));
      check(returned.met, test.id + ': dog did not return before native safety lifetime');
      await shot(test.id + '-returned', returned);
      const record = await page.evaluate(() => window.hunterDogGameplayQA.finish());
      record.expectedPreviewHits = test.rawHits; examine(record);
      const hurts = record.events.filter(e => e.type === 'hurt');
      check(JSON.stringify(hurts.map(e => [e.rawAmount, e.crit])) === JSON.stringify(test.rawHits), test.id + ': raw production preview hit sequence differs');
      check(record.events.filter(e => e.type === 'damage-callback').every(e => e.skill === skill), test.id + ': callback lost original skill id');
      check(record.maxActors === test.actors, test.id + ': wrong borrowed/spirit dog count');
      check(record.geometry.some(s => s.dogs.slice(1).some(d => d.skinned > 0)), test.id + ': no real skinned actor witnessed');
      if (test.actors === 3) check(record.geometry.some(s => s.dogs.slice(1).filter(d => d.skinned && d.maxEmissive > .2).length >= 2), test.id + ': two glowing spirit dogs not witnessed');
      report.cases.push(record); await persist();
      console.log(test.id + ': ' + hurts.length + ' native preview hits, max actors ' + record.maxActors);
    }
    for (const replacement of ['arch_quick', 'arch_garuda']) {
      const id = replacement === 'arch_quick' ? 'late-callback-owner' : 'borrowed-command-recast';
      await page.evaluate(id => window.hunterDogGameplayQA.begin(id), id);
      await page.evaluate(() => window.hunterDogGameplayQA.cast('arch_poison'));
      await page.evaluate(() => window.hunterDogGameplayQA.until('away', 4));
      const ready = await page.evaluate(() => window.hunterDogGameplayQA.until('recast', 4));
      check(ready.met, id + ': no unlocked borrowed interval available');
      await shot(id + '-before-recast', ready);
      const cast = await page.evaluate(skill => window.hunterDogGameplayQA.cast(skill), replacement);
      check(cast.duration > 0, id + ': replacement cast rejected');
      await shot(id + '-after-recast', cast);
      const returned = await page.evaluate(() => window.hunterDogGameplayQA.until('returned', 12));
      check(returned.met, id + ': follower did not return');
      await shot(id + '-returned', returned);
      const record = await page.evaluate(() => window.hunterDogGameplayQA.finish());
      examine(record);
      if (replacement === 'arch_quick') {
        check(record.events.some(e => e.type === 'damage-callback' && e.skill === 'arch_poison' && e.time > cast.time), id + ': late hold damage lost its poison owner');
        check(record.events.some(e => e.type === 'damage-callback' && e.skill === 'arch_quick'), id + ': replacement arrow callback not observed');
      } else {
        check(record.actorKeys.length === 1 && record.maxActors === 1, id + ': re-order created a duplicate borrowed dog');
        check(record.events.some(e => e.type === 'hurt' && e.skill === 'arch_garuda' && e.rawAmount === 90), id + ': re-ordered howl hit missing');
      }
      report.cases.push(record); await persist();
    }
    report.sameFollowerThroughout = report.cases.every(c => c.final.followerUuid === report.boot.initial.followerUuid);
    check(report.sameFollowerThroughout, 'World follower was replaced instead of returned');
    await Promise.all([...pending]);
    check(report.asset.loadedResponses.length > 0 && report.asset.loadedResponses.every(r => r.status === 200 && r.sha256 === report.asset.sha256), 'Rendered production GLB network bytes do not match published candidate');
    report.asset.afterSha256 = hash(await readFile(assetPath));
    check(report.asset.afterSha256 === report.asset.sha256, 'Public GLB changed during capture');
    for (const source of modules) { source.afterSha256 = hash(await readFile(resolve(root, source.path))); check(source.afterSha256 === source.beforeSha256, 'Source changed during capture: ' + source.path); }
    check(report.pageErrors.length === 0 && report.requestErrors.length === 0, 'Page or asset request errors occurred');
    report.passed = report.failures.length === 0;
    if (!report.passed) process.exitCode = 1;
  } catch (error) { report.failures.push(error.stack ?? String(error)); report.passed = false; process.exitCode = 1; }
  finally {
    await Promise.all([...pending]);
    if (page && !page.isClosed()) await page.evaluate(() => window.hunterDogGameplayQA?.shutdown()).catch(() => {});
    if (browser) { await browser.close(); report.browser.closed = true; }
    await Promise.all([...pending]);
    report.finishedAt = new Date().toISOString(); await persist();
    console.log(JSON.stringify({ passed: report.passed, cases: report.cases.length, screenshots: report.images.length, failures: report.failures, browserClosed: report.browser.closed, report: reportPath }));
  }
}
await main();
