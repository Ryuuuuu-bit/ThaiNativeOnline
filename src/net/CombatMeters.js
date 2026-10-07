// Name plates and the DPS meter (settings → การเล่น → หน้าจอการต่อสู้; kept per browser).
//   · the player's own name over their head (others' plates: src/net/RemotePlayers.js)
//   · DPS: damage a second over the last DPS_WINDOW seconds — mine, my party's, everyone else's
//     on this map. Online every blow the server lands comes to the whole room (`mh`, with `by`),
//     so the meter needs nothing new from the server; offline it counts my own hits.
//   attachCombatMeters(net, game, remote, social) → { update(dt, camera) }
import * as THREE from 'three';
import { CLASSES } from '../character/data/classes.js';
import { titleHtml } from '../ui/titleTag.js';

export const DPS_WINDOW = 10;   // s
const KEY = 'thainative.meters';
const DEFAULTS = { ownName: true, othersNames: true, dpsMe: true, dpsParty: true, dpsOthers: false };
const load = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Damage a second per source over the window: { id → dps }. `log`: [{ t, by, amount }].
export function dpsOf(log, now, window = DPS_WINDOW) {
  const out = new Map(), first = new Map();
  for (const h of log) {
    if (now - h.t > window) continue;
    out.set(h.by, (out.get(h.by) ?? 0) + h.amount);
    if (!first.has(h.by)) first.set(h.by, h.t);
  }
  // a fight shorter than the window divides by its own length (at least 2 s, so one big hit is not a spike)
  for (const [by, sum] of out) out.set(by, sum / Math.max(2, Math.min(window, now - first.get(by))));
  return out;
}

export function attachCombatMeters(net, game, remote, social) {
  const s = load(), c = game.game.character, combat = game.game.combat;
  let me = null, log = [], shownAt = 0;
  net.on('welcome', m => { me = m.you; log = []; });

  // ---- settings (the "การเล่น" pane) ----
  const pane = document.querySelector('#settings .set-pane[data-pane="play"]');
  if (pane) {
    const box = document.createElement('div');
    box.innerHTML = `<h4 class="set-h">หน้าจอการต่อสู้</h4>
      ${[['ownName', 'ชื่อตัวละครของฉัน', 'ป้ายชื่อเหนือหัวตัวเอง'], ['othersNames', 'ชื่อผู้เล่นอื่น', 'ป้ายชื่อเหนือหัวคนอื่น'],
        ['dpsMe', 'DPS ของฉัน', 'ดาเมจต่อวินาที (10 วิล่าสุด)'], ['dpsParty', 'DPS ปาร์ตี้', 'สมาชิกปาร์ตี้ที่อยู่แมพเดียวกัน'], ['dpsOthers', 'DPS ผู้เล่นอื่น', 'คนอื่นในแมพและแชนแนลเดียวกัน']]
        .map(([k, t, d]) => `<label class="check-label"><input type="checkbox" data-meter="${k}" ${s[k] ? 'checked' : ''} /> <span>${t}<small>${d}</small></span></label>`).join('')}`;
    pane.prepend(box);
    box.addEventListener('change', e => { const k = e.target.dataset.meter; if (!k) return; s[k] = e.target.checked; save(s); apply(); });
  }

  // ---- name plates ----
  const layer = document.getElementById('nameplates');
  const plate = document.createElement('div'); plate.className = 'plate is-self'; layer?.append(plate);
  let plateText = '';
  const apply = () => { layer?.classList.toggle('hide-others', !s.othersNames); plate.hidden = !s.ownName; render(); };
  const v = new THREE.Vector3();

  // ---- the meter ----
  const box = document.createElement('section'); box.className = 'dps-meter glass'; box.hidden = true;
  (document.getElementById('app') ?? document.body).append(box);
  const nameOf = id => (id === me ? c.name : remote.list.get(id)?.name ?? social?.party?.members.find(p => p.id === id)?.name ?? `#${id}`);
  const clsOf = id => (id === me ? c.classId : remote.list.get(id)?.cls ?? social?.party?.members.find(p => p.id === id)?.cls);
  function render() {
    const now = performance.now() / 1000, dps = dpsOf(log, now), party = new Set(social?.party?.members.map(p => p.id) ?? []);
    const kind = id => (id === me || id === 'me' ? 'me' : party.has(id) ? 'party' : 'other');
    const rows = [...dps].filter(([id]) => ({ me: s.dpsMe, party: s.dpsParty, other: s.dpsOthers }[kind(id)])).sort((a, b) => b[1] - a[1]);
    if (rows.length) shownAt = now;
    box.hidden = !rows.length && now - shownAt > 1;
    if (!rows.length) return;
    const top = rows[0][1] || 1;
    box.innerHTML = `<header>DPS <small>${DPS_WINDOW} วิล่าสุด</small></header>` + rows.slice(0, 8).map(([id, d]) => {
      const k = kind(id), cls = CLASSES[clsOf(id === 'me' ? me : id)];
      return `<div class="dps-row ${k}"><span>${esc(id === 'me' ? c.name : nameOf(id))}<small>${cls?.name ?? ''}</small></span><b>${Math.round(d).toLocaleString()}</b><em><i style="width:${(d / top * 100).toFixed(0)}%"></i></em></div>`;
    }).join('');
  }
  // online: every blow on this map (the server's `mh`); offline: my own hits
  net.on('mh', m => { if (!m.miss && m.amount > 0 && m.by != null) log.push({ t: performance.now() / 1000, by: m.by, amount: m.amount }); });
  combat?.on('hit', e => { if (!combat.remote && e.amount > 0) log.push({ t: performance.now() / 1000, by: me ?? 'me', amount: e.amount }); });
  apply();

  let tick = 0;
  return {
    get me() { return me; },
    update(dt, camera) {
      // my plate over my head (the remote plates' projection)
      if (s.ownName && layer) {
        const text = `${titleHtml(c.title)}${esc(c.name)}<small>${CLASSES[c.classId]?.name ?? ''} · Lv.${c.level}</small>`;
        if (text !== plateText) { plate.innerHTML = text; plateText = text; }
        const p = game.player.position, host = document.getElementById('world');
        v.set(p.x, p.y + 2.15, p.z).project(camera);
        const off = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1 || !!document.querySelector('.photo-mode');
        plate.hidden = off;
        if (!off) plate.style.transform = `translate(${(v.x * .5 + .5) * host.clientWidth}px, ${(-v.y * .5 + .5) * host.clientHeight}px) translate(-50%, -100%)`;
      }
      if ((tick += dt) < .5) return;
      tick = 0; const now = performance.now() / 1000;
      log = log.filter(h => now - h.t <= DPS_WINDOW);
      render();
    },
  };
}
