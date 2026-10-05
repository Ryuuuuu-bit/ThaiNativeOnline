import * as THREE from 'three';
import { buildWorld } from '../world/World.js';
import { Environment } from '../world/Environment.js';
import { windUniforms } from '../world/shaders.js';
import { Player } from '../entities/Player.js';
import { NPCManager } from '../npc/NPCManager.js';
import { NPCS } from '../data/npcs.js';
import { LANDMARKS } from '../data/landmarks.js';
import { SPAWNS, activeSpawns } from '../data/spawns.js';
import { regionAt } from '../data/regions.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { CameraController } from './CameraController.js';
import { InputManager } from './InputManager.js';
import { WorldClock, PHASE_HOURS } from './WorldClock.js';
import { AudioAmbience } from './AudioAmbience.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);

export class Game {
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

    this.world = await buildWorld(this.scene, text => { $('loading-text').textContent = text; });
    this.player = new Player(this.scene);
    const [sx, sz] = (params.get('at') ?? '4,151').split(',').map(Number);
    this.player.position.set(sx, this.world.heightAt(sx, sz), sz); this.player.group.rotation.y = Math.PI;
    $('loading-text').textContent = 'ชาวเมืองกำลังออกจากบ้าน…'; await new Promise(res => setTimeout(res, 0));
    this.npcs = new NPCManager(this.scene, this.world, NPCS, this.clock);
    this.minimap = new Minimap($('minimap'), $('fullmap'), this.world.footprints);
    this.discovered = this.minimap.discovered;
    this.input = new InputManager(host);
    this.bind();
    if (params.has('zoom')) this.view.setZoom(Number(params.get('zoom')));
    this.view.snap(this.player.position);
    this.destination = null; this.elapsed = 0; this.previous = null; this.lastHud = 0; this.frames = 0; this.fpsTime = 0; this.fps = 0;
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
    input.on('move', () => { this.destination = null; this.marker.visible = false; });
    input.on('resetCamera', () => view.reset());
    input.on('photo', () => this.togglePhoto());
    input.on('interact', () => this.interact());
    input.on('map', () => this.toggleMap());
    input.on('debug', () => this.toggleDebug());
    input.on('escape', () => {
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
      const p = view.groundPoint(e.clientX, e.clientY, (x, z) => this.world.heightAt(x, z));
      if (!this.world.canStand(p.x, p.z)) return;
      this.destination = p; this.marker.position.set(p.x, this.world.heightAt(p.x, p.z) + .07, p.z); this.marker.visible = true;
    });
    $('reset-camera').addEventListener('click', () => view.reset());
    $('photo-mode').addEventListener('click', () => this.togglePhoto());
    $('restore-ui').addEventListener('click', () => this.togglePhoto());
    $('map-toggle').addEventListener('click', () => this.toggleMap());
    $('fullmap-close').addEventListener('click', () => this.toggleMap());
    $('interaction').addEventListener('click', () => this.interact());
    $('dlg-next').addEventListener('click', () => this.interact());
    $('dlg-close').addEventListener('click', () => this.closeDialogue());
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
      for (const s of SPAWNS) {
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
      return this.hud.openDialogue(this.talking, this.npcs.label(this.talking), d.dialogue[this.talkLine]);
    }
    const p = this.player.position, npc = this.npcs.nearestInteractable(p.x, p.z);
    if (npc) {
      this.talking = npc; this.talkLine = 0; npc.talkTo(p.x, p.z);
      return this.hud.openDialogue(npc, this.npcs.label(npc), npc.def.dialogue[0]);
    }
    const l = this.nearLandmark();
    if (l) { this.discover(l, true); }
  }
  closeDialogue() { this.hud.closeDialogue(); this.talking?.release(); this.talking = null; }
  nearLandmark() {
    const p = this.player.position;
    return LANDMARKS.find(l => (!l.hidden || this.discovered.has(l.id)) && Math.hypot(l.x - p.x, l.z - p.z) < Math.min(l.radius, 8) + 1.5) ?? null;
  }
  discover(l, force = false) {
    const fresh = !this.discovered.has(l.id);
    if (!fresh && !force) return;
    this.discovered.add(l.id);
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
    // Movement: keys, or a straight walk to a clicked point.
    const dir = this.input.direction(view.forward, view.right, this.dir);
    if (!dir.lengthSq() && this.destination) {
      dir.subVectors(this.destination, p); dir.y = 0;
      if (dir.length() < .2) { this.destination = null; this.marker.visible = false; dir.set(0, 0, 0); } else dir.normalize();
    }
    const moved = this.player.move(dir, dt, this.world, this.input.running);
    if (!moved && this.destination) { this.destination = null; this.marker.visible = false; this.hud.toast('เส้นทางถูกกีดขวาง', 'ลองเดินอ้อมด้วย W A S D'); }
    if (dir.lengthSq() && this.hud.dialogueOpen && this.talking && Math.hypot(this.talking.x - p.x, this.talking.z - p.z) > this.talking.interactionRadius + 1.5) this.closeDialogue();

    const env = this.env.update(this.clock.hour, view.focus);
    this.world.update(this.elapsed, dt, view.focus, env);
    this.npcs.update(dt, this.elapsed, p);
    view.update(dt, p);
    if (this.marker.visible) this.marker.scale.setScalar(1 + Math.sin(this.elapsed * 5) * .12);
    this.hud.updatePlates(this.npcs.npcs, view.camera, p, n => this.npcs.label(n));

    if (time - this.lastHud > 120 || time === 0) {
      this.lastHud = time;
      this.hud.setRegion(regionAt(p.x, p.z, this.discovered.has('cemetery')));
      this.hud.setClock(this.clock.label, this.clock.phase, this.clock.hour);
      this.hud.setCoords(p);
      this.minimap.update(p, this.player.group.rotation.y);
      if (!$('fullmap-panel').hidden) this.minimap.drawFull(p, this.player.group.rotation.y);
      for (const l of LANDMARKS) if (!this.discovered.has(l.id) && Math.hypot(l.x - p.x, l.z - p.z) < l.radius) this.discover(l);
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
