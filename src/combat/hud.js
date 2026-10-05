// Combat HUD: player HP/MP, target frame, clickable hotbar with cooldowns,
// failure messages and the death overlay. Builds its own DOM inside `container`.
import './combat.css';
import { abilities as defaultAbilities, reasonText } from './data/abilities.js';

function el(tag, className, parent, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

function meter(kind, parent) {
  const wrap = el('div', `cb-meter ${kind}`, parent);
  const fill = el('i', '', wrap);
  const label = el('b', '', wrap);
  return { wrap, fill, label, last: '' };
}

function setMeter(m, value, max) {
  const v = Math.ceil(value), key = `${v}/${max}`;
  if (m.last === key) return;
  m.last = key;
  m.fill.style.transform = `scaleX(${max ? Math.max(0, value) / max : 0})`;
  m.label.textContent = `${v} / ${max}`;
}

export function createCombatHud(container, combat) {
  const abilities = combat.abilities ?? defaultAbilities;
  const root = el('div', 'cb-hud', container);

  // Target frame
  const target = el('div', 'cb-target cb-glass', root);
  target.hidden = true;
  const targetHead = el('div', 'cb-target-head', target);
  const targetName = el('span', '', targetHead);
  const targetInfo = el('small', '', targetHead);
  const targetClose = el('button', 'cb-target-close', targetHead, '×');
  targetClose.type = 'button';
  targetClose.setAttribute('aria-label', 'ยกเลิกเป้าหมาย');
  targetClose.addEventListener('click', () => combat.selectTarget(null));
  const targetHp = meter('hp', target);

  // Dock: player frame + hotbar
  const dock = el('div', 'cb-dock', root);
  const player = el('div', 'cb-player cb-glass', dock);
  const head = el('div', 'cb-player-head', player);
  el('span', '', head, 'ผู้เดินทาง');
  const status = el('small', '', head, 'สงบ');
  const hp = meter('hp', player);
  const mp = meter('mp', player);

  const hotbar = el('div', 'cb-hotbar cb-glass', dock);
  hotbar.setAttribute('role', 'toolbar');
  hotbar.setAttribute('aria-label', 'แถบทักษะ');
  const slots = abilities.map(ability => {
    const button = el('button', 'cb-slot', hotbar);
    button.type = 'button';
    button.title = `${ability.name} (${ability.key})${ability.description ? ` · ${ability.description}` : ''}${ability.mpCost ? ` · MP ${ability.mpCost}` : ''}`;
    button.setAttribute('aria-label', `${ability.name} ปุ่ม ${ability.key}`);
    el('span', 'cb-key', button, ability.key);
    if (ability.mpCost) el('span', 'cb-cost', button, ability.mpCost);
    el('span', 'cb-icon', button, ability.icon ?? '◆');
    el('span', 'cb-name', button, ability.name);
    const cd = el('span', 'cb-cd', button);
    const cdText = el('span', 'cb-cd-text', button);
    // pointerdown keeps clicks from also reaching the world (no walk-to on tap)
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.stopPropagation();
      flashUsed(button);
      combat.useAbility(ability.slot);
      button.blur();
    });
    return { ability, button, cd, cdText, lastCd: -1, wasCooling: false, noMp: null };
  });

  const message = el('div', 'cb-message', root);
  message.setAttribute('role', 'status');
  const hit = el('div', 'cb-hit', root);
  const death = el('div', 'cb-death', root);
  death.hidden = true;
  el('h3', '', death, 'คุณหมดสติ');
  const deathText = el('p', '', death);

  let messageTimer, hitTimer;
  function showMessage(text) {
    message.textContent = text;
    message.classList.add('show');
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => message.classList.remove('show'), 1300);
  }
  function flashUsed(button) {
    button.classList.add('used');
    setTimeout(() => button.classList.remove('used'), 110);
  }

  const offs = [
    combat.on('abilityFailed', ({ reason }) => { if (reason !== 'gcd') showMessage(reasonText[reason] ?? reason); }),
    combat.on('ability', ({ ability }) => { const s = slots.find(x => x.ability === ability); if (s) flashUsed(s.button); }),
    combat.on('damage', e => {
      if (e.targetKind !== 'player') return;
      hit.classList.add('show');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hit.classList.remove('show'), 90);
    }),
    combat.on('death', e => { if (e.who === 'enemy') showMessage(`ปราบ${e.enemy.name} · +${e.exp} EXP`); }),
    combat.on('respawn', e => { if (e.who === 'player') showMessage('ฟื้นคืนสติ ณ จุดเริ่มต้น'); }),
  ].filter(Boolean);

  let lastTarget, lastStatus = '';
  function update() {
    const ps = combat.playerState;
    setMeter(hp, ps.hp, ps.maxHp);
    setMeter(mp, ps.mp, ps.maxMp);
    player.classList.toggle('low', !ps.dead && ps.hp / ps.maxHp < 0.3);
    const statusText = ps.dead ? 'หมดสติ' : ps.inCombat ? 'กำลังต่อสู้' : 'สงบ';
    if (statusText !== lastStatus) { status.textContent = statusText; lastStatus = statusText; }

    const t = combat.getTarget();
    if (t !== lastTarget) {
      lastTarget = t;
      target.hidden = !t;
      if (t) {
        targetName.textContent = t.def.name;
        targetInfo.textContent = `Lv.${t.def.level}${t.def.elite ? ' · ELITE' : ''}`;
        target.classList.toggle('elite', !!t.def.elite);
        targetHp.last = '';
      }
    }
    if (t) setMeter(targetHp, t.hp, t.maxHp);

    for (const s of slots) {
      const { remaining, fraction } = combat.getCooldown ? combat.getCooldown(s.ability.slot) : { remaining: 0, fraction: 0 };
      const frac = Math.round(fraction * 100) / 100;
      if (frac !== s.lastCd) {
        s.lastCd = frac;
        s.cd.style.setProperty('--cd', `${frac}turn`);
      }
      const text = remaining > 0.6 ? String(Math.ceil(remaining)) : '';
      if (s.cdText.textContent !== text) s.cdText.textContent = text;
      const cooling = remaining > 0;
      if (s.wasCooling && !cooling && s.ability.cooldown > 1.5) {
        s.button.classList.remove('ready-flash'); void s.button.offsetWidth; s.button.classList.add('ready-flash');
      }
      s.wasCooling = cooling;
      const noMp = ps.mp < s.ability.mpCost;
      if (noMp !== s.noMp) { s.noMp = noMp; s.button.classList.toggle('no-mp', noMp); }
    }

    death.hidden = !ps.dead;
    if (ps.dead) deathText.textContent = `จะฟื้นคืนสติที่จุดเริ่มต้นใน ${Math.ceil(ps.respawnIn)} วินาที`;
  }
  update();

  return {
    update,
    root,
    destroy() { offs.forEach(off => typeof off === 'function' && off()); root.remove(); },
  };
}
