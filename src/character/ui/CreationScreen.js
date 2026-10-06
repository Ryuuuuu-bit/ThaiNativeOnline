import { CLASSES, STATS, STAT_LABELS } from '../data/classes.js';
import { SKILLS } from '../../combat/data/skills.js';
import { el } from './dom.js';
import { classReady } from '../../data/training.js';

// Character creation; resolves with { name, classId, gender }.
// Classes that are not ready yet (src/data/training.js) show as a locked black
// silhouette with "?"; ?classes=all unlocks them for testing.
export function showCreation(root) {
  return new Promise(resolve => {
    const all = new URLSearchParams(location.search).get('classes') === 'all';
    const open = id => all || classReady(id);
    let chosen = Object.keys(CLASSES).find(open) ?? 'warrior', gender = 'male';
    const overlay = el('section', 'g-create', `
      <div class="g-create-card">
        <span class="eyebrow">สร้างผู้เดินทาง · วิถีไทย ในโลกที่กว้างกว่าเดิม</span>
        <h2>จากแผ่นดินนี้ สู่เรื่องราวของคุณ</h2>
        <div class="g-create-row">
          <label class="g-name">ชื่อตัวละคร<input maxlength="16" value="ผู้เดินทาง" autocomplete="off" /></label>
          <div class="g-gender" role="radiogroup" aria-label="เพศ"><button data-g="male" role="radio">ชาย</button><button data-g="female" role="radio">หญิง</button></div>
        </div>
        <div class="g-classes" role="radiogroup" aria-label="เลือกอาชีพ"></div>
        <div class="g-class-detail"></div>
        <button class="g-start">เริ่มการเดินทาง</button>
      </div>`);
    const list = overlay.querySelector('.g-classes'), detail = overlay.querySelector('.g-class-detail');
    for (const [id, c] of Object.entries(CLASSES)) {
      if (!open(id)) {
        const card = el('button', 'g-class g-class-locked', `<span class="g-class-icon" aria-hidden="true"><span class="g-shadow">${c.icon}</span><i>?</i></span><b>???</b><em>กำลังเตรียม</em>`);
        card.disabled = true; card.title = 'อาชีพนี้กำลังเตรียม เร็ว ๆ นี้'; card.setAttribute('aria-label', 'อาชีพที่ยังไม่เปิด');
        list.append(card); continue;
      }
      const card = el('button', 'g-class', `<span class="g-class-icon">${c.icon}</span><b>${c.name}</b><em>${c.en}</em>`);
      card.style.setProperty('--cls', c.color);
      card.setAttribute('role', 'radio'); card.dataset.id = id;
      card.addEventListener('click', () => { chosen = id; sync(); });
      list.append(card);
    }
    overlay.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { gender = b.dataset.g; sync(); }));
    const sync = () => {
      list.querySelectorAll('.g-class:not(.g-class-locked)').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === chosen)));
      overlay.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.g === gender)));
      const c = CLASSES[chosen];
      detail.style.setProperty('--cls', c.color);
      detail.innerHTML = `<p class="g-tagline">“${c.tagline}”</p><p>${c.desc}</p>
        <div class="g-class-stats">${STATS.map(k => `<i>${STAT_LABELS[k]} ${c.base[k]}</i>`).join('')}</div>
        <div class="g-class-skills">${c.skills.map(id => `<span title="${SKILLS[id].name}">${SKILLS[id].icon} ${SKILLS[id].name}</span>`).join('')}</div>`;
    };
    sync();
    const input = overlay.querySelector('input');
    const start = () => {
      const name = input.value.trim() || 'ผู้เดินทาง';
      overlay.remove(); resolve({ name, classId: chosen, gender });
    };
    overlay.querySelector('.g-start').addEventListener('click', start);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') start(); });
    root.append(overlay);
    input.focus(); input.select();
  });
}
