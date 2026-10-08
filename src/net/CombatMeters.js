// Name plates (settings → การเล่น → หน้าจอการต่อสู้; kept per browser): the player's own name
// over their head (others' plates: src/net/RemotePlayers.js). Damage shows only as the numbers
// over heads (src/combat/CombatView.js); there is no DPS meter.
//   attachCombatMeters(net, game) → { update(dt, camera) }
import * as THREE from 'three';
import { CLASSES } from '../character/data/classes.js';
import { titleHtml } from '../ui/titleTag.js';

const KEY = 'thainative.meters';
const DEFAULTS = { ownName: true, othersNames: true };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify({ ownName: s.ownName, othersNames: s.othersNames })); } catch { /* private mode */ } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function attachCombatMeters(net, game) {
  const s = load(), c = game.game.character;
  let me = null;
  net.on('welcome', m => { me = m.you; });

  // ---- settings (the "การเล่น" pane) ----
  const pane = document.querySelector('#settings .set-pane[data-pane="play"]');
  if (pane) {
    const box = document.createElement('div');
    box.innerHTML = `<h4 class="set-h">หน้าจอการต่อสู้</h4>
      ${[['ownName', 'ชื่อตัวละครของฉัน', 'ป้ายชื่อเหนือหัวตัวเอง'], ['othersNames', 'ชื่อผู้เล่นอื่น', 'ป้ายชื่อเหนือหัวคนอื่น']]
        .map(([k, t, d]) => `<label class="check-label"><input type="checkbox" data-meter="${k}" ${s[k] ? 'checked' : ''} /> <span>${t}<small>${d}</small></span></label>`).join('')}`;
    pane.prepend(box);
    box.addEventListener('change', e => { const k = e.target.dataset.meter; if (!k) return; s[k] = e.target.checked; save(s); apply(); });
  }

  // ---- name plates ----
  const layer = document.getElementById('nameplates');
  const plate = document.createElement('div'); plate.className = 'plate is-self'; layer?.append(plate);
  let plateText = '';
  const apply = () => { layer?.classList.toggle('hide-others', !s.othersNames); plate.hidden = !s.ownName; };
  const v = new THREE.Vector3();
  apply();

  return {
    get me() { return me; },
    update(dt, camera) {
      // my plate over my head (the remote plates' projection)
      if (!s.ownName || !layer) return;
      const text = `${titleHtml(c.title)}${esc(c.name)}<small>${CLASSES[c.classId]?.name ?? ''} · Lv.${c.level}</small>`;
      if (text !== plateText) { plate.innerHTML = text; plateText = text; }
      const p = game.player.position, host = document.getElementById('world');
      v.set(p.x, p.y + 2.15, p.z).project(camera);
      const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1 || !!document.querySelector('.photo-mode');
      plate.hidden = off;
      if (!off) plate.style.transform = `translate(${(v.x * .5 + .5) * host.clientWidth}px, ${(-v.y * .5 + .5) * host.clientHeight}px) translate(-50%, -100%)`;
    },
  };
}
