import { loadingMarkup } from '../ui/Brand.js';
import { buildWorld } from './World.js';
import { slotStorage } from '../core/SaveSlot.js'; // per-character save slot (src/account)
import { Portals } from './Portals.js';
import { HuntingGrounds } from './HuntingGrounds.js';
import { J } from './CityMap.js';
import { MAPS, DEFAULT_MAP, mapOf, portalAt, landmarksOf, spawnsOf, npcsForMap, walkable, resolveLocation } from './maps.js';
import { NPCManager } from '../npc/NPCManager.js';
import { NPCS } from '../data/npcs.js';
import { LANDMARKS } from '../data/landmarks.js';
import { SPAWNS, combatSpawns } from '../data/spawns.js';

// Keeps exactly one map (src/world/maps.js) in the scene and moves the player
// between maps through portals. Interface: src/world/README.md.
export const LOCATION_KEY = 'tno.location.v1';
const NONE = Object.freeze([]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export class MapManager {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {WorldClock} o.clock
   * @param {{position: THREE.Vector3, group: THREE.Object3D}} o.player
   * @param {(text: string) => void} [o.progress]  loading messages
   * @param {(info: {map, world, npcs, from}) => void} [o.onChange]  after a map is in place
   * @param {(info: {map, to}) => void} [o.onLeave]  before a map is unloaded
   */
  constructor({ scene, clock, player, progress = () => {}, onChange = () => {}, onLeave = () => {} }) {
    Object.assign(this, { scene, clock, player, progress, onChange, onLeave });
    this.map = null; this.world = null; this.npcs = null; this.portals = null;
    this.busy = false; this.armed = false; this.rpg = null; this.saveTimer = 0;
    // Monster zones for createGame({ spawns }). Each is tagged with its map and is
    // only active on that map (Combat reads `active` every frame).
    this.zones = combatSpawns().map(z => ({ ...z, map: mapOf(z.x, z.z), phases: z.active }));
    this.respawn = { x: MAPS[DEFAULT_MAP].spawn.x, z: MAPS[DEFAULT_MAP].spawn.z };
    this.landmarks = []; this.spawnAreas = [];
    this.overlay = null;
    addEventListener('beforeunload', () => { if (!this.busy) this.save(); });
  }

  // Where to begin: ?at=x,z (and optional ?map=id), the saved location, or the city spawn.
  static startLocation(params) {
    if (params?.has('at')) {
      const [x, z] = params.get('at').split(',').map(Number);
      const map = MAPS[params.get('map')] ? params.get('map') : mapOf(x, z);
      return { map, x, z, facing: Math.PI };
    }
    try {
      // resolveLocation also moves saves of a retired map (`fields`) onto the zone map that owns the position.
      const saved = resolveLocation(JSON.parse(slotStorage.getItem(LOCATION_KEY) ?? 'null'));
      if (saved) return saved;
    } catch { /* storage unavailable */ }
    return { map: DEFAULT_MAP, ...MAPS[DEFAULT_MAP].spawn };
  }

  async start(location) {
    await this.load(location.map);
    this.place(location);
    this.onChange({ map: this.map, world: this.world, npcs: this.npcs, from: null });
    return this.world;
  }

  async load(mapId) {
    const map = MAPS[mapId] ?? MAPS[DEFAULT_MAP];
    const report = text => { this.progress(text); if (this.busy && this.overlay) this.overlay.querySelector('[data-loading-text]').textContent = text; };
    const world = await buildWorld(this.scene, report, map);
    report('ชาวเมืองกำลังออกจากบ้าน…'); await wait(0);
    const has = id => !!world.spots[id] || (!!J[id] && walkable(map, ...J[id]));
    const npcs = new NPCManager(world.root, world, npcsForMap(NPCS, map.id, has), this.clock);
    this.portals = new Portals(world.root, map, (x, z) => world.heightAt(x, z));
    this.hunting = new HuntingGrounds(world.root,map,(x,z)=>world.heightAt(x,z));
    Object.assign(this, { map, world, npcs });
    this.landmarks = landmarksOf(map.id, LANDMARKS);
    this.spawnAreas = spawnsOf(map.id, SPAWNS);
    for (const z of this.zones) z.active = z.map === map.id ? z.phases : NONE;
    const [rx, rz] = map.respawn.find(([x, z]) => world.canStand(x, z)) ?? [map.spawn.x, map.spawn.z];
    Object.assign(this.respawn, { x: rx, z: rz });
    return world;
  }

  // Unload the current map completely: NPCs, monsters of this map, scenery.
  unload() {
    this.releaseMonsters(null);
    this.npcs?.dispose();
    const freed = this.world?.dispose();
    Object.assign(this, { world: null, npcs: null, portals: null, hunting: null, map: null });
    return freed;
  }

  place({ x, z, facing = Math.PI }) {
    const w = this.world;
    if (!w.canStand(x, z)) ({ x, z, facing } = this.map.spawn);
    this.player.position.set(x, w.heightAt(x, z), z);
    this.player.group.rotation.y = facing;
    // Arriving on a portal's mouth must not send the player straight back.
    this.armed = !portalAt(this.map, x, z);
    this.save();
  }

  // Combat (src/combat) keeps one monster list for the whole game; this bridge
  // hides the monsters of maps that are not loaded. Call once after createGame.
  attachCombat(rpg) { this.rpg = rpg; }
  attachTraining(training) { this.training = training; }   // the class skill runner (src/training): its moves hold a portal
  // Despawn every live monster whose zone is not on `mapId` (null: all of them)
  // and release the GPU buffers of their views. Uses Combat's own despawn path.
  releaseMonsters(mapId) {
    const rpg = this.rpg;
    if (!rpg?.ready) return;
    const combat = rpg.combat, p = this.player.position;
    for (const z of this.zones) z.active = z.map === mapId ? z.phases : NONE;
    for (const m of combat.monsters) {
      if (m.spawn.map === mapId) continue;
      if (m.state === 'chase') m.state = 'return';
      combat.updateMonster(m, 0, p);
      const view = rpg.view.views.get(m.id);
      if (!view) continue;
      view.dying = 0; view.group.visible = false;
      view.group.traverse(o => { o.geometry?.dispose(); if (o.isMesh) o.material.dispose(); });
    }
    if (combat.target && combat.target.spawn.map !== mapId) combat.setTarget(null);
    combat.cancelPending();
  }

  // Per frame: animate portals, travel when the player steps into one, save the location.
  update(dt, elapsed) {
    if (this.busy || !this.world) return;
    this.portals.update(elapsed,this.player.position);
    this.hunting?.update(this.player.position);
    const p = this.player.position, portal = portalAt(this.map, p.x, p.z);
    if (!portal) this.armed = true;
    // a skill move carrying the player (a dash) ends first; the portal takes them once they stand
    else if (this.armed && !this.training?.busy) { this.travel(portal); return; }
    if ((this.saveTimer += dt) > 3) { this.saveTimer = 0; this.save(); }
  }

  async travel(portal) {
    if (this.busy) return;
    this.busy = true;
    const from = this.map, to = MAPS[portal.to];
    this.onLeave({ map: from, to });
    this.fade(true, to);
    await wait(300);
    const started = performance.now();
    this.unload();
    await this.load(to.id);
    this.place(portal.arrive);
    this.lastTravelMs = Math.round(performance.now() - started);
    this.onChange({ map: this.map, world: this.world, npcs: this.npcs, from });
    this.busy = false;
    this.fade(false);
  }

  save() {
    if (!this.map) return;
    const p = this.player.position;
    slotStorage.setItem(LOCATION_KEY, JSON.stringify({ map: this.map.id, x: +p.x.toFixed(2), z: +p.z.toFixed(2), facing: +this.player.group.rotation.y.toFixed(3) }));
  }

  // Full-screen fade while maps swap (DOM overlay, inline styles).
  fade(on, to) {
    if (!this.overlay) {
      const el = this.overlay = document.createElement('div');
      el.id = 'map-fade'; el.setAttribute('aria-live', 'polite');
      Object.assign(el.style, {
        position: 'fixed', inset: '0', zIndex: '25', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
        background: '#0e1a15', color: '#f3ead0', opacity: '0', transition: 'opacity .28s ease', pointerEvents: 'none', textShadow: '0 2px 14px #000a',
      });
      el.innerHTML = loadingMarkup().replace('id="loading-text"', 'data-loading-text');
      document.body.append(el);
    }
    const el = this.overlay;
    if (on) { el.querySelector('[data-loading-title]').textContent = to.name; el.querySelector('[data-loading-text]').textContent = to.sub ?? 'กำลังเดินทาง…'; }
    el.style.pointerEvents = on ? 'auto' : 'none';
    el.style.opacity = on ? '1' : '0';
  }
}
