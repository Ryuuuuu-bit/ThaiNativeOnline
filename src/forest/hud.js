import { el, esc, setBar } from '../character/ui/dom.js';

// Forest HUD: an Ayutthaya-flavoured lacquer-and-gold overlay built entirely
// from data (skills, player state, map info) so index.html stays a bare shell.
//
//   const hud = createHud(root, { map, player, skills, minimap, controls });
//   hud.castSkill(skill) → bool   checks MP + cooldown, spends MP, starts the sweep
//   hud.update(dt, position, yaw) once per frame (minimap and bars are throttled)
//   hud.log(text, kind) · hud.banner(text) · hud.toggleHidden()
//
// `player` is a plain state object ({ name, title, level, hp, maxHp, mp, maxMp,
// exp, expMax }) owned by the caller; the HUD only reads it, except castSkill,
// which deducts MP.

const MINI_SIZE = 176, FEED_MAX = 7, REFRESH_MS = 100, BANNER_MS = 1600, TOAST_MS = 1400;
const KEY_LABEL = code => code.replace('Digit', '').replace('Key', '');

export function createHud(root, { map, player, skills, minimap, controls }) {
  const hud = el('div', 'hud');
  root.appendChild(hud);

  // ---- Player frame -------------------------------------------------------
  const frame = el('section', 'hud-player ornate');
  frame.innerHTML = `
    <div class="hud-portrait"><span>${esc(player.icon ?? '🥊')}</span><b class="hud-lv"></b></div>
    <div class="hud-info">
      <div class="hud-name"><b></b><span></span></div>
      <div class="g-bar hud-hp"><span></span><em></em></div>
      <div class="g-bar hud-mp"><span></span><em></em></div>
      <div class="g-bar hud-exp"><span></span><em></em></div>
    </div>`;
  hud.appendChild(frame);
  const bars = { hp: frame.querySelector('.hud-hp'), mp: frame.querySelector('.hud-mp'), exp: frame.querySelector('.hud-exp') };
  const lv = frame.querySelector('.hud-lv'), nameEl = frame.querySelector('.hud-name b'), titleEl = frame.querySelector('.hud-name span');
  function refreshStats() {
    lv.textContent = `Lv ${player.level}`;
    nameEl.textContent = player.name; titleEl.textContent = player.title ?? '';
    setBar(bars.hp, player.hp, player.maxHp); setBar(bars.mp, player.mp, player.maxMp);
    setBar(bars.exp, player.exp, player.expMax, `EXP ${(player.exp / player.expMax * 100).toFixed(1)}%`);
    frame.classList.toggle('hud-low', player.hp / player.maxHp < .25);
  }

  // ---- Map banner ---------------------------------------------------------
  const banner = el('section', 'hud-map');
  banner.innerHTML = `<i></i><div><b>${esc(map.name)}</b><span>${esc(map.weather)}</span></div><i></i>`;
  hud.appendChild(banner);

  // ---- Minimap + quick buttons --------------------------------------------
  const mini = el('section', 'hud-minimap ornate');
  mini.innerHTML = `
    <div class="hud-mini-head"><span>แผนที่</span><span class="hud-coords">0, 0</span></div>
    <div class="hud-mini-frame"><canvas width="${MINI_SIZE}" height="${MINI_SIZE}" aria-label="แผนที่ย่อ"></canvas><i class="hud-compass">N</i></div>
    <div class="hud-mini-foot">
      <button class="hud-icon" data-act="settings" title="ตั้งค่า (O)" aria-label="ตั้งค่า">⚙</button>
      <button class="hud-icon" data-act="sound" title="เสียงป่า" aria-label="เสียงป่า" aria-pressed="false">♫</button>
      <button class="hud-icon" data-act="screenshot" title="ภาพหน้าจอ" aria-label="ภาพหน้าจอ">📷</button>
      <button class="hud-icon" data-act="camera" title="คืนกล้อง (R)" aria-label="คืนกล้อง">⟲</button>
      <button class="hud-icon" data-act="hide" title="ซ่อน UI (H)" aria-label="ซ่อน UI">◻</button>
    </div>`;
  hud.appendChild(mini);
  const coords = mini.querySelector('.hud-coords'), canvas = mini.querySelector('canvas'), ctx = canvas.getContext('2d');
  // Trees are painted once; the live layer is just the player dot and view cone.
  const base = document.createElement('canvas'); base.width = base.height = MINI_SIZE;
  {
    const b = base.getContext('2d'), g = b.createRadialGradient(MINI_SIZE / 2, MINI_SIZE / 2, 20, MINI_SIZE / 2, MINI_SIZE / 2, MINI_SIZE / 2);
    g.addColorStop(0, '#eef1f6'); g.addColorStop(1, '#cfd8e6'); b.fillStyle = g; b.fillRect(0, 0, MINI_SIZE, MINI_SIZE);
    for (const t of minimap.trees) {
      b.fillStyle = t.kind === 'pine' ? '#3d5a4a' : '#6b8a5c';
      b.beginPath(); b.arc(toMini(t.x), toMini(t.z), t.radius * .95, 0, Math.PI * 2); b.fill();
    }
  }
  function toMini(v) { return (v / minimap.half / 2 + .5) * MINI_SIZE; }
  function drawMinimap(p, yaw) {
    ctx.drawImage(base, 0, 0);
    const x = toMini(p.x), y = toMini(p.z);
    // View cone: the camera sits behind the player along +yaw, so it looks toward -yaw.
    ctx.save(); ctx.translate(x, y); ctx.rotate(-yaw);
    ctx.fillStyle = '#d4a94f33'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 26, -Math.PI / 2 - .55, -Math.PI / 2 + .55); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ff6f91'; ctx.shadowColor = '#ff6f91'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    coords.textContent = `${Math.round(p.x + minimap.half)}, ${Math.round(p.z + minimap.half)}`;
  }

  // ---- Settings drawer ----------------------------------------------------
  const settings = el('section', 'hud-settings ornate');
  settings.hidden = true;
  settings.innerHTML = `
    <h3>ตั้งค่า <button class="hud-x" data-act="settings" aria-label="ปิด">✕</button></h3>
    <label>แรงลม <output>55%</output><input type="range" min="0" max="100" value="55" data-set="wind" /></label>
    <label class="hud-check"><input type="checkbox" checked data-set="snow" /> หิมะตก</label>
    <div class="hud-row"><button class="hud-btn" data-act="export-sprite">⬇ Sprite sheet 8 ทิศ</button><button class="hud-btn" data-act="screenshot">⬇ ภาพหน้าจอ</button></div>
    <p class="hud-tip">${esc(controls.help ?? '')}</p>`;
  hud.appendChild(settings);
  const soundButton = mini.querySelector('[data-act=sound]');
  const windOut = settings.querySelector('output');
  settings.querySelector('[data-set=wind]').addEventListener('input', e => { windOut.value = `${e.target.value}%`; controls.onWind?.(Number(e.target.value) / 100); });
  settings.querySelector('[data-set=snow]').addEventListener('change', e => controls.onSnow?.(e.target.checked));

  // ---- Feed + banner + toast ----------------------------------------------
  const feed = el('section', 'hud-feed');
  const centre = el('div', 'hud-banner'), toast = el('div', 'hud-toast');
  hud.append(feed, centre, toast);
  let bannerTimer = 0, toastTimer = 0;
  function log(text, kind = '') {
    feed.appendChild(el('p', kind, esc(text)));
    while (feed.children.length > FEED_MAX) feed.firstChild.remove();
  }
  function showBanner(text) {
    centre.textContent = text; centre.classList.remove('on'); void centre.offsetWidth; centre.classList.add('on');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => centre.classList.remove('on'), BANNER_MS);
  }
  function showToast(text) {
    toast.textContent = text; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), TOAST_MS);
  }

  // ---- Skill bar ----------------------------------------------------------
  const bar = el('section', 'hud-skillbar ornate');
  const slots = new Map(), cooldowns = new Map();
  for (const skill of skills) {
    const slot = el('button', 'hud-skill');
    slot.dataset.id = skill.id; slot.title = `${skill.name} · MP ${skill.mp} · คูลดาวน์ ${skill.cooldown}s`;
    slot.setAttribute('aria-label', skill.name);
    slot.innerHTML = `<small>${KEY_LABEL(skill.key)}</small><span>${skill.icon ?? '✦'}</span><i class="hud-cd"></i><b>${skill.mp || ''}</b>`;
    slot.addEventListener('click', () => controls.onSkill?.(skill));
    bar.appendChild(slot); slots.set(skill.id, { skill, slot, cd: slot.querySelector('.hud-cd') });
  }
  hud.appendChild(bar);
  function castSkill(skill) {
    const entry = slots.get(skill.id);
    if (!entry) return false;
    if (cooldowns.has(skill.id)) { showToast('สกิลยังไม่พร้อม'); shake(entry.slot); return false; }
    if (player.mp < skill.mp) { showToast('MP ไม่พอ'); shake(entry.slot); return false; }
    player.mp -= skill.mp;
    cooldowns.set(skill.id, { left: skill.cooldown, total: skill.cooldown });
    entry.slot.classList.add('on', 'flash'); setTimeout(() => entry.slot.classList.remove('flash'), 250);
    showBanner(skill.name); log(`ใช้ ${skill.name}`, 'skill');
    refreshStats();
    return true;
  }
  function shake(node) { node.classList.remove('shake'); void node.offsetWidth; node.classList.add('shake'); }
  function tickCooldowns(dt) {
    for (const [id, cd] of cooldowns) {
      cd.left -= dt;
      const { slot, cd: sweep } = slots.get(id);
      if (cd.left <= 0) { cooldowns.delete(id); slot.classList.remove('on'); sweep.style.setProperty('--p', '0%'); sweep.textContent = ''; continue; }
      sweep.style.setProperty('--p', `${cd.left / cd.total * 100}%`);
      sweep.textContent = cd.left >= 1 ? Math.ceil(cd.left) : cd.left.toFixed(1);
    }
    for (const { skill, slot } of slots.values()) slot.classList.toggle('poor', player.mp < skill.mp && !cooldowns.has(skill.id));
  }

  hud.appendChild(el('p', 'hud-help', esc(controls.help ?? '')));

  // ---- Buttons ------------------------------------------------------------
  hud.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'settings') settings.hidden = !settings.hidden;
    else if (act === 'hide') toggleHidden();
    else if (act === 'camera') controls.onResetCamera?.();
    else if (act === 'screenshot') controls.onScreenshot?.();
    else if (act === 'export-sprite') controls.onExportSprite?.();
    else if (act === 'sound') {
      const on = await controls.onSound?.();
      if (on === null) { soundButton.textContent = '✕'; soundButton.title = 'ไม่รองรับเสียง'; return; }
      soundButton.setAttribute('aria-pressed', String(Boolean(on))); soundButton.classList.toggle('on', Boolean(on));
    }
  });
  function toggleHidden() { return document.body.classList.toggle('hud-hidden'); }

  // ---- Per-frame ----------------------------------------------------------
  let since = REFRESH_MS;
  function update(dt, position, yaw) {
    tickCooldowns(dt);
    since += dt * 1000;
    if (since < REFRESH_MS) return;
    since = 0; refreshStats(); drawMinimap(position, yaw);
  }

  refreshStats();
  return { element: hud, castSkill, update, log, banner: showBanner, toast: showToast, toggleHidden, toggleSettings: () => { settings.hidden = !settings.hidden; }, refresh: refreshStats };
}
