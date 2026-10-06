// Muay Thai animation set for the 3D fighter, one entry per designed skill
// (prototypes/skill-fx/src/boxer_skills.js) plus the base locomotion clips.
// Spec and Tripo prompts: docs/art/classes/muaythai/ANIMATIONS.md.
//
// clip      name the animation must have in the GLB (export name in Tripo/Blender)
// fallback  clip played until the real one exists in the model
// hits      seconds from the clip start where a blow lands (for damage/FX sync)
// loop      locomotion/idle clips loop; everything else plays once
// icon      glyph shown in the HUD skill bar until real icons exist
// mp        MP cost; cooldown in seconds (both read by the HUD skill bar)
export const BASE_CLIPS = {
  idle: { clip: 'idle', loop: true, duration: 2.0 },
  walk: { clip: 'walk', loop: true, duration: 1.0 },
  run: { clip: 'run', loop: true, duration: 0.7 },
  hurt: { clip: 'hurt', duration: 0.5 },
  die: { clip: 'die', duration: 1.6 },
};

export const MUAYTHAI_SKILLS = [
  { id: 'boxer_jab', icon: '👊', mp: 4, cooldown: 1.2, key: 'Digit1', name: 'หมัดแย็บ', clip: 'boxer_jab', fallback: 'attack_jab', duration: 1.0, hits: [0.2, 0.4, 0.62] },   // jab, double jab, stepping jab
  { id: 'boxer_kick', icon: '🦵', mp: 7, cooldown: 2.5, key: 'Digit2', name: 'เตะก้านคอ', clip: 'boxer_kick', fallback: 'attack_kick_front', duration: 1.1, hits: [0.45] },
  { id: 'boxer_croc', icon: '🐊', mp: 10, cooldown: 4, key: 'Digit3', name: 'จระเข้ฟาดหาง', clip: 'boxer_croc', fallback: 'attack_combo', duration: 1.4, hits: [0.55, 0.85] },   // two spinning whips
  { id: 'boxer_waikru', icon: '🙏', mp: 0, cooldown: 12, key: 'Digit4', name: 'ไหว้ครูรำมวย', clip: 'boxer_waikru', fallback: 'idle', duration: 3.2, hits: [] },
  { id: 'boxer_ngouy', icon: '🐘', mp: 12, cooldown: 5, key: 'Digit5', name: 'หักงวงไอยรา', clip: 'boxer_ngouy', fallback: 'attack_combo', duration: 1.6, hits: [0.95] },
  { id: 'boxer_drum', icon: '🥁', mp: 9, cooldown: 8, key: 'Digit6', name: 'กลองมังคละปลุกใจ', clip: 'boxer_drum', fallback: 'attack_jab', duration: 2.6, hits: [0.4, 0.87, 1.3] },
  { id: 'boxer_elbow', icon: '💢', mp: 8, cooldown: 3, key: 'Digit7', name: 'ศอกกลับพลิกล็อก', clip: 'boxer_elbow', fallback: 'attack_combo', duration: 0.9, hits: [0.25, 0.48] },   // ศอกตัด, then ศอกกลับ with the same arm
  { id: 'boxer_knee', icon: '🦶', mp: 11, cooldown: 4.5, key: 'Digit8', name: 'เข่าลอยทะลวงฟ้า', clip: 'boxer_knee', fallback: 'skill_teep', duration: 1.2, hits: [0.6] },
  { id: 'boxer_iron', icon: '🛡️', mp: 15, cooldown: 20, key: 'Digit9', name: 'กายเหล็กคาถามหาอุด', clip: 'boxer_iron', fallback: 'idle', duration: 2.4, hits: [] },
  { id: 'boxer_hanuman', icon: '🐵', mp: 20, cooldown: 14, key: 'Digit0', name: 'หนุมานถวายแหวน', clip: 'boxer_hanuman', fallback: 'attack_combo', duration: 1.6, hits: [0.34, 0.78] },   // parry, double uppercut
];

export const SKILL_BY_KEY = Object.fromEntries(MUAYTHAI_SKILLS.map(s => [s.key, s]));
