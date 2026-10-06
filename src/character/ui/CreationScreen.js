import { CLASSES, STATS, STAT_LABELS } from '../data/classes.js';
import { SKILLS } from '../../combat/data/skills.js';
import { el, esc } from './dom.js';
import { AVATARS, classReady } from '../../data/training.js';
import { CLASS_KITS } from '../../classes/index.js';
import { ModelPreview } from '../../ui/ModelPreview.js';
import { classBadge, classEmblem } from '../../ui/icons.js';
import { playSkillSound } from '../../audio/gameSounds.js';

// Character creation; resolves with { name, classId, gender }.
// A 3D stage shows the chosen class's model (src/ui/ModelPreview.js); its ten
// skills (CLASS_KITS) are listed with icons, and clicking one plays that move.
// Classes that are not ready yet (src/data/training.js) show as a locked black
// silhouette with "?"; ?classes=all unlocks them for testing.
export function showCreation(root) {
  return new Promise(resolve => {
    const all = new URLSearchParams(location.search).get('classes') === 'all';
    const open = id => all || classReady(id);
    let chosen = Object.keys(CLASSES).find(open) ?? 'muaythai', gender = 'male';
    const overlay = el('section', 'g-create', `
      <div class="g-create-card">
        <span class="eyebrow">สร้างผู้เดินทาง · วิถีไทย ในโลกที่กว้างกว่าเดิม</span>
        <h2>จากแผ่นดินนี้ สู่เรื่องราวของคุณ</h2>
        <div class="g-create-main">
          <div class="g-stage"><span class="g-stage-loading">กำลังโหลดโมเดล…</span><span class="g-stage-hint">ลากเพื่อหมุน · คลิกสกิลเพื่อดูท่าและเอฟเฟกต์</span></div>
          <div class="g-create-side">
            <div class="g-create-row">
              <label class="g-name">ชื่อตัวละคร<input maxlength="16" value="ผู้เดินทาง" autocomplete="off" /></label>
              <div class="g-gender" role="radiogroup" aria-label="เพศ"><button data-g="male" role="radio">ชาย</button><button data-g="female" role="radio">หญิง</button></div>
            </div>
            <div class="g-classes" role="radiogroup" aria-label="เลือกอาชีพ"></div>
            <div class="g-class-detail"></div>
            <button class="g-start">เริ่มการเดินทาง</button>
          </div>
        </div>
      </div>`);
    const list = overlay.querySelector('.g-classes'), detail = overlay.querySelector('.g-class-detail');
    for (const [id, c] of Object.entries(CLASSES)) {
      if (!open(id)) {
        const card = el('button', 'g-class g-class-locked', `<span class="g-class-icon" aria-hidden="true"><span class="g-shadow">${classEmblem(id, 30)}</span><i>?</i></span><b>???</b><em>กำลังเตรียม</em>`);
        card.disabled = true; card.title = 'อาชีพนี้กำลังเตรียม เร็ว ๆ นี้'; card.setAttribute('aria-label', 'อาชีพที่ยังไม่เปิด');
        list.append(card); continue;
      }
      const card = el('button', 'g-class', `<span class="g-class-icon">${classBadge(id, c, { size: 30 })}</span><b>${c.name}</b><em>${c.en}</em>`);
      card.style.setProperty('--cls', c.color);
      card.setAttribute('role', 'radio'); card.dataset.id = id;
      card.addEventListener('click', () => { chosen = id; sync(); });
      list.append(card);
    }
    overlay.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => { gender = b.dataset.g; sync(); }));

    const stage = overlay.querySelector('.g-stage');
    let preview = null;
    try { preview = new ModelPreview(stage); } catch { stage.classList.add('no-webgl'); }
    // The class's own ten-skill kit when it has one, else its four city combat skills.
    const skillsHtml = id => {
      const kit = CLASS_KITS[AVATARS[id]?.skills];
      if (!kit) return CLASSES[id].skills.map(s => `<span title="${esc(SKILLS[s].name)}">${SKILLS[s].icon} ${esc(SKILLS[s].name)}</span>`).join('');
      return kit.skills.map((s, i) => `<button type="button" class="g-kit-skill" data-skill="${i}" title="${esc(`${s.name} · Lv.${s.lv}\n${s.desc ?? ''}`)}" aria-label="${esc(s.name)}"><img src="${s.icon}" alt=""><small>${(i + 1) % 10}</small></button>`).join('');
    };
    const sync = () => {
      list.querySelectorAll('.g-class:not(.g-class-locked)').forEach(b => b.setAttribute('aria-checked', String(b.dataset.id === chosen)));
      overlay.querySelectorAll('[data-g]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.g === gender)));
      const c = CLASSES[chosen], kit = CLASS_KITS[AVATARS[chosen]?.skills];
      detail.style.setProperty('--cls', c.color); stage.style.setProperty('--cls', c.color);
      detail.innerHTML = `<p class="g-tagline">“${c.tagline}”</p><p>${c.desc}</p>
        <div class="g-class-stats">${STATS.map(k => `<i title="${STAT_LABELS[k]}">${k.toUpperCase()} ${c.base[k]}</i>`).join('')}</div>
        ${kit ? `<span class="g-skills-title">สกิล ${kit.skills.length} ท่า</span>` : ''}
        <div class="g-class-skills${kit ? ' g-kit' : ''}">${skillsHtml(chosen)}</div>
        <p class="g-skill-name" aria-live="polite"></p>`;
      detail.querySelectorAll('[data-skill]').forEach(b => b.addEventListener('click', () => {
        const s = kit.skills[Number(b.dataset.skill)];
        // The full skill with its FX on a dummy; just the move while the model is still loading.
        if (preview && !preview.skill(s.id)) preview.play(s.clip, s.fallback);
        playSkillSound(s, AVATARS[chosen]?.skills);
        detail.querySelector('.g-skill-name').textContent = `${s.name} — ${s.desc ?? ''}`;
      }));
      preview?.show(chosen);
    };
    sync();
    const input = overlay.querySelector('input');
    const start = () => {
      const name = input.value.trim() || 'ผู้เดินทาง';
      preview?.dispose(); overlay.remove(); resolve({ name, classId: chosen, gender });
    };
    overlay.querySelector('.g-start').addEventListener('click', start);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') start(); });
    root.append(overlay);
    input.focus(); input.select();
  });
}
