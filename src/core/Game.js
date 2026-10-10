import { BackgroundTicker } from './BackgroundTicker.js';
import * as THREE from 'three';
import { MapManager } from '../world/MapManager.js';
import { MAPS, walkBounds } from '../world/maps.js';
import { Environment } from '../world/Environment.js';
import { windUniforms } from '../world/shaders.js';
import { Player } from '../entities/Player.js';
import { activeSpawns } from '../data/spawns.js';
import { regionAt } from '../data/regions.js';
import { HUD } from '../ui/HUD.js';
import { Minimap } from '../ui/Minimap.js';
import { questTargets, levelText } from '../ui/minimap/mapStyle.js';
import { CameraController } from './CameraController.js';
import { InputManager } from './InputManager.js';
import { WorldClock, PHASE_HOURS, wallHour } from './WorldClock.js';
import { AudioAmbience } from './AudioAmbience.js';
import { findPath } from './GridPath.js';
import { createGame } from '../combat/index.js';
import { startMultiplayer } from '../net/Multiplayer.js';
import { QUESTS } from '../data/quests.js';
import { SHOPS } from '../data/shops.js';
import { QuestSystem } from '../quest/QuestSystem.js';
import { QuestUI } from '../ui/QuestUI.js';
import { ShopPanel } from '../ui/ShopPanel.js';
import { PostFX } from '../world/PostFX.js';
import { MainMenu, bindSettingsTabs } from '../ui/MainMenu.js';
import { initSkin } from '../ui/skin.js';
import { draggable } from '../ui/draggable.js';
import { segmentSelects } from '../ui/segControls.js';
import { WorldMapPanel } from '../ui/WorldMapPanel.js';
import { WarpPanel } from '../ui/WarpPanel.js';
import { StoragePanel } from '../ui/StoragePanel.js';
import { BestiaryPanel } from '../ui/BestiaryPanel.js';
import { nextPortal } from '../ui/mapDirectory.js';
import { WORLD_BOSS_NEWS } from '../combat/data/worldBoss.js';
import { createClassAvatar } from '../training/TrainingGround.js';
import { slotStorage } from './SaveSlot.js';
import { ZOOM_MIN, ZOOM_MAX, createViewPrefs } from '../ui/viewPrefs.js';
import { createTouchControls } from '../ui/TouchControls.js';
import { Sound } from '../audio/Sound.js';
import { bindCombatSounds, mountAudioSettings } from '../audio/gameSounds.js';
import { LocationMusic } from '../audio/LocationMusic.js';
import { combatMusicState } from '../data/calmMusic.js';

const $ = id => document.getElementById(id);
// Route planning keeps this much room from obstacles (the body itself needs .28, src/world/Collision.js).
const ROOMY = .5;
const params = new URLSearchParams(location.search);

// a local build (npm run dev / a server on this machine): the developer settings are open
const DEV_HOST = import.meta.env?.DEV || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export class Game {
  get serviceModalOpen() { return !!(this.warp?.open || this.guide?.open || this.storage?.open || (this.game?.characterUI?.loadouts && !this.game.characterUI.loadouts.hidden)); }
  // The active map's world and NPCs live in the map manager (src/world/MapManager.js).
  get world() { return this.maps?.world ?? null; }
  get npcs() { return this.maps?.npcs ?? null; }

  async start() {
    const host = this.host = $('world');
    try { this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch (error) { document.body.dataset.error = 'webgl'; $('loading-text').textContent = 'ไม่สามารถเปิด WebGL ได้ กรุณาเปิด hardware acceleration แล้วลองใหม่'; throw error; }
    const r = this.renderer;
    host.appendChild(r.domElement);
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft is gone from three
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.18;
    this.scene = new THREE.Scene();
    this.env = new Environment(this.scene, r);
    this.view = new CameraController(r, host);
    this.postfx = new PostFX(r, this.scene, this.view.camera);   // src/world/PostFX.js (high quality)
    // offline the clock starts where the shared world's would be (Thai wall time); online the server's ticks lead it
    this.clock = new WorldClock({ hour: params.has('t') ? Number(params.get('t')) : wallHour() });
    if (params.has('t')) this.clock.paused = true;
    this.hud = new HUD();
    this.audio = new AudioAmbience();

    this.player = new Player(this.scene);
    this.discovered = new Set();
    try { for (const id of JSON.parse(slotStorage.getItem('tno.discovered.v1') ?? '[]')) this.discovered.add(id); } catch { /* storage unavailable */ }
    // Maps (src/world/maps.js): นครอโยธยา and ทุ่งนอกเมือง, one loaded at a time; warps move between them.
    this.maps = new MapManager({
      scene: this.scene, clock: this.clock, player: this.player,
      progress: text => { $('loading-text').textContent = text; },
      onLeave: () => this.leaveMap(), onChange: info => this.enterMap(info),
      onRefuse: info => this.hud.toast(info.to.name, WORLD_BOSS_NEWS.closed()),   // a night-only door by day
    });
    await this.maps.start(MapManager.startLocation(params));
    // Quests and vendors attach to the character once one exists (after creation or load).
    this.quests = new QuestSystem(QUESTS, { isDiscovered: id => this.discovered.has(id), storage: slotStorage });
    this.questUI = new QuestUI(this.quests, {
      // accepting / finishing a quest is a line in the feed, not a popup
      onAccept: id => { if (this.quests.accept(id)) this.game?.hud?.feed?.log(`รับเควส · ${this.quests.defs.get(id).title}`, 'gold'); this.refreshDialogue(); },
      onComplete: id => { if (this.quests.complete(id)) this.game?.hud?.feed?.log(`เควสสำเร็จ · ${this.quests.defs.get(id).title}`, 'gold'); this.refreshDialogue(); },
    });
    this.quests.on('change', () => { this.questUI.renderTracker(); if (this.hud.dialogueOpen && this.talking) this.questUI.renderDialogue(this.talking.id); });
    this.shop = new ShopPanel((text, kind) => (this.game?.hud?.feed ? this.game.hud.feed.log(text, kind === 'warn' ? 'bad' : kind) : this.hud.toast(text, '')));
    this.warp = new WarpPanel({ map: () => this.maps.map.id, position: () => this.player.position,
      level: () => this.game?.character?.level ?? 1, prepare: () => { this.stopWalk(); this.game?.combat?.cancelPending(); this.game?.combat?.setTarget(null); },
      note: text => this.game?.hud?.feed?.log(text, 'gold', true) });
    this.guide = new BestiaryPanel({ level: () => this.game?.character?.level ?? 1,
      prepare: () => { this.closeDialogue(); this.warp.close(); this.storage?.close(); this.shop.close(); this.stopWalk(); this.game?.combat?.cancelPending(); },
      locate: (monster, location) => this.locateMonster(monster, location) });
    this.storage = new StoragePanel({ character: () => this.game?.character,
      prepare: () => { this.closeDialogue(); this.warp.close(); this.guide.close(); this.shop.close(); this.stopWalk(); this.game?.combat?.cancelPending(); this.game?.combat?.setTarget(null);
        const ui = this.game?.characterUI; if (ui) { ui.sheet.hidden = ui.bag.hidden = ui.loadouts.hidden = true; ui.skills.root.hidden = true; } },
      note: text => this.game?.hud?.feed?.log(text, 'gold', true) });
    this.prefs = createViewPrefs();   // HUD scale and saved camera zoom (device-wide)
    this.input = new InputManager(host);
    this.touch = createTouchControls($('app'), this.input, {
      locked: () => !!(this.game?.combat?.target?.alive || this.training?.selected),
      unlock: () => { this.game?.combat?.setTarget(null); this.training?.select?.(null); },
    });   // phones and tablets: joystick and thumb buttons (src/ui/TouchControls.js)
    this.bind();
    // graphics as this device last set them (the world reads the controls when it loads)
    $('particles').checked = this.prefs.particles; $('quality').value = this.prefs.quality;
    if (this.prefs.quality === 'low') $('quality').dispatchEvent(new Event('change'));
    this.startCombat();
    this.maps.attachCombat(this.game);
    this.view.setZoom(params.has('zoom') ? Number(params.get('zoom')) : this.prefs.zoom);
    this.syncZoom();
    this.view.snap(this.player.position);
    this.destination = null; this.route = []; this.elapsed = 0; this.previous = null; this.lastHud = 0; this.frames = 0; this.fpsTime = 0; this.fps = 0;
    this.dir = new THREE.Vector3();
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.2, .27, 40), new THREE.MeshBasicMaterial({ color: '#fff0b2', transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; this.scene.add(this.marker);
    if (params.get('ui') === '0') this.togglePhoto();
    this.setDev(DEV_HOST);
    if (params.has('debug') && this.devAllowed) this.toggleDebug();
    this.updateJournal();
    this.frame(0, 1 / 60);
    $('loading').classList.add('done'); setTimeout(() => { $('loading').hidden = true; }, 700);
    this.renderer.setAnimationLoop(time => this.tick(time));
    // A hidden tab gets no frames: a worker beat steps the game meanwhile (src/core/BackgroundTicker.js).
    this.ticker = new BackgroundTicker(now => this.backgroundStep(now));
    const onVisibility = () => {
      if (document.hidden) { this.bgPrevious = performance.now(); this.ticker.start(); }
      else { this.ticker.stop(); this.previous = null; }
    };
    document.addEventListener('visibilitychange', onVisibility); onVisibility();
    window.game = this;
  }

  bind() {
    const input = this.input, view = this.view;
    window.addEventListener('resize', () => { view.resize(); this.postfx.setSize(this.host.clientWidth, this.host.clientHeight); });
    input.on('move', () => { this.stopWalk(); view.recenter(); });
    input.on('resetCamera', () => view.reset());
    input.on('photo', () => this.togglePhoto());
    input.on('interact', () => this.interact());
    input.on('map', () => this.toggleMap());
    input.on('debug', () => this.toggleDebug());
    input.on('escape', () => {
      if (this.storage.open) return this.storage.close();
      if (this.guide.open) return this.guide.close();
      if (this.warp.open) return this.warp.close();
      if (this.game?.characterUI?.loadouts && !this.game.characterUI.loadouts.hidden) { this.game.characterUI.loadouts.hidden = true; return; }
      if (this.menu.open) return this.menu.toggle(false);
      const autoPanel = document.querySelector('.auto-panel');
      if (autoPanel && !autoPanel.hidden) { autoPanel.hidden = true; return; }
      if (this.shop.open) return this.shop.close();
      if (this.hud.dialogueOpen) return this.closeDialogue();
      if (!$('fullmap-panel').hidden) return this.toggleMap();
      $('settings').hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false');
      if (this.photo) this.togglePhoto();
    });
    let panStart = null;
    input.on('panStart', () => { panStart = view.panOffset.clone(); });
    input.on('pan', (dx, dy) => view.pan(dx, dy, panStart));
    input.on('zoom', delta => this.zoomTo(view.zoom - delta * .001));
    input.on('zoomBy', ratio => this.zoomTo(view.zoom * ratio));
    input.on('zoomStep', dir => this.zoomTo(view.zoom * (dir > 0 ? 1.12 : 1 / 1.12)));
    $('zoom-in').addEventListener('click', () => this.zoomTo(view.zoom * 1.15, true));
    $('zoom-out').addEventListener('click', () => this.zoomTo(view.zoom / 1.15, true));
    // 🔒 locks the camera distance: pinch, the wheel and + / − keys no longer change it
    // (the + / − buttons and the settings slider still can, and unlock nothing)
    $('zoom-lock').addEventListener('click', () => { this.prefs.set({ zoomLock: !this.prefs.zoomLock }); this.syncZoom(); this.note(this.prefs.zoomLock ? 'ล็อกระยะกล้องแล้ว · นิ้ว / ล้อเมาส์จะไม่ซูม' : 'ปลดล็อกระยะกล้อง'); });
    input.on('click', e => {
      if (this.maps.busy || this.serviceModalOpen) return;
      const p = view.groundPoint(e.clientX, e.clientY, (x, z) => this.world.heightAt(x, z));
      if (this.world.canStand(p.x, p.z)) this.walkTo(p.x, p.z);
    });
    $('reset-camera').addEventListener('click', () => view.reset());
    $('photo-mode').addEventListener('click', () => this.togglePhoto());
    $('restore-ui').addEventListener('click', () => this.togglePhoto());
    $('map-toggle').addEventListener('click', () => this.toggleMap());
    $('fullmap-close').addEventListener('click', () => this.toggleMap());
    $('interaction').addEventListener('click', () => this.interact());
    // the big map: the ⤢ button by the minimap, or a tap on the minimap's title (a tap on the map itself walks there)
    $('map-open').addEventListener('click', () => this.toggleMap());
    document.querySelector('.mini-title')?.addEventListener('click', () => this.toggleMap());
    $('dlg-next').addEventListener('click', () => this.interact());
    $('dlg-close').addEventListener('click', () => this.closeDialogue());
    $('dlg-warp').addEventListener('click', () => {
      const npc = this.talking;
      if (!npc?.def.warpService) return;
      this.stopWalk(); this.game?.combat?.cancelPending(); this.game?.combat?.setTarget(null);
      this.closeDialogue(); this.warp.show(npc);
    });
    $('dlg-storage').addEventListener('click', () => { const npc = this.talking; if (npc?.def.storageService) this.storage.show(npc); });
    $('dlg-shop').addEventListener('click', () => {
      const npc = this.talking, c = this.game?.character;
      if (!npc || !c) return;
      this.closeDialogue(); this.shop.show(npc, c);
      const ui = this.game?.characterUI;
      if (ui?.bag.hidden) ui.toggle('bag');
    });
    const settings = $('settings');
    $('settings-toggle').addEventListener('click', () => { settings.hidden = !settings.hidden; $('settings-toggle').setAttribute('aria-expanded', String(!settings.hidden)); });
    bindSettingsTabs(settings);
    initSkin($('ui-skin'));   // modern glass or classic wood (src/ui/skin.js)
    segmentSelects(settings);   // the dropdowns as segmented buttons (src/ui/segControls.js)
    // windows move by their title bar (src/ui/draggable.js)
    for (const [id, key, handle] of [['settings', 'settings', '.panel-heading'], ['shop', 'shop', '.panel-heading'], ['dialogue', 'dialogue', '.dlg-head']]) draggable($(id), { key, handle });
    // Main menu (bottom-right): the windows the old top-right icons and C / I buttons opened.
    const characterUI = () => this.game?.characterUI;
    this.menu = new MainMenu({
      sheet: () => characterUI()?.toggle('sheet'),
      skills: () => characterUI()?.toggle('skills'),
      bag: () => characterUI()?.toggle('bag'),
      map: () => this.toggleMap(),
      social: () => (this.net?.social ? this.net.social.toggle() : this.hud.toast('สังคม', 'ต้องเชื่อมต่อเซิร์ฟเวอร์ก่อน (ออนไลน์)')),
      bestiary: () => this.guide.show(),
      loadouts: () => { this.stopWalk(); this.game?.combat?.cancelPending(); characterUI()?.toggle('loadouts'); },
      auto: () => document.querySelector('.hotbar-auto-cfg')?.click(),
      photo: () => this.togglePhoto(),
      settings: () => $('settings-toggle').click(),
    });
    $('settings-close').addEventListener('click', () => { settings.hidden = true; $('settings-toggle').setAttribute('aria-expanded', 'false'); });
    $('zoom').addEventListener('input', e => this.zoomTo(Number(e.target.value) / 100, true));
    $('hud-size').value = String(this.prefs.hud);
    $('hud-size').addEventListener('change', e => this.prefs.set({ hud: Number(e.target.value) }));
    $('wind').addEventListener('input', e => { windUniforms.uWind.value = Number(e.target.value) / 100; $('wind-value').value = `${e.target.value}%`; });
    $('particles').addEventListener('change', e => { this.world.atmosphere.setEnabled(e.target.checked); this.prefs.set({ particles: e.target.checked }); });
    $('debug-toggle').addEventListener('change', e => { if (e.target.checked !== !!this.debugOn) this.toggleDebug(); });
    $('time-mode').addEventListener('change', e => {
      const mode = e.target.value;
      this.clock.paused = mode !== 'auto';
      if (mode !== 'auto') this.clock.set(PHASE_HOURS[mode]);
    });
    $('time-speed').addEventListener('change', e => { this.clock.rate = Number(e.target.value); });
    $('quality').addEventListener('change', e => {
      const high = e.target.value === 'high', sun = this.env.sun;
      this.prefs.set({ quality: high ? 'high' : 'low' });
      this.renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : 1);   // above 1.5× the GPU cost outgrows what shows at full HD
      sun.shadow.mapSize.set(high ? 4096 : 1024, high ? 4096 : 1024);
      this.setWorldShadows(high);
      this.postfx.enabled = high;   // bloom, colour grade and vignette only on high
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      if (this.world) this.world.grass.mesh.geometry.instanceCount = high ? 56000 : 34000;
      this.view.resize();
      this.postfx.setSize(this.host.clientWidth, this.host.clientHeight);
    });
    // Sound (src/audio): the ♫ button mutes everything; volumes live in the settings panel.
    const syncSound = () => {
      const on = !Sound.muted;
      $('sound').setAttribute('aria-pressed', String(on)); $('sound').classList.toggle('on', on);
      $('sound').title = on ? 'ปิดเสียง' : 'เปิดเสียง'; $('sound').setAttribute('aria-label', $('sound').title);
    };
    $('sound').addEventListener('click', () => { Sound.setMuted(!Sound.muted); syncSound(); });
    syncSound();
    mountAudioSettings(settings);
    // other modules add their rows to the panel: put them in their tabs (volumes in เสียง, account under the tab list)
    const sndNote = settings.querySelector('.set-pane[data-pane="snd"] .set-note');
    const audioRow = settings.querySelector('.audio-settings'); if (audioRow && sndNote) sndNote.before(audioRow);
    const accRow = settings.querySelector('.acc-settings'); if (accRow) settings.querySelector('.set-tabs').append(accRow);
    Sound.onReady(s => this.audio.start(s.ctx, s.ambienceBus));
    this.locationMusic = new LocationMusic(id => Sound.music(id));
    const p = this.player.position;
    this.locationMusic.update(0, { mapId: this.maps.map?.id ?? 'city', regionId: regionAt(p.x, p.z).id, phase: this.clock.phase });
  }

  // Character and combat systems (src/character, src/combat). Monsters follow the world clock.
  // World queries go to whichever map is loaded; zones and the respawn point
  // belong to the map manager, which switches them with the map.
  startCombat() {
    this.game = createGame({
      root: $('app'), host: this.host, scene: this.scene, camera: this.view.camera, player: this.player,
      canStand: (x, z) => this.world?.canStand(x, z) ?? false, groundHeight: (x, z) => this.world?.heightAt(x, z) ?? 0,
      moveTo: (x, z) => this.chaseTo(x, z),
      stop: () => this.stopWalk(),
      // walking by hand (a click on the ground, keys, the joystick): AUTO and chasing wait for it
      manualMove: () => this.serviceModalOpen || (!!this.destination && !this.autoWalk) || this.input.keys.size > 0 || !!(this.input.stick.x || this.input.stick.y),
      respawnPoint: this.maps.respawn, spawns: this.maps.zones,
      monsterStyle: this.prefs.monsters,
      isSafe: () => this.maps.map?.safe ?? true, // qa fix: no "danger" tip in the safe city at login
      // the death screen asks whether a party healer could still stand us up (src/net/Social.js sets it): { secs, who } or null
      reviveWait: () => this.reviveWait?.() ?? null,
    });
    this.game.setPhase(this.clock.phase);
    this.clock.onPhase(phase => this.game.setPhase(phase));
    this.input.on('move', () => { this.game.onManualMove(); this.training?.onManualMove(); });
    window.addEventListener('keydown', e => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || this.hud.dialogueOpen || this.serviceModalOpen) return;
      // Tab at the training ground locks onto the next dummy (monsters elsewhere: CombatHUD)
      if (e.code === 'Tab' && this.maps.map?.safe && this.training?.cycleDummy?.()) { e.preventDefault(); return; }
      if (e.code === 'Escape' && this.training?.selected) this.training.select(null);
      // Space / ตี at the training ground: the basic attack on the dummy
      if (e.code === 'Space' && this.maps.map?.safe && this.training?.swing?.()) { e.preventDefault(); return; }
      if (this.game.handleKey(e)) return; // action bar 1–0 / G, potions Q / F, C, I, Tab, Space
      // N jumps between night and morning; the clock keeps running unless locked in settings.
      if (e.code === 'KeyN' && !e.repeat) this.clock.set(PHASE_HOURS[this.clock.phase === 'night' ? 'morning' : 'night']);
    });
  }

  // Class avatar (src/training): once the character exists the player wears its class's
  // 3D model; a class with a skill kit puts its ten skills on the action bar
  // (game.hud) for every map and gets the training dummy in the city.
  startTraining() {
    bindCombatSounds(this.game);
    this.training = createClassAvatar(this.game.character.classId, {
      scene: this.scene, camera: this.view.camera, renderer: this.renderer, root: $('app'), player: this.player,
      canStand: (x, z) => this.world?.canStand(x, z) ?? false, groundHeight: (x, z) => this.world?.heightAt(x, z) ?? 0,
      character: this.game.character,   // the dummy reads the player's real stats
      combat: this.game.combat, hud: this.game.hud,   // kit skills fight monsters and sit on the action bar
    });
    this.training?.enterMap(this.maps.map.id); this.maps.attachTraining(this.training);
    // AUTO's basic attack also swings at the training dummy (the same pace as by hand)
    const bar = this.game.hud?.bar;
    if (bar) { bar.idleSwing = () => this.maps.map?.safe && this.training?.swing?.(); bar.idleStop = () => { if (this.training) this.training.autoSwing = false; }; }
    this.game.hud?.setSafe(this.maps.map.safe); // world-designer hook: fight tips only on maps with monsters
  }

  // Camera zoom from the wheel, pinch, + / − keys, the buttons by the minimap and the
  // settings slider; saved per device (src/ui/viewPrefs.js).
  // `deliberate`: the + / − buttons or the slider (they still work while the zoom is locked)
  zoomTo(z, deliberate = false) {
    if (this.prefs.zoomLock && !deliberate) return;
    this.view.setZoom(z); this.prefs.set({ zoom: this.view.zoom }); this.syncZoom();
  }
  syncZoom() {
    const pct = Math.round(this.view.zoom * 100), lock = $('zoom-lock');
    if (lock) { lock.textContent = this.prefs.zoomLock ? '🔒' : '🔓'; lock.setAttribute('aria-pressed', String(!!this.prefs.zoomLock)); lock.classList.toggle('on', !!this.prefs.zoomLock); }
    $('zoom').value = pct; $('zoom-value').value = `${pct}%`;
    $('zoom-in').disabled = this.view.zoom >= ZOOM_MAX; $('zoom-out').disabled = this.view.zoom <= ZOOM_MIN;
  }

  // Map changes (src/world/MapManager.js): close what belongs to the old map,
  // then rebuild the minimap and debug overlay and reapply settings for the new one.
  leaveMap() {
    this.game?.combat?.cancelMonsterAttacks();
    this.guide?.close();
    this.storage?.close();
    this.warp?.close();
    if (this.shop.open) this.shop.close();
    if (this.hud.dialogueOpen) this.closeDialogue();
    this.stopWalk(); this.game?.onManualMove();
  }
  enterMap({ map, world }) {
    // Painted minimap and full map (src/ui/Minimap.js), built once per map from the world.
    this.minimap = new Minimap($('minimap'), $('fullmap'), world.footprints, {
      bounds: walkBounds(map), landmarks: this.maps.landmarks, discovered: this.discovered,
      portals: map.portals.map(p => ({ ...p, toName: MAPS[p.to]?.name ?? p.to })),
      world, map, regionAt,
      onPick: l => { if (this.walkTo(l.x, l.z, Math.min(l.radius ?? 6, 12))) this.toggleMap(); },
      // navigation: a tap on the minimap / full map walks to that spot (the nearest ground there)
      onWalk: (x, z, fromFull) => { const ok = this.walkTo(x, z, 10); if (ok && fromFull) this.toggleMap(); return ok; },
      onOpen: () => this.toggleMap(),   // a tap on the minimap opens the big map
      onSelect: e => e.cluster ? this.mapPanel?.selectCluster(e.cluster) : this.mapPanel?.select(e, false),

    }).activate();
    this.mapPanel ??= new WorldMapPanel($('fullmap-panel'), {
      minimap: () => this.minimap, player: () => this.player.position, npcs: () => this.npcs?.npcs ?? [],
      walk: (x, z) => { if (this.walkTo(x, z, 10)) this.toggleMap(); },
      changed: () => { if (!$('fullmap-panel').hidden) this.minimap.drawFull(this.player.position, this.player.group.rotation.y, this.minimapState()); },
    });
    this.mapPanel.setMap(map);
    Minimap.mountLegend($('fullmap-legend'));
    const lv = levelText(map.levels);
    $('mini-name').textContent = map.name; $('mini-sub').textContent = map.sub ?? ''; $('mini-lv').textContent = lv ?? ''; $('mini-lv').hidden = !lv;
    document.querySelector('.minimap').dataset.theme = this.minimap.theme.key;
    document.querySelector('.map-caption h2').textContent = map.name;
    if (map.sub) document.querySelector('.map-caption p').textContent = map.sub;
    if (this.debugGroup) {
      this.debugGroup.removeFromParent(); this.debugGroup.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); this.debugGroup = null;
      if (this.debugOn) { this.debugOn = false; this.toggleDebug(); }
    }
    world.atmosphere.setEnabled($('particles').checked);
    world.grass.mesh.geometry.instanceCount = $('quality').value === 'high' ? 56000 : 34000;
    this.setWorldShadows($('quality').value === 'high');
    if (this.view) { this.view.recenter(); this.view.snap(this.player.position); }
    if (this.questUI) this.updateJournal();
    this.training?.enterMap(map.id);
    this.net?.enterMap(map.id);
    this.game?.hud?.setSafe(map.safe); // world-designer hook: fight tips only on maps with monsters
  }

  // Click-to-walk (ground clicks and landmarks picked on the full map): plans a
  // route with findPath to (x, z), or to the nearest standable point within `near`.
  // The route is planned with more room than the body needs (ROOMY) so it keeps off walls and
  // trunks; only when that finds nothing does it plan at the body's own width.
  walkTo(x, z, near = 0, { replan = false } = {}) {
    const stand = (a, b) => this.world.canStand(a, b);
    let goal = stand(x, z) ? { x, z } : null;
    for (let r = 1; !goal && r <= near; r++) for (let i = 0; i < 16 && !goal; i++) { const a = i / 16 * Math.PI * 2, gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r; if (stand(gx, gz)) goal = { x: gx, z: gz }; }
    // long trips (a tap on the map across the city) plan on a coarser grid so the search stays small
    let route = null;
    for (const pad of [ROOMY, undefined]) for (const step of [.5, 1, 1.5]) if (goal && !route) route = findPath((a, b) => this.world.canStand(a, b, pad), this.player.position, goal, { step, maxCells: 160000 });
    if (!route) { if (!replan) this.note('ไปที่นั่นไม่ได้ · ไม่มีทางเดินถึงจุดนั้น'); return false; }
    this.game?.onManualMove(); this.training?.onManualMove(); this.view.recenter();
    if (!replan) this.replans = 0;
    this.route = route; this.autoWalk = false; this.navGoal = { x: goal.x, z: goal.z }; this.nextWaypoint();
    this.marker.position.set(goal.x, this.world.heightAt(goal.x, goal.z) + .07, goal.z); this.marker.visible = true;
    return true;
  }
  // Combat's walk-in (chasing a target, a skill walking into range): around trees and walls by
  // a short route (findPath), redone only once the target has moved or the walk got stuck.
  // false when there is no way there (the target is then dropped: src/combat/Combat.js).
  chaseTo(x, z) {
    const g = this.chaseGoal;
    if (this.autoWalk && this.destination && g && Math.hypot(g.x - x, g.z - z) < 1.5) return true;
    const b = this.chaseBlocked;
    if (b && this.elapsed < b.until && Math.hypot(b.x - x, b.z - z) < 2.5) return false;
    this.chaseGoal = { x, z };
    const stand = (a, b) => this.world.canStand(a, b);
    let goal = stand(x, z) ? { x, z } : null;   // a monster by a trunk: the nearest free spot beside it
    for (let r = .5; !goal && r <= 2; r += .5) for (let i = 0; i < 12 && !goal; i++) { const a = i / 12 * Math.PI * 2, gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r; if (stand(gx, gz)) goal = { x: gx, z: gz }; }
    const route = goal && (findPath((a, b) => this.world.canStand(a, b, ROOMY), this.player.position, goal, { step: .5, margin: 6, maxCells: 40000 }) || findPath(stand, this.player.position, goal, { step: .5, margin: 6, maxCells: 40000 }));
    if (!route) { this.stopWalk(); return false; }
    this.route = route; this.autoWalk = true; this.navGoal = null; this.marker.visible = false; this.nextWaypoint();   // a chase shows no marker of its own
    return true;
  }
  nextWaypoint() { const w = this.route.shift(); this.destination = new THREE.Vector3(w.x, 0, w.z); this.walkBest = Infinity; this.walkStall = 0; }
  stopWalk() { this.destination = null; this.route = []; this.marker.visible = false; this.navGoal = null; }
  // The way still to walk, for the minimap (null when not walking somewhere).
  get nav() { return this.navGoal && this.destination ? { goal: this.navGoal, route: [this.destination, ...this.route] } : null; }

  togglePhoto() { this.photo = !this.photo; document.body.classList.toggle('photo-mode', this.photo); $('restore-ui').hidden = !this.photo; }
  toggleMap() {
    if (this.serviceModalOpen) return;
    const panel = $('fullmap-panel'); panel.hidden = !panel.hidden;
    // QA fix: a hover tooltip left open when the panel closes (M, Esc, click-to-walk) never gets its mouseleave; reset it.
    const tip = panel.querySelector('.map-tip'); if (tip) tip.hidden = true;
    if (!panel.hidden) { this.mapPanel.refresh(); this.minimap.drawFull(this.player.position, this.player.group.rotation.y, this.minimapState()); }
  }
  locateMonster(monster, location) {
    if (!location || !this.minimap) return;
    this.mapPanel.category = 'all'; this.mapPanel.query = ''; $('map-search').value = '';
    let entry;
    if (location.map !== this.maps.map.id) {
      const portal = nextPortal(this.maps.map.id, location.map);
      entry = this.minimap.directory.find(e => e.portal?.id === portal?.id);
    } else {
      entry = this.minimap.directory.find(e => e.id === `hunt:${location.area}`);
      if (!entry) {
        entry = { id: `guide:${location.area}`, name: `แหล่งล่า · ${monster.name}`, detail: `${location.name} · เลือกเดินไปเมื่อพร้อม`,
          x: location.x, z: location.z, category: 'hunting', purpose: 'combat', glyph: 'combat', tag: `Lv ${monster.level}`, goal: location.approach };
        const old = this.minimap.directory.findIndex(e => e.id === entry.id);
        if (old < 0) this.minimap.directory.push(entry); else this.minimap.directory[old] = entry;
      }
    }
    if ($('fullmap-panel').hidden) this.toggleMap();
    if (entry) this.mapPanel.select(entry);
  }
  // What the minimap draws on top of the painted map (refreshed with the HUD, ~8 times a second).
  minimapState() {
    const q = this.questsReady ? this.quests : null;
    return {
      t: this.elapsed, night: this.envNight ?? 0, npcs: this.npcs?.npcs, monsters: this.game?.combat?.monsters,
      quest: q ? id => q.marker(id) : null, targets: q ? questTargets(q.active()) : null,
      view: this.view.groundFootprint(), nav: this.nav,
    };
  }
  // World time, wind and the developer view are for GMs (the server says so) and local builds;
  // everyone else keeps the shared clock and the default wind.
  setDev(on) {
    this.devAllowed = !!on; document.body.classList.toggle('dev-mode', this.devAllowed);
    if (on) return;
    if ($('time-mode').value !== 'auto') { $('time-mode').value = 'auto'; $('time-mode').dispatchEvent(new Event('change')); }
    if ($('time-speed').value !== '1') { $('time-speed').value = '1'; $('time-speed').dispatchEvent(new Event('change')); }
    if (this.debugOn) this.toggleDebug();
  }
  toggleDebug() {
    if ((!this.devAllowed && !this.debugOn) || this.maps.busy || !this.npcs) return;
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
    if (this.maps.busy || this.serviceModalOpen || !this.npcs) return;
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
    // places are found silently by walking through them (no prompt, no popup)
  }
  closeDialogue() { this.hud.closeDialogue(); this.talking?.release(); this.talking = null; }
  // Quest offers and the trade button for the NPC being talked to.
  refreshDialogue() {
    const npc = this.talking;
    if (!npc) return;
    this.questUI.renderDialogue(npc.id);
    $('dlg-shop').hidden = !(this.game?.character && SHOPS[npc.def.shopType]?.stock?.length);
    $('dlg-warp').hidden = !npc.def.warpService;
    $('dlg-storage').hidden = !npc.def.storageService;
  }
  // A small line in the game feed (no popup in the middle of the screen).
  note(text) { this.game?.hud?.feed?.log(text, 'bad', true); }
  nearLandmark() {
    const p = this.player.position;
    return this.maps.landmarks.find(l => (!l.hidden || this.discovered.has(l.id)) && Math.hypot(l.x - p.x, l.z - p.z) < Math.min(l.radius, 8) + 1.5) ?? null;
  }
  discover(l, force = false) {
    const fresh = !this.discovered.has(l.id);
    if (!fresh && !force) return;
    this.discovered.add(l.id);
    if (l.hidden && fresh) this.minimap?.invalidate(); // hidden places (the cemetery) tint the painted map once found
    slotStorage.setItem('tno.discovered.v1', JSON.stringify([...this.discovered]));
    this.quests.onDiscover(l.id);
    this.updateJournal();
  }
  updateJournal() {
    // Counts and hints cover the loaded map only (another map's landmarks can't be found from here).
    const known = this.maps.landmarks.filter(l => !l.hidden || this.discovered.has(l.id)), p = this.player.position;
    const next = known.filter(l => !this.discovered.has(l.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    this.hud.setJournal(known.filter(l => this.discovered.has(l.id)).length, known.length, next?.name, this.maps.map.name, this.maps.map.intro);
  }

  // Low quality: only the characters and monsters throw shadows; the map (houses, trees, props,
  // grass) keeps receiving them. On a phone the shadow pass over the whole map is the dearest
  // thing after resolution, and the player's own shadow is what reads.
  setWorldShadows(on) {
    const root = this.world?.root; if (!root) return;
    root.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.castShadow0 === undefined) o.userData.castShadow0 = o.castShadow;
      o.castShadow = on && o.userData.castShadow0;
    });
  }

  tick(time) {
    if (document.hidden) { this.previous = null; return; }
    const dt = this.previous === null ? 0 : Math.min((time - this.previous) / 1000, .05);
    this.previous = time;
    this.frame(time, dt);
    this.frames++; this.fpsTime += dt;
    if (this.fpsTime > .5) {
      this.fps = this.frames / this.fpsTime; this.frames = 0; this.fpsTime = 0;
      // a machine that cannot hold 28 fps on high for eight seconds running goes to low once (the player can set it back)
      if (this.prefs.quality === 'high' && !this.autoLowered && this.game) {
        this.slowFor = this.fps < 28 ? (this.slowFor ?? 0) + .5 : 0;
        if (this.slowFor >= 8) { this.autoLowered = true; $('quality').value = 'low'; $('quality').dispatchEvent(new Event('change')); this.hud.toast('ปรับกราฟิกเป็น "ประหยัด" ให้อัตโนมัติ เพราะเครื่องเริ่มกระตุก · เปลี่ยนกลับได้ในตั้งค่า', ''); }
      }
    }
  }
  // One beat while the tab is hidden: the time since the last one in steps of at most 50 ms
  // (as a frame would be), at most a second's worth, nothing drawn.
  backgroundStep(now) {
    let left = Math.min((now - this.bgPrevious) / 1000, 1);
    this.bgPrevious = now;
    while (left > 1e-4) { const dt = Math.min(left, .05); left -= dt; this.frame(now, dt, false); }
  }
  frame(time, dt, draw = true) {
    this.elapsed += dt;
    const p = this.player.position, view = this.view;
    this.clock.update(dt);
    if (!this.maps.busy) this.locationMusic?.update(dt, {
      mapId: this.maps.map?.id ?? 'city', regionId: regionAt(p.x, p.z, this.discovered.has('cemetery')).id, phase: this.clock.phase,
      ...combatMusicState(this.game?.combat, p),
    });
    // While maps swap the fade overlay covers the screen; the clock keeps running.
    if (this.maps.busy || !this.world) return;
    // Movement: keys, or a straight walk to a clicked point.
    // A skill move (training.busy) only holds the player in place: a walk the player clicked
    // goes on once it ends; a combat auto-walk is dropped (combat sets a new one if needed).
    const alive = this.game?.canMove ?? true, canMove = alive && !this.training?.busy && !this.serviceModalOpen;
    if (!alive || (!canMove && this.autoWalk)) this.stopWalk();
    const dir = canMove ? this.input.direction(view.forward, view.right, this.dir) : this.dir.set(0, 0, 0);
    let stalled = false;
    if (canMove && !dir.lengthSq() && this.destination) {
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
    // Footsteps, faster when running.
    this.stepTime = moved ? (this.stepTime ?? 0) + dt : 0;
    if (this.stepTime > (this.input.running ? .3 : .42)) { this.stepTime = 0; Sound.sfx('step'); }
    this.maps.update(dt, this.elapsed);
    if (this.maps.busy) return;
    if (canMove && (!moved && dt > 0 || stalled) && this.destination) {
      // a walk the player asked for that ran into something the grid missed: plan again from
      // here (a few times) before giving up and saying so
      let replanned = false;
      if (!this.autoWalk && this.navGoal && (this.replans = (this.replans ?? 0) + 1) <= 3) { const g = this.navGoal; this.stopWalk(); replanned = this.walkTo(g.x, g.z, 10, { replan: true }); }
      if (!replanned) {
        // Combat auto-walk retries every frame; only a manual click reports a blocked path.
        if (!this.autoWalk) this.note('เส้นทางถูกกีดขวาง · ลองเดินอ้อมด้วย W A S D');
        // a chase that got stuck (a route the grid allowed but the body cannot pass): that goal is
        // off for a while, so the next chaseTo says no and AUTO turns to another monster
        else if (this.chaseGoal) this.chaseBlocked = { ...this.chaseGoal, until: this.elapsed + 6 };
        this.stopWalk();
      }
    }
    if (dir.lengthSq() && this.hud.dialogueOpen && this.talking && Math.hypot(this.talking.x - p.x, this.talking.z - p.z) > this.talking.interactionRadius + 1.5) this.closeDialogue();

    const env = this.env.update(this.clock.hour, view.focus);
    this.postfx.update(env);
    this.envNight = env.night;
    this.world.update(this.elapsed, dt, view.focus, env);
    this.npcs.update(dt, this.elapsed, p);
    this.game?.update(dt, this.elapsed);
    this.training?.update(dt);
    if (!this.questsReady && this.game?.ready) { this.quests.attach(this.game.character, this.game.combat); this.questsReady = true; }
    this.player.bindCombat(this.game); // rigged class model + skill animations (no-op once bound)
    if (this.training === undefined && this.game?.ready) this.startTraining();
    if (!this.net && this.game?.ready && this.training !== undefined) this.net = startMultiplayer(this); // other players + chat (src/net)
    this.net?.update(dt, view.camera);
    if (this.shop.open && Math.hypot(this.shop.npc.x - p.x, this.shop.npc.z - p.z) > this.shop.npc.interactionRadius + 2) this.shop.close();
    view.update(dt, p);
    if (this.marker.visible) this.marker.scale.setScalar(1 + Math.sin(this.elapsed * 5) * .12);
    this.hud.updatePlates(this.npcs.npcs, view.camera, p, n => this.npcs.label(n), n => (this.questsReady ? this.quests.marker(n.id) : null));

    if (time - this.lastHud > 120 || time === 0) {
      this.lastHud = time;
      this.hud.setRegion(regionAt(p.x, p.z, this.discovered.has('cemetery')));
      this.hud.setClock(this.clock.label, this.clock.phase, this.clock.hour);
      this.hud.setCoords(p);
      this.menu.setAlert((this.game?.character?.points ?? 0) > 0);
      const mapState = this.minimapState();
      this.minimap.update(p, this.player.group.rotation.y, mapState);
      if (!$('fullmap-panel').hidden) this.minimap.drawFull(p, this.player.group.rotation.y, mapState);
      for (const l of this.maps.landmarks) if (!this.discovered.has(l.id) && Math.hypot(l.x - p.x, l.z - p.z) < l.radius) this.discover(l);
      const npc = this.hud.dialogueOpen ? null : this.npcs.nearestInteractable(p.x, p.z);
      this.hud.prompt(npc ? `คุยกับ ${npc.def.name} · ${this.npcs.label(npc)}` : null);
      this.audio.setMood({ night: env.night, wild: env.wild, cemetery: env.cemetery });
      if (this.debugOn) {
        const info = this.renderer.info.render;
        this.hud.debug(`FPS ${this.fps.toFixed(0)} · draw calls ${info.calls} · ${(info.triangles / 1000).toFixed(0)}k tris\nNPC ใกล้ ${this.npcs.visibleCount}/${this.npcs.npcs.length} · ${this.clock.label} (${this.clock.phase})\nตำแหน่ง ${p.x.toFixed(1)}, ${p.z.toFixed(1)} · spawn ที่ใช้งาน ${activeSpawns(this.clock.phase).length}\nบ้าน ${this.world.stats.houses} · ต้นไม้ป่า ${this.world.stats.forestTrees} · สร้างโลก ${this.world.stats.buildMs} ms
แผนที่ย่อ วาด ${this.minimap.stats.drawMs} ms · ปูพื้น ${this.minimap.stats.buildMs} ms`);
      }
    }
    if (draw) { this.postfx.adapt(dt); this.postfx.render(); }
  }
}
