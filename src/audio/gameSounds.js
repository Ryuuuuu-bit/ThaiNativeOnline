import { Sound } from './Sound.js';
import { SFX_EVENTS, SKILL_SFX, KIT_CAST_SFX } from '../data/audio.js';

// Wiring between the game and the audio engine. Mapping data lives in
// src/data/audio.js (SFX_EVENTS); this file only listens.

// Every button click anywhere (entry screens, HUD, panels) gives a soft tick.
export function bindUiSounds(root = document) {
  root.addEventListener('click', e => {
    const b = e.target.closest?.('button');
    if (b && !b.disabled && !b.closest('.hotbar')) Sound.sfx(b.matches('.g-start, .acc-primary, .acc-enter, .acc-play') ? 'ui_confirm' : 'ui_click');
  }, true);
}

// Combat and character events → SFX, once the character exists.
export function bindCombatSounds(game) {
  const crit = e => e?.crit || e?.critical;
  for (const [key, id] of Object.entries(SFX_EVENTS)) {
    const [source, event] = key.split(':');
    const emitter = source === 'combat' ? game.combat : game.character;
    emitter?.on?.(event, e => {
      // Hits sound bigger on a crit; damage-over-time ticks stay silent.
      if (event === 'hit') return e?.dot ? undefined : Sound.sfx(crit(e) ? 'hit_crit' : 'hit');
      Sound.sfx(id);
    });
  }
}

// Volume sliders appended to a settings panel (music / effects / ambience).
export function mountAudioSettings(panel) {
  if (!panel) return;
  const row = document.createElement('div'); row.className = 'audio-settings';
  const sliders = [['music', 'เพลง'], ['sfx', 'เอฟเฟกต์'], ['ambience', 'บรรยากาศ']];
  row.innerHTML = sliders.map(([k, label]) => `<label>${label} <output>${Math.round(Sound.settings[k] * 100)}%</output><input type="range" min="0" max="100" value="${Math.round(Sound.settings[k] * 100)}" data-audio="${k}" /></label>`).join('');
  row.addEventListener('input', e => {
    const k = e.target.dataset.audio; if (!k) return;
    Sound.set(k, Number(e.target.value) / 100);
    e.target.previousElementSibling.value = `${e.target.value}%`;
    if (k === 'sfx') Sound.sfx('ui_click');
  });
  panel.querySelector('p')?.before(row) ?? panel.appendChild(row);
}

// A class skill (an entry of CLASS_KITS[kit].skills: { id, hits }): its signature
// sound now and its blow sound at each hit time. `kit` picks a fallback cast sound.
export function playSkillSound(skill, kit) {
  const s = SKILL_SFX[skill.id];
  Sound.sfx(s?.cast ?? KIT_CAST_SFX[kit] ?? 'whoosh');
  if (s?.hit) for (const t of skill.hits ?? []) Sound.sfx(s.hit, { delay: t });
}
