// Other players' class skills, played on their models (server relays `fx`, server/index.js).
// The caster's own KitCaster says which skill went off and at which monster (combat 'kit-fx');
// here each remote player gets the same FX runner their class uses (src/classes CLASS_KITS),
// bound to their model and to that monster — but the blows do nothing here (the server
// rolls them), and the bits meant for the caster's own screen (shake, hit-stop, mood, combo
// counters, the dim) stay off.
//   attachRemoteSkills(net, game, remote, netCombat) → { update(dt) }
import * as THREE from 'three';
import { CLASS_KITS } from '../classes/index.js';
import { avatarFor } from '../data/training.js';
import { stubTarget, monsterTarget, createTargetProxy } from '../training/targets.js';

// what an FX engine call may change on this player's own screen: camera shake, hit-stop,
// the darkened mood of a big skill, the camera punch — kept as they were around every call
// a remote runner makes (and every callback it schedules)
const OWN_SCREEN = ['shake', 'stop', 'mood', 'moodTarget', 'moodHold', 'punchV'];

export function attachRemoteSkills(net, game, remote, netCombat) {
  const runners = new Map();   // remote player id → { runner, proxy, stand, body }
  let quietFx = null;
  // the training ground's FX engine, minus what would shake or dim this player's screen
  const fxFor = () => {
    const fx = game.training?.fx; if (!fx) return null;
    if (quietFx?.target === fx) return quietFx.proxy;
    const quiet = fn => (...args) => {
      const kept = OWN_SCREEN.map(k => fx[k]);
      try { return fn(...args); } finally { OWN_SCREEN.forEach((k, i) => { fx[k] = kept[i]; }); }
    };
    const proxy = new Proxy(fx, {
      get: (t, k) => {
        const v = t[k]; if (typeof v !== 'function') return v;
        if (k === 'after') return (secs, fn) => v.call(t, secs, quiet(fn));
        if (k === 'addTask') return fn => v.call(t, quiet(fn));
        return quiet(v.bind(t));
      },
      set: (t, k, v) => { if (!OWN_SCREEN.includes(k)) t[k] = v; return true; },
    });
    quietFx = { target: fx, proxy };
    return proxy;
  };
  const offscreen = () => document.createElement('div');
  const runnerOf = r => {
    let e = runners.get(r.id);
    if (e && e.model === r.model) return e;
    const fx = fxFor(), kit = CLASS_KITS[avatarFor(r.cls).skills]; if (!fx || !kit) return null;
    // a stand-in for the remote player's group: runners may move it (dashes); the network moves the real one
    const stand = new THREE.Object3D();
    const stub = stubTarget(fx, stand), proxy = createTargetProxy(stub);
    const runner = kit.createSkills({ fx, character: r.model, player: stand, dummy: proxy, groundHeight: (x, z) => game.world?.heightAt(x, z) ?? 0, labels: offscreen(), dim: offscreen(), damage: () => null });
    runner.range = Infinity;
    e = { runner, proxy, stub, stand, model: r.model, fx };
    runners.set(r.id, e);
    return e;
  };
  net.on('fx', m => {
    const r = remote.list.get(m.from); if (!r || !r.model.group.visible) return;
    const e = runnerOf(r); if (!e) return;
    e.stand.position.copy(r.model.group.position); e.stand.rotation.y = r.tf;
    const mon = m.tgt != null ? netCombat?.monster(m.tgt) : null;
    e.proxy.bind(mon?.alive ? monsterTarget(mon, { fx: e.fx, canStand: () => false, onHurt: () => 0, onMiss: () => {} }) : e.stub);
    r.skillUntil = performance.now() / 1000 + (e.runner.cast(m.skill, true) || 0);
  });
  net.on('leave', m => runners.delete(m.id));
  net.on('welcome', () => runners.clear());
  return {
    update(dt) {
      for (const [id, e] of runners) {
        const r = remote.list.get(id); if (!r) { runners.delete(id); continue; }
        e.stand.position.copy(r.model.group.position);
        e.runner.update(dt);
        r.skillFacing = e.runner.busy ? e.runner.facing : null;
      }
    },
  };
}
