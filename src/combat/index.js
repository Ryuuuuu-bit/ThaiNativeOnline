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
    // A world with no monster zones (the safe city today): no combat skill bar, no fight hints.
    const safe = !o.spawns?.length; hud.setSafe(safe);
    Object.assign(game, { ready: true, character, combat, view, hud, characterUI });
    combat.setPhase(game.phase);

    combat.on('cast', ({ target }) => {
      if (!target) return;
      const p = o.player.group.position;
      o.player.group.rotation.y = Math.atan2(target.x - p.x, target.z - p.z);
    });
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
      const monster = hit && view.monsterById(hit.object.userData.monsterId);
      if (!monster) return;
      event.stopPropagation();
      combat.setTarget(monster);
      combat.useSkill(combat.basicSkillId());
    }, { capture: true });

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
    feed.log(safe ? `ยินดีต้อนรับ ${character.name} · ลองสกิล 1–0 ที่หุ่นซ้อมในลานซ้อม · C ตัวละคร · I กระเป๋า` : `ยินดีต้อนรับ ${character.name} · กด Tab เลือกเป้า, 1–4 ใช้ทักษะ, C ตัวละคร, I กระเป๋า`, 'gold');
  };

  loadOrCreateCharacter(o.root).then(begin);
  return game;
}
