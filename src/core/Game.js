import * as THREE from 'three';
import { MapManager } from '../world/MapManager.js';
import { MAPS, walkBounds } from '../world/maps.js';
import { Environment } from '../world/Environment.js';
import { windUniforms } from '../world/shaders.js';
import { Player } from '../entities/Player.js';
import { LANDMARKS } from '../data/landmarks.js';
import { activeSpawns } from '../data/spawns.js';
import { regionAt } from '../data/regions.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { CameraController } from './CameraController.js';
import { InputManager } from './InputManager.js';
import { WorldClock, PHASE_HOURS } from './WorldClock.js';
import { AudioAmbience } from './AudioAmbience.js';
import { findPath } from './GridPath.js';
import { createGame } from '../combat/index.js';
import { QUESTS } from '../data/quests.js';
import { SHOPS } from '../data/shops.js';
import { QuestSystem } from '../quest/QuestSystem.js';
import { QuestUI } from '../ui/QuestUI.js';
import { ShopPanel } from '../ui/ShopPanel.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

export class Game {
  // The active map's world and NPCs live in the map manager (src/world/MapManager.js).
  get world() { return this.maps?.world ?? null; }
  get npcs() { return this.maps?.npcs ?? null; }

  async start() {
    const host = this.host = $('world');
    try { this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (error) { document.body.dataset.error = 'webgl'; $('loading-text').textContent = 'ไม่สามารถเปิด WebGL ได้ กรุณาเปิด hardware acceleration แล้วลองใหม่'; throw error; }
    const r = this.renderer;
    host.appendChild(r.domElement);
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.18;
    this.scene = new THREE.Scene();
    this.env = new Environment(this.scene, r);
    this.view = new CameraController(r, host);
    this.clock = new WorldClock({ hour: params.has('t') ? Number(params.get('t')) : 7.4 });
    if (params.has('t')) this.clock.paused = true;
    this.hud = new HUD();
    this.audio = new AudioAmbience();

    this.player = new Player(this.scene);
    this.discovered = new Set();
    try { for (const id of JSON.parse(localStorage.getItem('tno.discovered.v1') ?? '[]')) this.discovered.add(id); } catch { /* storage unavailable */ }
    // One map at a time; walking through the north gate swaps city ⇄ wilds.
    this.maps = new MapManager({
      scene: this.scene, clock: this.clock, player: this.player,
      progress: text => { $('loading-text').textContent = text; },
      onLeave: () => this.leaveMap(), onChange: info => this.enterMap(info),
    });
    await this.maps.start(MapManager.startLocation(params));
    // Quests and vendors attach to the character once one exists (after creation or load).
    this.quests = new QuestSystem(QUESTS, { isDiscovered: id => this.discovered.has(id) });
    this.questUI = new QuestUI(this.quests, {
      onAccept: id => { if (this.quests.accept(id)) this.hud.toast(`รับเควส · ${this.quests.defs.get(id).title}`, this.quests.defs.get(id).offer); this.refreshDialogue(); },
      onComplete: id => { if (this.quests.complete(id)) this.hud.toast(`สำเร็จ · ${this.quests.defs.get(id).title}`, this.quests.defs.get(id).done); this.refreshDialogue(); },
    });
    this.quests.on('change', () => { this.questUI.renderTracker(); if (this.hud.dialogueOpen && this.talking) this.questUI.renderDialogue(this.talking.id); });
    this.shop = new ShopPanel((text, kind) => (this.game?.hud?.feed ? this.game.hud.feed.log(text, kind === 'warn' ? 'bad' : kind) : this.hud.toast(text, '')));
    this.input = new InputManager(host);
    this.bind();
    this.startCombat();
    this.maps.attachCombat(this.game);
    if (params.has('zoom')) this.view.setZoom(Number(params.get('zoom')));
    this.view.snap(this.player.position);
    this.destination = null; this.route = []; this.elapsed = 0; this.previous = null; this.lastHud = 0; this.frames = 0; this.fpsTime = 0; this.fps = 0;
    this.dir = new THREE.Vector3();
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.2, .27, 40), new THREE.MeshBasicMaterial({ color: '#fff0b2', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; this.scene.add(this.marker);
    if (params.get('ui') === '0') this.togglePhoto();
    if (params.has('debug')) this.toggleDebug();
    this.updateJournal();
    this.frame(0, 1 / 60);
    $('loading').classList.add('done'); setTimeout(() => { $('loading').hidden = true; }, 700);
    this.renderer.setAnimationLoop(time => this.tick(time));
    window.game = this;
  }

  bind() {
    const input = this.input, view = this.view;
    window.addEventListener('resize', () => view.resize());
    input.on('move', () => { this.stopWalk(); view.recenter(); });
    input.on('resetCamera', () => view.reset());
    input.on('photo', () => this.togglePhoto());
    input.on('interact', () => this.interact());
    input.on('map', () => this.toggleMap());
    input.on('debug', () => this.toggleDebug());
    input.on('escape', () => {
      if (this.shop.open) return this.shop.close();
      if (this.hud.dialogueOpen) return this.closeDialogue();
      if (!$('fullmap-panel').hidden) return this.toggleMap();
      $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false');
      if (this.photo) this.togglePhoto();
    });
    let panStart = null;
    input.on('panStart', () => { panStart = view.panOffset.clone(); });
    input.on('pan', (dx, dy) => view.pan(dx, dy, panStart));
    input.on('zoom', delta => view.setZoom(view.zoom - delta * .001));
    input.on('click', e => {
      if (this.maps.busy) return;
      const p = view.groundPoint(e.clientX, e.clientY, (x, z) => this.world.heightAt(x, z));
      if (!this.world.canStand(p.x, p.z)) return;
      const route = findPath((x, z) => this.world.canStand(x, z), this.player.position, p);
      if (!route) return this.hud.toast('ไปที่นั่นไม่ได้', 'ไม่มีทางเดินไปถึงจุดนั้นจากตรงนี้');
      this.game?.onManualMove(); view.recenter();
      this.route = route; this.autoWalk = false; this.nextWaypoint();
      this.marker.position.set(p.x, this.world.heightAt(p.x, p.z) + .07, p.z); this.marker.visible = true;
    });
    $('reset-camera').addEventListener('click', () => view.reset());
    $('photo-mode').addEventListener('click', () => this.togglePhoto());
    $('restore-ui').addEventListener('click', () => this.togglePhoto());
    $('map-toggle').addEventListener('click', () => this.toggleMap());
    $('fullmap-close').addEventListener('click', () => this.toggleMap());
    $('interaction').addEventListener('click', () => this.interact());
    $('dlg-next').addEventListener('click', () => this.interact());
    $('dlg-close').addEventListener('click', () => this.closeDialogue());
    $('dlg-shop').addEventListener('click', () => {
      const npc = this.talking, c = this.game?.character;
      if (!npc || !c) return;
      this.closeDialogue(); this.shop.show(npc, c);
    });
    const settings = $('settings');
    $('settings-toggle').addEventListener('click', () => { settings.hidden = !settings.hidden; $('settings-toggle').setAttribute('aria-expanded', String(!settings.hidden)); });
    $('settings-close').addEventListener('click', () => { settings.hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false'); });
    $('wind').addEventListener('input', e => { windUniforms.uWind.value = Number(e.target.value) / 100; $('wind-value').value = `${e.target.value}%`; });
    $('particles').addEventListener('change', e => this.world.atmosphere.setEnabled(e.target.checked));
    $('debug-toggle').addEventListener('change', e => { if (e.target.checked !== !!this.debugOn) this.toggleDebug(); });
    $('time-mode').addEventListener('change', e => {
      const mode = e.target.value;
      this.clock.paused = mode !== 'auto';
      if (mode !== 'auto') this.clock.set(PHASE_HOURS[mode]);
    });
    $('time-speed').addEventListener('change', e => { this.clock.rate = Number(e.target.value); });
    $('quality').addEventListener('change', e => {
      const high = e.target.value === 'high', sun = this.env.sun;
      this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
      sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      this.world.grass.mesh.geometry.instanceCount = high ? 56000 : 34000;
      this.view.resize();
    });
    $('sound').addEventListener('click', async () => {
      const on = await this.audio.toggle();
      if (on === null) return this.hud.toast('เสียงบรรยากาศ', 'เบราว์เซอร์นี้ไม่รองรับเสียงบรรยากาศ');
      $('sound').setAttribute('aria-pressed', String(on)); $('sound').classList.toggle('on', on);
      $('sound').title = on ? 'ปิดเสียงบรรยากาศ' : 'เปิดเสียงบรรยากาศ'; $('sound').setAttribute('aria-label', $('sound').title);
    });
  }

  // Character and combat systems (src/character, src/combat). Monsters follow the world clock.
  // World queries go to whichever map is loaded; zones and the respawn point
  // belong to the map manager, which switches them with the map.
  startCombat() {
    this.game = createGame({
      root: $('app'), host: this.host, scene: this.scene, camera: this.view.camera, player: this.player,
      canStand: (x, z) => this.world?.canStand(x, z) ?? false, groundHeight: (x, z) => this.world?.heightAt(x, z) ?? 0,
      moveTo: (x, z) => { this.route = []; this.destination = new THREE.Vector3(x, 0, z); this.autoWalk = true; this.walkBest = Infinity; this.walkStall = 0; },
      stop: () => this.stopWalk(),
      respawnPoint: this.maps.respawn, spawns: this.maps.zones,
    });
    this.game.setPhase(this.clock.phase);
    this.clock.onPhase(phase => this.game.setPhase(phase));
    this.input.on('move', () => this.game.onManualMove());
    window.addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || this.hud.dialogueOpen) return;
      if (this.game.handleKey(e)) return;
      // N jumps between night and morning; the clock keeps running unless locked in settings.
      if (e.code === 'KeyN' && !e.repeat) this.clock.set(PHASE_HOURS[this.clock.phase === 'night' ? 'morning' : 'night']);
    });
  }

  // Map changes (src/world/MapManager.js): close what belongs to the old map,
  // then rebuild the minimap and debug overlay and reapply settings for the new one.
  leaveMap() {
    if (this.shop.open) this.shop.close();
    if (this.hud.dialogueOpen) this.closeDialogue();
    this.stopWalk(); this.game?.onManualMove();
  }
  enterMap({ map, world }) {
    this.minimap = new Minimap($('minimap'), $('fullmap'), world.footprints, {
      bounds: walkBounds(map), landmarks: this.maps.landmarks, discovered: this.discovered,
      portals: map.portals.map(p => ({ ...p, toName: MAPS[p.to].name })),
    });
    document.querySelector('.mini-title span').textContent = map.name;
    document.querySelector('.map-caption h2').textContent = map.name;
    $('fullmap-panel').querySelector('.panel-heading').firstChild.textContent = `แผนที่${map.name}`;
    if (this.debugGroup) {
      this.debugGroup.removeFromParent(); this.debugGroup.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.debugGroup = null;
      if (this.debugOn) { this.debugOn = false; this.toggleDebug(); }
    }
    world.atmosphere.setEnabled($('particles').checked);
    world.grass.mesh.geometry.instanceCount = $('quality').value === 'high' ? 56000 : 34000;
    if (this.view) { this.view.recenter(); this.view.snap(this.player.position); }
    if (this.questUI) this.updateJournal();
  }

  nextWaypoint() { const w = this.route.shift(); this.destination = new THREE.Vector3(w.x, 0, w.z); this.walkBest = Infinity; this.walkStall = 0; }
  stopWalk() { this.destination = null; this.route = []; this.marker.visible = false; }

  togglePhoto() { this.photo = !this.photo; document.body.classList.toggle('photo-mode', this.photo); $('restore-ui').hidden = !this.photo; }
  toggleMap() {
    const panel = $('fullmap-panel'); panel.hidden = !panel.hidden;
    if (!panel.hidden) { const c = $('fullmap'); c.width = c.clientWidth * devicePixelRatio; c.height = c.clientHeight * devicePixelRatio; this.minimap.drawFull(this.player.position, this.player.group.rotation.y); }
  }
  toggleDebug() {
    this.debugOn = !this.debugOn; $('debug').hidden = !this.debugOn; $('debug-toggle').checked = this.debugOn;
    if (!this.debugGroup) {
      // Navigation graph and future monster spawn areas.
      const g = this.debugGroup = new THREE.Group(), pts = [];
      for (const n of this.npcs.nav.nodes.values()) for (const e of n.edges) { const m = this.npcs.nav.nodes.get(e.to); pts.push(n.x, this.world.heightAt(n.x, n.z) + .15, n.z, m.x, this.world.heightAt(m.x, m.z) + .15, m.z); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#7fe0ff', transparent: true, opacity: .6, depthTest: false })));
      for (const s of this.maps.spawnAreas) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(s.radius - .3, s.radius, 48), new THREE.MeshBasicMaterial({ color: s.boss ? '#ff6a5a' : '#ffb35a', side: THREE.DoubleSide, transparent: true, opacity: .7, depthTest: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, this.world.heightAt(s.x, s.z) + .3, s.z); g.add(ring);
      }
      g.renderOrder = 10; this.scene.add(g);
    }
    this.debugGroup.visible = this.debugOn;
  }

  interact() {
    if (this.hud.dialogueOpen && this.talking) {
      const d = this.talking.def; this.talkLine = (this.talkLine + 1) % d.dialogue.length;
      this.hud.openDialogue(this.talking, this.npcs.label(this.talking), d.dialogue[this.talkLine]);
      return this.refreshDialogue();
    }
    const p = this.player.position, npc = this.npcs.nearestInteractable(p.x, p.z);
    if (npc) {
      this.talking = npc; this.talkLine = 0; npc.talkTo(p.x, p.z);
      this.hud.openDialogue(npc, this.npcs.label(npc), npc.def.dialogue[0]);
      this.quests.onTalk(npc.id);
      return this.refreshDialogue();
    }
    const l = this.nearLandmark();
    if (l) { this.discover(l, true); }
  }
  closeDialogue() { this.hud.closeDialogue(); this.talking?.release(); this.talking = null; }
  // Quest offers and the trade button for the NPC being talked to.
  refreshDialogue() {
    const npc = this.talking;
    if (!npc) return;
    this.questUI.renderDialogue(npc.id);
    $('dlg-shop').hidden = !(this.game?.character && SHOPS[npc.def.shopType]?.stock?.length);
  }
  nearLandmark() {
    const p = this.player.position;
    return this.maps.landmarks.find(l => (!l.hidden || this.discovered.has(l.id)) && Math.hypot(l.x - p.x, l.z - p.z) < Math.min(l.radius, 8) + 1.5) ?? null;
  }
  discover(l, force = false) {
    const fresh = !this.discovered.has(l.id);
    if (!fresh && !force) return;
    this.discovered.add(l.id);
    try { localStorage.setItem('tno.discovered.v1', JSON.stringify([...this.discovered])); } catch { /* storage unavailable */ }
    this.quests.onDiscover(l.id);
    this.hud.toast(fresh ? `ค้นพบ · ${l.name}` : l.name, l.text, l.purpose);
    this.updateJournal();
  }
  updateJournal() {
    const known = LANDMARKS.filter(l => !l.hidden || this.discovered.has(l.id)), p = this.player.position;
    const next = known.filter(l => !this.discovered.has(l.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    this.hud.setJournal(known.filter(l => this.discovered.has(l.id)).length, known.length, next?.name);
  }

  tick(time) {
    if (document.hidden) { this.previous = null; return; }
    const dt = this.previous === null ? 0 : Math.min((time - this.previous) / 1000, .05);
    this.previous = time;
    this.frame(time, dt);
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime > .5) { this.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0; }
  }
  frame(time, dt) {
    this.elapsed += dt;
    const p = this.player.position, view = this.view;
    this.clock.update(dt);
    // While maps swap the fade overlay covers the screen; the clock keeps running.
    if (this.maps.busy || !this.world) return;
    // Movement: keys, or a straight walk to a clicked point.
    const canMove = this.game?.canMove ?? true;
    if (!canMove) this.stopWalk();
    const dir = canMove ? this.input.direction(view.forward, view.right, this.dir) : this.dir.set(0, 0, 0);
    let stalled = false;
    if (!dir.lengthSq() && this.destination) {
      dir.subVectors(this.destination, p); dir.y = 0;
      if (dir.length() < .2 && this.route.length) { this.nextWaypoint(); dir.subVectors(this.destination, p); dir.y = 0; }
      const remaining = dir.length();
      if (remaining < .2) { this.stopWalk(); dir.set(0, 0, 0); }
      else {
        dir.normalize();
        // Sliding along an obstacle can jitter in place; give up once the walk stops getting closer.
        if (remaining < this.walkBest - .05) { this.walkBest = remaining; this.walkStall = 0; }
        else stalled = (this.walkStall += dt) > .6;
      }
    }
    const moved = this.player.move(dir, dt, this.world, this.input.running);
    this.maps.update(dt, this.elapsed);
    if (this.maps.busy) return;
    if ((!moved && dt > 0 || stalled) && this.destination) {
      // Combat auto-walk retries every frame; only a manual click reports a blocked path.
      if (!this.autoWalk) this.hud.toast('เส้นทางถูกกีดขวาง', 'ลองเดินอ้อมด้วย W A S D');
      this.stopWalk();
    }
    if (dir.lengthSq() && this.hud.dialogueOpen && this.talking && Math.hypot(this.talking.x - p.x, this.talking.z - p.z) > this.talking.interactionRadius + 1.5) this.closeDialogue();

    const env = this.env.update(this.clock.hour, view.focus);
    this.world.update(this.elapsed, dt, view.focus, env);
    this.npcs.update(dt, this.elapsed, p);
    this.game?.update(dt, this.elapsed);
    if (!this.questsReady && this.game?.ready) { this.quests.attach(this.game.character, this.game.combat); this.questsReady = true; }
    this.player.bindCombat(this.game); // rigged class model + skill animations (no-op once bound)
    if (this.shop.open && Math.hypot(this.shop.npc.x - p.x, this.shop.npc.z - p.z) > this.shop.npc.interactionRadius + 2) this.shop.close();
    view.update(dt, p);
    if (this.marker.visible) this.marker.scale.setScalar(1 + Math.sin(this.elapsed * 5) * .12);
    this.hud.updatePlates(this.npcs.npcs, view.camera, p, n => this.npcs.label(n), n => (this.questsReady ? this.quests.marker(n.id) : null));

    if (time - this.lastHud > 120 || time === 0) {
      this.lastHud = time;
      this.hud.setRegion(regionAt(p.x, p.z, this.discovered.has('cemetery')));
      this.hud.setClock(this.clock.label, this.clock.phase, this.clock.hour);
      this.hud.setCoords(p);
      this.minimap.update(p, this.player.group.rotation.y);
      if (!$('fullmap-panel').hidden) this.minimap.drawFull(p, this.player.group.rotation.y);
      for (const l of this.maps.landmarks) if (!this.discovered.has(l.id) && Math.hypot(l.x - p.x, l.z - p.z) < l.radius) this.discover(l);
      const npc = this.hud.dialogueOpen ? null : this.npcs.nearestInteractable(p.x, p.z), l = npc ? null : this.nearLandmark();
      this.hud.prompt(npc ? `คุยกับ ${npc.def.name} · ${this.npcs.label(npc)}` : l ? `สำรวจ ${l.name}` : null);
      this.audio.setMood({ night: env.night, wild: env.wild, cemetery: env.cemetery });
      if (this.debugOn) {
        const info = this.renderer.info.render;
        this.hud.debug(`FPS ${this.fps.toFixed(0)} · draw calls ${info.calls} · ${(info.triangles / 1000).toFixed(0)}k tris\nNPC ใกล้ ${this.npcs.visibleCount}/${this.npcs.npcs.length} · ${this.clock.label} (${this.clock.phase})\nตำแหน่ง ${p.x.toFixed(1)}, ${p.z.toFixed(1)} · spawn ที่ใช้งาน ${activeSpawns(this.clock.phase).length}\nบ้าน ${this.world.stats.houses} · ต้นไม้ป่า ${this.world.stats.forestTrees} · สร้างโลก ${this.world.stats.buildMs} ms`);
      }
    }
    this.renderer.render(this.scene, view.camera);
  }
}
