// Public interface of the combat system: wires the character, combat rules,
// 3D view and HUD into a world. The world only provides movement hooks, so the
// same module plugs into the city. See README.md.
import * as THREE from 'three';
import { loadOrCreateCharacter, CharacterUI, Feed } from '../character/index.js';
import { el } from '../character/ui/dom.js';
import { Combat } from './Combat.js';
import { CombatView } from './CombatView.js';
import { CombatHUD } from './ui/CombatHUD.js';
import { BUFF_ICONS } from './data/skills.js';

/**
 * @param {object} o
 * @param {HTMLElement} o.root     UI container (#app)
 * @param {HTMLElement} o.host     element holding the canvas, for click targeting
 * @param {THREE.Scene} o.scene
 * @param {THREE.Camera} o.camera
 * @param {{group: THREE.Object3D}} o.player
 * @param {(x:number,z:number)=>boolean} o.canStand
 * @param {(x:number,z:number)=>number} o.groundHeight
 * @param {(x:number,z:number)=>void} o.moveTo   walk the player toward a point
 * @param {()=>void} o.stop                     stop click-to-move
 * @param {{x:number,z:number}} o.respawnPoint
 * @param {Array} [o.spawns]                    monster spawn zones (src/data/spawns.js; none by default)
 * @returns {{ready:boolean, character, combat, view, hud, characterUI, canMove:boolean,
 *   setPhase(phase:string):void, handleKey(e:KeyboardEvent):boolean, update(dt:number, elapsed:number):void, onManualMove():void}}
 */
export function createGame(o) {
  const game = {
    ready: false, character: null, combat: null, view: null, hud: null, characterUI: null, phase: 'day',
    setPhase(phase) { this.phase = phase; this.combat?.setPhase(phase); },
    get canMove() { return !this.ready || this.character.alive; },
    handleKey: () => false, update: () => {}, onManualMove: () => {},
  };

  const begin = character => {
    const combat = new Combat(character, {
      canStand: o.canStand,
      playerPos: () => o.player.group.position,
      moveTo: o.moveTo, stop: o.stop,
    }, o.spawns);
    const view = new CombatView(o.scene, combat, o.groundHeight);
    const layer = el('div', 'g-layer'); o.root.append(layer);
    const feed = new Feed(layer);
    const characterUI = new CharacterUI(layer, character, feed, { buffIcons: BUFF_ICONS });
    const hud = new CombatHUD(o.root, layer, combat, feed, characterUI.quickButtons);
    // A world with no monster zones (the safe city today): no fight hints, Tab / Space idle.
    // isSafe() (the loaded map) wins: spawns may exist on another map while the player is in a safe one.
    const safe = o.isSafe ? o.isSafe() : !o.spawns?.length; hud.setSafe(safe);
    Object.assign(game, { ready: true, character, combat, view, hud, characterUI });
    combat.setPhase(game.phase);

    combat.on('cast', ({ target }) => {
      if (!target) return;
      const p = o.player.group.position;
      o.player.group.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
    });
    // thrown back / dragged in by a monster (src/combat/monsterHit.js): back on the ground
    combat.on('shoved', e => { o.player.group.position.y = o.groundHeight(e.x, e.z); });
    hud.onRespawn = () => {
      o.player.group.position.set(o.respawnPoint.x, o.groundHeight(o.respawnPoint.x, o.respawnPoint.z), o.respawnPoint.z);
      o.player.group.rotation.z = 0;
      combat.respawnPlayer(); character.save();
    };
    combat.on('player-death', () => { o.stop(); o.player.group.rotation.z = Math.PI / 2; });
    combat.on('kill', () => character.save());
    character.on('levelup', () => character.save());

    // Click a monster to target and attack it. Capture phase runs before the
    // world's click-to-move handler on the same element.
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    o.host.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !character.alive) return;
      const rect = o.host.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, o.camera);
      const hit = raycaster.intersectObjects(view.pickables, true)[0];
      // a finger is wider than a mouse: a tap near a monster (on screen) also picks it
      const monster = (hit && view.monsterById(hit.object.userData.monsterId)) ?? nearOnScreen(event, rect);
      if (!monster) return;
      event.stopPropagation();
      combat.setTarget(monster);
      combat.useSkill(combat.basicSkillId());
    }, { capture: true });

    const sp = new THREE.Vector3();
    function nearOnScreen(event, rect) {
      const reach = event.pointerType === 'touch' ? 46 : 22;
      let best = null, bd = reach;
      for (const m of combat.monsters) {
        if (!m.alive) continue;
        sp.set(m.x, o.groundHeight(m.x, m.z) + .9 * (m.def.size ?? 1), m.z).project(o.camera);
        const d = Math.hypot((sp.x + 1) / 2 * rect.width - (event.clientX - rect.left), (1 - sp.y) / 2 * rect.height - (event.clientY - rect.top));
        if (sp.z < 1 && d < bd) { bd = d; best = m; }
      }
      return best;
    }
    // Lock-on: a monster that hits you while nothing is targeted becomes the target.
    combat.on('monster-attack', m => { if (!combat.target?.alive && m?.alive) combat.setTarget(m); });

    setInterval(() => character.save(), 15000);
    addEventListener('beforeunload', () => character.save());

    game.handleKey = event => {
      if (event.repeat && !/^Digit|Space/.test(event.code)) return false;
      return characterUI.handleKey(event) || hud.handleKey(event);
    };
    game.onManualMove = () => combat.cancelPending();
    const size = { width: 0, height: 0 };
    game.update = (dt, elapsed) => {
      combat.update(dt);
      view.update(dt, elapsed);
      size.width = o.host.clientWidth; size.height = o.host.clientHeight;
      hud.update(dt, o.camera, size, o.groundHeight);
      characterUI.update(dt);
    };
    // Fighting tips show the first time the player is on a map with monsters (CombatHUD.setSafe).
    feed.log(`ยินดีต้อนรับ ${character.name} · 1–0 สกิล · G ออโต้ · Q / F ดื่มยา · C ตัวละคร · I กระเป๋า · ลองสกิลที่หุ่นซ้อมในลานซ้อม`, 'gold');
  };

  loadOrCreateCharacter(o.root).then(begin);
  return game;
}
