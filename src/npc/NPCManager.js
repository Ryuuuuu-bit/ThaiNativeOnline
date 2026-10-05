import { NPC } from '../entities/NPC.js';
import { NPCRenderer } from './NPCRenderer.js';
import { NavGraph } from './NavGraph.js';
import { makeLook, OCCUPATIONS } from './NPCData.js';
import { activityFor, normalizeStops } from './NPCSchedule.js';
import { J } from '../world/CityMap.js';

// Owns the population: builds the nav graph, resolves spots and homes, reacts
// to world-phase changes and updates NPCs in distance tiers so far-away
// townsfolk cost almost nothing.
const NEAR = 48, MID = 95, FAR_TICK = 1, MID_TICK = .2;

export class NPCManager {
  constructor(scene, world, defs, clock) {
    this.world = world; this.clock = clock;
    this.nav = NavGraph.fromRoads();
    // Spots registered by the districts become graph nodes linked to their road.
    for (const [id, s] of Object.entries(world.spots)) Object.assign(this.nav.add(id, s.x, s.z), { spot: true, face: s.face });
    for (const [id, s] of Object.entries(world.spots)) this.link(id, s.link);
    this.homes = Object.keys(world.spots).filter(id => id.startsWith('door_')).map(id => ({ id, n: 0 }));
    this.npcs = defs.map(def => {
      const npc = new NPC(def, makeLook(def), this);
      this.prepare(npc);
      return npc;
    });
    for (const npc of this.npcs) npc.setActivity(activityFor(npc.def, clock.phase), true);
    this.renderer = new NPCRenderer(scene, this.npcs);
    clock.onPhase(phase => {
      // Stagger reactions so the town does not move in lockstep.
      for (const npc of this.npcs) npc.pending = { activity: activityFor(npc.def, phase), delay: Math.random() * 10 };
    });
    this.tick = 0;
  }
  link(id, target) {
    const node = this.nav.nodes.get(id);
    const to = target && this.nav.nodes.get(target) ? target : this.nav.nearest(node.x, node.z, n => !n.spot && n.id !== id)?.id;
    if (target && !this.nav.nodes.get(target)) console.warn(`[npc] spot ${id} links to unknown node ${target}`);
    this.nav.connect(id, to);
  }
  // Resolve literal positions, missing spots and homes before the first plan.
  prepare(npc) {
    let n = 0;
    const fix = at => {
      if (typeof at === 'object') {
        const id = `lit:${npc.id}:${n++}`;
        Object.assign(this.nav.add(id, at.x, at.z), { spot: true, face: at.face });
        this.link(id, at.link);
        return id;
      }
      if (!this.nav.nodes.has(at)) { console.warn(`[npc] ${npc.id}: unknown spot ${at}`); return null; }
      return at;
    };
    const schedule = {};
    for (const [phase, act] of Object.entries(npc.def.schedule ?? {})) {
      if (act.do === 'route') { const stops = normalizeStops(act.stops).map(s => ({ ...s, at: fix(s.at) })).filter(s => s.at); schedule[phase] = { ...act, stops }; }
      else if (act.do === 'stay') { const at = fix(act.at); schedule[phase] = at ? { ...act, at } : { do: 'home' }; }
      else schedule[phase] = act;
    }
    npc.def = { ...npc.def, schedule };
    const home = npc.def.home;
    if (typeof home === 'string' && this.nav.nodes.has(home)) npc.homeId = home;
    else {
      const near = J[home?.near] ?? [npc.x, npc.z];
      const options = this.homes.filter(h => h.n < 2).map(h => ({ h, d: Math.hypot(this.nav.nodes.get(h.id).x - near[0], this.nav.nodes.get(h.id).z - near[1]) })).sort((a, b) => a.d - b.d);
      if (options.length && options[0].d < 45) { options[0].h.n++; npc.homeId = options[0].h.id; }
      else npc.homeId = home?.near ?? this.nav.nearest(npc.x, npc.z).id;
    }
  }
  homeOf(npc) { return npc.homeId; }

  update(dt, t, focus) {
    this.tick++;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc.pending && (npc.pending.delay -= dt) <= 0) { npc.setActivity(npc.pending.activity); npc.pending = null; }
      npc.distance = Math.hypot(npc.x - focus.x, npc.z - focus.z);
      npc.accum += dt;
      const step = npc.distance < NEAR ? 0 : npc.distance < MID ? MID_TICK : FAR_TICK;
      if (npc.accum < step) continue;
      npc.update(npc.accum, t, this.world);
      npc.accum = 0; npc.dirty = true;
      npc.shown = !npc.indoors && npc.distance < MID + 10;
    }
    this.renderer.update();
  }
  nearestInteractable(x, z) {
    let best = null, bd = Infinity;
    for (const npc of this.npcs) {
      if (!npc.shown) continue;
      const d = Math.hypot(npc.x - x, npc.z - z);
      if (d < npc.interactionRadius && d < bd) { bd = d; best = npc; }
    }
    return best;
  }
  // Hooks for the future Karma/PvP system: guards near a position.
  guardsNear(x, z, r) { return this.npcs.filter(n => n.def.faction === 'city_guard' && Math.hypot(n.x - x, n.z - z) < r); }
  label(npc) { return OCCUPATIONS[npc.def.occupation]?.label ?? ''; }
  get visibleCount() { return this.npcs.filter(n => n.shown && n.distance < 40).length; }
}
