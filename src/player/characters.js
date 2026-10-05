// Data-driven character definitions. A production model is a .glb exported
// from Blender (see docs/technical/BLENDER_PIPELINE.md); until it exists the
// game falls back to the procedural stand-in named by `placeholder`.
export const CHARACTERS = {
  'nak-muay': {
    name: 'นักมวยคาดเชือก',
    classId: 'Nak Muay Khad Chueak',
    url: '/assets/characters/nak-muay.glb',
    placeholder: 'nak-muay',
    // World height of the model after loading; the camera is far, so heroes are slightly oversized.
    height: 3,
    walkSpeed: 4,
    // Animation states → clip names inside the .glb (matched case-insensitively).
    clips: { idle: 'Idle', walk: 'Walk', guard: 'Guard', elbow: 'ElbowStrike', knee: 'FlyingKnee' },
    // Skills on the hotbar. `lunge` moves the hero forward during the move (units/second, time window).
    skills: [
      { key: 'Digit1', clip: 'guard', label: 'ตั้งการ์ด', glyph: '🛡️', toggle: true },
      { key: 'Digit2', clip: 'elbow', label: 'ศอกกลับ', glyph: '💢' },
      { key: 'Digit3', clip: 'knee', label: 'เข่าลอย', glyph: '🦵', lunge: { speed: 5, from: .15, to: .6 } },
    ],
  },
};
