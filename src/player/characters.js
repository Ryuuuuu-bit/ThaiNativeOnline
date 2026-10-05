// Data-driven character definitions.
//  kind 'sprite': eight-direction PixelLab sheets (see spriteHero.js) brought over from the
//                 legacy ThaiNative client; the production-ready option today.
//  kind 'model':  a .glb exported from Blender (docs/technical/BLENDER_PIPELINE.md); until the
//                 file exists the procedural stand-in named by `placeholder` is used.
// `skills` drive the hotbar: `clip` is the animation state, `lunge` moves the hero forward
// during the move (units/second between `from` and `to` seconds), `toggle` holds a stance.

const boxerSkills = [
  { key: 'Digit1', clip: 'attack', label: 'หมัดตรง', glyph: '👊' },
  { key: 'Digit2', clip: 'attack', label: 'ศอกกลับ', glyph: '💢' },
  { key: 'Digit3', clip: 'attack', label: 'เข่าลอย', glyph: '🦵', lunge: { speed: 6, from: .05, to: .3 } },
];

export const CHARACTERS = {
  'boxer-female': {
    kind: 'sprite', name: 'นักมวยคาดเชือก', classId: 'Nak Muay Khad Chueak', portrait: 'ม',
    sheet: { format: 'layout', base: '/assets/characters/boxer-female' },
    // World units per "lab pixel" (the sheet's shared scale); the standing pose is ~107 lab px.
    unitsPerLab: .03, walkSpeed: 4,
    skills: boxerSkills,
  },
  'boxer-male': {
    kind: 'sprite', name: 'นักมวยคาดเชือก', classId: 'Nak Muay Khad Chueak', portrait: 'ม',
    sheet: {
      format: 'grid', base: '/assets/characters/boxer-male', foot: .9, labPerCell: 135,
      clips: { idle: { frames: 4, fps: 5, loop: true }, walk: { frames: 6, fps: 10, loop: true }, attack: { frames: 8, fps: 14, loop: false }, die: { frames: 7, fps: 8, loop: false } },
    },
    unitsPerLab: .026, walkSpeed: 4,
    skills: boxerSkills,
  },
  'nak-muay-3d': {
    kind: 'model', name: 'นักมวยคาดเชือก (3D)', classId: 'Nak Muay Khad Chueak', portrait: 'ม',
    url: '/assets/characters/nak-muay.glb', placeholder: 'nak-muay', height: 3, walkSpeed: 4,
    clips: { idle: 'Idle', walk: 'Walk', guard: 'Guard', elbow: 'ElbowStrike', knee: 'FlyingKnee' },
    skills: [
      { key: 'Digit1', clip: 'guard', label: 'ตั้งการ์ด', glyph: '🛡️', toggle: true },
      { key: 'Digit2', clip: 'elbow', label: 'ศอกกลับ', glyph: '💢' },
      { key: 'Digit3', clip: 'knee', label: 'เข่าลอย', glyph: '🦵', lunge: { speed: 5, from: .15, to: .6 } },
    ],
  },
};
export const DEFAULT_CHARACTER = 'boxer-female';
