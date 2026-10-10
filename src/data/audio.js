import { CALM_MUSIC } from './calmMusic.js';

// Content data only: sound effects and music (played by src/audio).
//
// SFX recipes are synthesized with Web Audio (no downloads). Each recipe is a
// list of layers mixed together:
//   wave    'sine' | 'triangle' | 'square' | 'sawtooth' | 'noise'
//   f       [start, end] pitch in Hz (oscillators) — swept exponentially
//   dur     seconds; at = delay before the layer starts; a = attack seconds
//   gain    peak volume (0–1)
//   filter  { type: 'lowpass' | 'highpass' | 'bandpass', f: [start, end], q }
// vary: random pitch spread (±fraction) so repeats don't sound identical.
// A recipe may instead be { file: 'sfx/name.ogg', gain } to play a recorded
// sample from public/ once real audio exists.
export const SFX = {
  ui_click:    { layers: [{ wave: 'triangle', f: [1300, 900], dur: .05, gain: .12 }] },
  ui_confirm:  { layers: [{ wave: 'triangle', f: [660, 660], dur: .09, gain: .12 }, { wave: 'triangle', f: [990, 990], dur: .14, at: .07, gain: .12 }] },
  ui_open:     { layers: [{ wave: 'sine', f: [520, 780], dur: .12, gain: .08 }] },
  target:      { layers: [{ wave: 'square', f: [1800, 1700], dur: .03, gain: .04, filter: { type: 'lowpass', f: [3000, 3000] } }] },
  step:        { vary: .15, layers: [{ wave: 'noise', dur: .07, gain: .05, filter: { type: 'lowpass', f: [520, 260], q: 1 } }] },

  whoosh:      { vary: .1, layers: [{ wave: 'noise', dur: .2, a: .05, gain: .1, filter: { type: 'bandpass', f: [700, 2600], q: 1.4 } }] },
  hit:         { vary: .12, layers: [
    { wave: 'noise', dur: .12, gain: .22, filter: { type: 'bandpass', f: [1400, 300], q: .9 } },
    { wave: 'sine', f: [170, 55], dur: .14, gain: .35 },
  ] },
  hit_crit:    { vary: .06, layers: [
    { wave: 'noise', dur: .2, gain: .3, filter: { type: 'bandpass', f: [2200, 260], q: .8 } },
    { wave: 'sine', f: [140, 40], dur: .22, gain: .5 },
    { wave: 'triangle', f: [1760, 1700], dur: .3, at: .02, gain: .07 },
  ] },
  miss:        { vary: .1, layers: [{ wave: 'noise', dur: .18, a: .03, gain: .07, filter: { type: 'bandpass', f: [900, 2800], q: 2 } }] },
  kill:        { layers: [
    { wave: 'sine', f: [98, 96], dur: 1.6, gain: .3 },
    { wave: 'sine', f: [270, 266], dur: 1.1, gain: .12 },
    { wave: 'noise', dur: .3, gain: .12, filter: { type: 'lowpass', f: [600, 200] } },
  ] },

  cast_fist:   { vary: .08, layers: [
    { wave: 'noise', dur: .16, a: .04, gain: .09, filter: { type: 'bandpass', f: [600, 2000], q: 1.2 } },
    { wave: 'sine', f: [110, 70], dur: .18, at: .05, gain: .2 },
  ] },
  cast_herb:   { layers: [
    { wave: 'sine', f: [880, 880], dur: .5, gain: .07 },
    { wave: 'sine', f: [1320, 1320], dur: .5, at: .07, gain: .06 },
    { wave: 'sine', f: [1760, 1760], dur: .6, at: .14, gain: .05 },
    { wave: 'noise', dur: .4, a: .1, gain: .03, filter: { type: 'highpass', f: [5000, 7000] } },
  ] },
  heal:        { layers: [
    { wave: 'sine', f: [520, 1040], dur: .5, a: .05, gain: .1 },
    { wave: 'triangle', f: [1560, 1560], dur: .5, at: .25, gain: .04 },
  ] },
  buff:        { layers: [{ wave: 'sine', f: [392, 784], dur: .6, a: .1, gain: .09 }, { wave: 'sine', f: [588, 1176], dur: .6, a: .1, gain: .05 }] },

  player_hurt: { vary: .08, layers: [
    { wave: 'square', f: [240, 110], dur: .16, gain: .07, filter: { type: 'lowpass', f: [1200, 400] } },
    { wave: 'noise', dur: .1, gain: .1, filter: { type: 'bandpass', f: [900, 300], q: 1 } },
  ] },
  death:       { layers: [{ wave: 'sine', f: [330, 70], dur: 1.4, gain: .18 }, { wave: 'triangle', f: [165, 40], dur: 1.6, at: .1, gain: .06 }] },
  levelup:     { layers: [294, 330, 370, 440, 494, 587].map((f, i) => ({ wave: 'triangle', f: [f * 2, f * 2], dur: .35, at: i * .09, gain: .1 })) },
  pickup:      { layers: [{ wave: 'triangle', f: [1500, 1500], dur: .08, gain: .08 }, { wave: 'triangle', f: [2250, 2250], dur: .14, at: .07, gain: .07 }] },
  fail:        { layers: [{ wave: 'square', f: [220, 180], dur: .14, gain: .05, filter: { type: 'lowpass', f: [900, 900] } }] },
};

// ---- skill sounds (SKILL_SFX below picks them per skill) ----------------------
const notes = (freqs, step, opts = {}) => freqs.map((f, i) => ({ wave: 'triangle', f: [f, f], dur: .3, at: i * step, gain: .08, ...opts }));
Object.assign(SFX, {
  // swings and impacts, played on each blow (hits[] in the class *-moves.js)
  swing_light: { vary: .12, layers: [{ wave: 'noise', dur: .09, a: .02, gain: .1, filter: { type: 'bandpass', f: [1200, 3200], q: 1.6 } }] },
  swing_heavy: { vary: .08, layers: [
    { wave: 'noise', dur: .22, a: .06, gain: .14, filter: { type: 'bandpass', f: [500, 2200], q: 1.1 } },
    { wave: 'sine', f: [90, 50], dur: .2, at: .12, gain: .25 },
  ] },
  slam:        { layers: [
    { wave: 'sine', f: [120, 32], dur: .6, gain: .55 },
    { wave: 'noise', dur: .5, gain: .25, filter: { type: 'lowpass', f: [1800, 200] } },
    { wave: 'triangle', f: [55, 40], dur: .7, gain: .2 },
  ] },
  crack:       { vary: .1, layers: [{ wave: 'noise', dur: .05, gain: .22, filter: { type: 'highpass', f: [2500, 1500] } }, { wave: 'square', f: [600, 200], dur: .06, gain: .05 }] },
  thon_drum:   { vary: .03, layers: [{ wave: 'sine', f: [190, 85], dur: .35, gain: .45 }, { wave: 'noise', dur: .06, gain: .12, filter: { type: 'bandpass', f: [700, 400], q: 1 } }] },
  wood_thud:   { vary: .06, layers: [{ wave: 'sine', f: [260, 120], dur: .14, gain: .35 }, { wave: 'noise', dur: .05, gain: .14, filter: { type: 'bandpass', f: [900, 500], q: 2 } }] },
  glass_clink: { vary: .1, layers: [{ wave: 'sine', f: [2600, 2600], dur: .25, gain: .07 }, { wave: 'sine', f: [3900, 3900], dur: .18, gain: .04 }, { wave: 'noise', dur: .03, gain: .06, filter: { type: 'highpass', f: [6000, 6000] } }] },
  // signature sounds, played as the skill starts
  // the hunter's bow: the limbs creak as the string comes back, a twang and a hiss on the release
  bow_draw:    { vary: .05, layers: [{ wave: 'sawtooth', f: [70, 110], dur: .35, a: .2, gain: .05, filter: { type: 'bandpass', f: [400, 900], q: 6 } }, { wave: 'noise', dur: .3, a: .2, gain: .03, filter: { type: 'bandpass', f: [1800, 2600], q: 4 } }] },
  // the warrior's twin swords: steel sliding out, and a ringing cut
  blade_draw:  { vary: .06, layers: [{ wave: 'noise', dur: .35, a: .05, gain: .06, filter: { type: 'bandpass', f: [3500, 7000], q: 6 } }, { wave: 'sine', f: [2900, 3100], dur: .4, at: .05, gain: .025 }] },
  blade_cut:   { vary: .1, layers: [{ wave: 'noise', dur: .14, a: .01, gain: .12, filter: { type: 'bandpass', f: [2600, 900], q: 1.4 } }, { wave: 'sine', f: [3300, 3000], dur: .22, at: .02, gain: .03 }] },
  thunder:     { layers: [{ wave: 'noise', dur: .9, a: .01, gain: .3, filter: { type: 'lowpass', f: [1800, 120], q: .7 } }, { wave: 'sine', f: [70, 40], dur: .8, gain: .3 }] },
  // the shaman: a chanted hum as the spell gathers, a whoosh of fire, a sizzle of spirit
  chant:       { vary: .04, layers: [{ wave: 'sawtooth', f: [110, 104], dur: .6, a: .15, gain: .05, filter: { type: 'lowpass', f: [700, 500], q: 4 } }, { wave: 'sine', f: [220, 218], dur: .6, a: .15, gain: .05 }] },
  fire_whoosh: { vary: .1, layers: [{ wave: 'noise', dur: .45, a: .04, gain: .14, filter: { type: 'bandpass', f: [500, 1600], q: .9 } }, { wave: 'sine', f: [160, 70], dur: .35, gain: .08 }] },
  spirit:      { vary: .08, layers: [{ wave: 'sine', f: [880, 660], dur: .5, a: .05, gain: .05 }, { wave: 'noise', dur: .4, a: .1, gain: .05, filter: { type: 'highpass', f: [4000, 2500] } }] },
  dog_bark:    { vary: .06, layers: [0, .16].flatMap(at => [{ wave: 'sawtooth', f: [620, 340], dur: .11, at, gain: .09, filter: { type: 'bandpass', f: [900, 700], q: 3 } }, { wave: 'noise', dur: .08, at, gain: .06, filter: { type: 'bandpass', f: [1400, 900], q: 2 } }]) },
  dog_growl:   { vary: .08, layers: [{ wave: 'sawtooth', f: [110, 90], dur: .45, a: .05, gain: .07, filter: { type: 'lowpass', f: [500, 380], q: 4 } }, { wave: 'noise', dur: .4, a: .05, gain: .05, filter: { type: 'bandpass', f: [400, 300], q: 3 } }, { wave: 'sawtooth', f: [600, 330], dur: .1, at: .38, gain: .08, filter: { type: 'bandpass', f: [900, 700], q: 3 } }] },
  dog_howl:    { vary: .05, layers: [{ wave: 'sawtooth', f: [380, 720], dur: .35, a: .08, gain: .06, filter: { type: 'bandpass', f: [900, 1300], q: 4 } }, { wave: 'sawtooth', f: [720, 520], dur: .8, at: .33, a: .02, gain: .06, filter: { type: 'bandpass', f: [1300, 900], q: 4 } }, { wave: 'noise', dur: .9, a: .2, gain: .03, filter: { type: 'bandpass', f: [1200, 900], q: 2 } }] },
  bow_release: { vary: .08, layers: [{ wave: 'triangle', f: [190, 150], dur: .22, gain: .16 }, { wave: 'noise', dur: .05, gain: .12, filter: { type: 'highpass', f: [2500, 2500] } }, { wave: 'noise', dur: .25, at: .02, a: .02, gain: .07, filter: { type: 'bandpass', f: [3000, 1200], q: 2 } }] },
  sig_jab:     { layers: [{ wave: 'noise', dur: .08, gain: .06, filter: { type: 'bandpass', f: [1500, 2500], q: 2 } }] },
  sig_kick:    { layers: [{ wave: 'noise', dur: .45, a: .35, gain: .12, filter: { type: 'bandpass', f: [300, 1800], q: 1.2 } }] },
  sig_croc:    { layers: [{ wave: 'noise', dur: .6, a: .2, gain: .12, filter: { type: 'bandpass', f: [400, 2600], q: 2 } }, { wave: 'noise', dur: .5, at: .3, a: .2, gain: .1, filter: { type: 'bandpass', f: [2600, 500], q: 2 } }] },
  // ไหว้ครู: a short ปี่ (Thai oboe) phrase over ฉิ่ง
  sig_waikru:  { layers: [
    ...notes([587, 659, 784, 659, 587, 523, 587], .32, { wave: 'square', dur: .34, gain: .035, filter: { type: 'lowpass', f: [2200, 2200], q: 2 } }),
    ...[0, .64, 1.28, 1.92].map(at => ({ wave: 'noise', dur: .3, at, gain: .04, filter: { type: 'highpass', f: [6000, 6000] } })),
  ] },
  sig_leap:    { layers: [{ wave: 'noise', dur: .5, a: .4, gain: .11, filter: { type: 'bandpass', f: [400, 3000], q: 1.5 } }, { wave: 'sine', f: [200, 600], dur: .45, a: .3, gain: .05 }] },
  sig_drum:    { layers: [{ wave: 'sine', f: [110, 90], dur: .5, gain: .3 }, { wave: 'noise', dur: .3, gain: .05, filter: { type: 'highpass', f: [6000, 6000] } }] },
  sig_elbow:   { layers: [{ wave: 'noise', dur: .12, gain: .08, filter: { type: 'bandpass', f: [900, 2400], q: 1.5 } }] },
  // คาถามหาอุด: a low chanted drone and a gong
  sig_iron:    { layers: [
    { wave: 'sawtooth', f: [98, 98], dur: 1.8, a: .3, gain: .05, filter: { type: 'lowpass', f: [500, 300], q: 3 } },
    { wave: 'sawtooth', f: [147, 147], dur: 1.6, at: .3, a: .3, gain: .04, filter: { type: 'lowpass', f: [600, 300], q: 3 } },
    { wave: 'sine', f: [110, 108], dur: 2, at: 1.2, gain: .25 }, { wave: 'sine', f: [303, 300], dur: 1.2, at: 1.2, gain: .08 },
  ] },
  sig_hanuman: { layers: [...notes([392, 523, 659, 784, 1047], .06, { dur: .4, gain: .07 }), { wave: 'noise', dur: .5, a: .1, gain: .08, filter: { type: 'bandpass', f: [600, 3500], q: 1 } }] },
  sig_vine:    { layers: [{ wave: 'noise', dur: .9, a: .3, gain: .08, filter: { type: 'bandpass', f: [300, 900], q: 4 } }, { wave: 'triangle', f: [220, 440], dur: .8, a: .3, gain: .04 }] },
  sig_toss:    { layers: [{ wave: 'noise', dur: .25, a: .1, gain: .07, filter: { type: 'bandpass', f: [900, 2500], q: 1.5 } }] },
  sig_circle:  { layers: [{ wave: 'sine', f: [330, 330], dur: 1.6, a: .4, gain: .06 }, { wave: 'sine', f: [495, 495], dur: 1.4, at: .2, a: .4, gain: .04 }, { wave: 'noise', dur: 1.2, a: .5, gain: .03, filter: { type: 'highpass', f: [5000, 5000] } }] },
  // ยาต้มพยัคฆ์: bubbling pot, then a tiger's growl
  sig_tiger:   { layers: [
    ...[0, .15, .27, .44, .55, .7, .83].map((at, i) => ({ wave: 'sine', f: [300 + i * 40, 700 + i * 30], dur: .07, at, gain: .06 })),
    { wave: 'sawtooth', f: [90, 70], dur: .8, at: .9, a: .15, gain: .08, filter: { type: 'lowpass', f: [500, 250], q: 4 } },
  ] },
  // พิธีสู่ขวัญ: temple bell strikes
  sig_khwan:   { layers: [0, .55].flatMap(at => [{ wave: 'sine', f: [740, 738], dur: 1.4, at, gain: .09 }, { wave: 'sine', f: [1887, 1880], dur: .8, at, gain: .035 }, { wave: 'sine', f: [2960, 2950], dur: .4, at, gain: .02 }]) },
  sig_mortar:  { layers: [{ wave: 'noise', dur: .2, gain: .05, filter: { type: 'bandpass', f: [600, 1200], q: 2 } }] },
  sig_mist:    { layers: [{ wave: 'noise', dur: 1.1, a: .4, gain: .07, filter: { type: 'bandpass', f: [2500, 5000], q: .8 } }] },
  sig_tonic:   { layers: notes([523, 587, 659, 784, 880, 1047, 1175], .08, { wave: 'sine', dur: .35, gain: .06 }) },
  // พรแม่โพสพ: warm harvest chord swelling up
  sig_mother:  { layers: [262, 330, 392, 523].map((f, i) => ({ wave: 'triangle', f: [f, f], dur: 1.8, at: i * .1, a: .5, gain: .05 })) },
  // น้ำอมฤต: pouring water, then a bright choir-like chord
  sig_amrita:  { layers: [
    { wave: 'noise', dur: .9, a: .2, gain: .07, filter: { type: 'bandpass', f: [1200, 700], q: 3 } },
    ...[523, 659, 784, 1047].map((f, i) => ({ wave: 'sawtooth', f: [f, f], dur: 1.4, at: .7 + i * .04, a: .3, gain: .025, filter: { type: 'lowpass', f: [2000, 2000] } })),
  ] },
});

// Per skill: `cast` plays as the skill starts, `hit` on every blow at the skill's
// hits[] times (src/classes/*-moves.js). Impacts on the dummy add their own
// hit / crit / miss sounds on top.
export const SKILL_SFX = {
  boxer_jab: { cast: 'sig_jab', hit: 'swing_light' },
  boxer_kick: { cast: 'sig_kick', hit: 'swing_heavy' },
  boxer_croc: { cast: 'sig_croc', hit: 'swing_heavy' },
  boxer_waikru: { cast: 'sig_waikru' },
  boxer_ngouy: { cast: 'sig_leap', hit: 'slam' },
  boxer_drum: { cast: 'sig_drum', hit: 'thon_drum' },
  boxer_elbow: { cast: 'sig_elbow', hit: 'crack' },
  boxer_knee: { cast: 'sig_leap', hit: 'slam' },
  boxer_iron: { cast: 'sig_iron' },
  boxer_hanuman: { cast: 'sig_hanuman', hit: 'swing_light' },
  heal_vine: { cast: 'sig_vine', hit: 'heal' },
  heal_pill: { cast: 'sig_toss', hit: 'glass_clink' },
  heal_zone: { cast: 'sig_circle', hit: 'buff' },
  heal_tiger: { cast: 'sig_tiger', hit: 'buff' },
  heal_khwan: { cast: 'sig_khwan', hit: 'heal' },
  heal_mortar: { cast: 'sig_mortar', hit: 'wood_thud' },
  heal_mist: { cast: 'sig_mist', hit: 'heal' },
  heal_tonic: { cast: 'sig_tonic', hit: 'buff' },
  heal_mother: { cast: 'sig_mother', hit: 'heal' },
  heal_amrita: { cast: 'sig_amrita', hit: 'heal' },
  // the hunter: every shot draws on the cast and twangs on the release (the hits are the releases)
  arch_quick: { cast: 'bow_draw', hit: 'bow_release' },
  arch_poison: { cast: 'bow_draw', hit: 'dog_growl' },
  arch_pierce: { cast: 'bow_draw', hit: 'crack' },
  arch_rain: { cast: 'dog_bark', hit: 'dog_growl' },
  arch_volley: { cast: 'bow_draw', hit: 'thunder' },
  arch_snipe: { cast: 'bow_draw', hit: 'bow_release' },
  arch_meteor: { cast: 'bow_draw', hit: 'bow_release' },
  arch_hawk: { cast: 'buff', hit: 'buff' },
  arch_garuda: { cast: 'dog_bark', hit: 'dog_howl' },
  arch_trap: { cast: 'whoosh', hit: 'slam' },
  // the warrior: every blow is a ringing cut; the leap and the execution land with weight
  sword_twin: { cast: 'blade_draw', hit: 'blade_cut' },
  sword_thrust: { cast: 'blade_draw', hit: 'swing_heavy' },
  sword_wind: { cast: 'blade_draw', hit: 'whoosh' },
  sword_guard: { cast: 'blade_draw', hit: 'buff' },
  sword_pikat: { cast: 'blade_draw', hit: 'blade_cut' },
  sword_banner: { cast: 'blade_draw', hit: 'slam' },
  sword_whirl: { cast: 'blade_draw', hit: 'blade_cut' },
  sword_leap: { cast: 'swing_heavy', hit: 'slam' },
  sword_berserk: { cast: 'blade_draw', hit: 'buff' },
  sword_execute: { cast: 'blade_draw', hit: 'thunder' },
  // the shaman's dark arts: every spell is chanted; the hit is what the spell is made of
  mage_akom: { cast: 'chant', hit: 'spirit' },
  mage_yant: { cast: 'chant', hit: 'crack' },
  mage_shield: { cast: 'chant', hit: 'buff' },
  mage_thunder: { cast: 'chant', hit: 'slam' },
  mage_kalp: { cast: 'chant', hit: 'fire_whoosh' },
  mage_holy: { cast: 'chant', hit: 'heal' },
  mage_ghostfire: { cast: 'chant', hit: 'spirit' },
  mage_curse: { cast: 'chant', hit: 'spirit' },
  mage_meditate: { cast: 'chant', hit: 'buff' },
  mage_storm: { cast: 'chant', hit: 'thunder' },
};

// Game events → SFX ids (src/audio/gameSounds.js).
export const SFX_EVENTS = {
  'combat:target': 'target', 'combat:hit': 'hit', 'combat:miss': 'miss', 'combat:dodge': 'miss',
  'combat:kill': 'kill', 'combat:player-hit': 'player_hurt', 'combat:heal': 'heal', 'combat:buff': 'buff',
  'combat:cast': 'whoosh', 'combat:fail': 'fail', 'combat:player-death': 'death',
  'character:levelup': 'levelup', 'character:used': 'heal',
};
// Cast sound per training-ground kit (src/classes/index.js CLASS_KITS ids).
export const KIT_CAST_SFX = { muaythai: 'cast_fist', herbalist: 'cast_herb', hunter: 'bow_draw', warrior: 'blade_draw', shaman: 'chant' };

// Generative music (src/audio/Music.js) on a 16-step bar. Two styles:
//
// style 'rock' (the game's BGM): distorted power-chord riff, bass, drum kit, lead.
//   riff.chords   one scale degree per bar (cycles); riff.octave shifts the guitar
//   riff.rhythm   X = accented chord held until the next hit, x = palm-muted chug
//   riff.bass     x = bass note on that step
//   drums.kick / snare: x = hit · drums.hat: x = closed, o = open
//   lead: true → a pentatonic solo every other 4-bar section (melody.* shapes it)
//   drive: guitar overdrive amount
// style 'thai': ระนาด melody, ฆ้องวง bass, ฉิ่ง (o = open "ฉิ่ง", c = closed "ฉับ"), กลอง.
// scale = semitones above root (pentatonic); root in Hz.
export const MUSIC = {
  ...CALM_MUSIC,
  rock_title: {
    name: 'ศึกแรก', style: 'rock', bpm: 112, root: 196, scale: [0, 3, 5, 7, 10], gain: .55, drive: 16,
    riff: { chords: [0, 1, 2, 3], octave: -1, rhythm: 'X.....X.X...x.x.', bass: 'x.....x.x...x.x.' },
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    lead: true, melody: { density: .6, octave: 1, range: 8 },
  },
  rock_day: {
    name: 'บุกตลาด', style: 'rock', bpm: 148, root: 164.81, scale: [0, 3, 5, 7, 10], gain: .5, drive: 20,
    riff: { chords: [0, 0, 4, 3], octave: -1, rhythm: 'X.xxx.xxX.xxx.xX', bass: 'x.x.x.x.x.x.x.x.' },
    drums: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' },
    lead: true, melody: { density: .75, octave: 1, range: 9 },
  },
  rock_night: {
    name: 'ราตรีเหล็ก', style: 'rock', bpm: 84, root: 146.83, scale: [0, 3, 5, 6, 10], gain: .55, drive: 26,
    riff: { chords: [0, 0, 1, 3], octave: -1, rhythm: 'X.......X...X...', bass: 'x.......x...x...' },
    drums: { kick: 'x.......x..x....', snare: '........x.......', hat: 'x...x...x...o...' },
    lead: true, melody: { density: .35, octave: 0, range: 6 },
  },
  // The first Thai-ensemble set, kept for a later switch (MUSIC_FOR picks).
  title: {
    name: 'ปฐมบท', bpm: 70, root: 293.66, scale: [0, 2, 4, 7, 9], gain: .5,
    melody: { density: .55, octave: 1, range: 7 },
    bass: { degrees: [0, 3, 4, 0], every: 8 },
    ching: 'o.......c.......', drum: 'x...........x...', drone: false,
  },
  day: {
    name: 'ตลาดเช้า', bpm: 96, root: 293.66, scale: [0, 2, 4, 7, 9], gain: .45,
    melody: { density: .8, octave: 1, range: 8 },
    bass: { degrees: [0, 4, 3, 4], every: 4 },
    ching: 'o...c...o...c...', drum: 'x.....x...x.....', drone: false,
  },
  night: {
    name: 'ราตรีผี', bpm: 58, root: 220, scale: [0, 3, 5, 7, 10], gain: .5,
    melody: { density: .35, octave: 0, range: 6 },
    bass: { degrees: [0, 0, 3, 2], every: 8 },
    ching: 'o...............', drum: 'x...............', drone: true,
  },
};
// Which track plays where: the entry screens, then the city by time of day.
export const MUSIC_FOR = { entry: 'calm_river', morning: 'calm_river', day: 'calm_river', evening: 'calm_river', night: 'calm_night' };

// Default volumes (the player's own choice is remembered per browser).
export const AUDIO_DEFAULTS = { master: .8, music: .5, sfx: .8, ambience: .6, muted: false };
