import { CHORDS, MELODY } from './calmScore.js';
import { EXPEDITIONS } from '../world/expeditions.js';

// One original motif, orchestrated by geography; no downloaded recordings.
const mood = (name, bpm, options = {}) => ({ style: 'calm', name, bpm, chords: CHORDS, melody: MELODY,
  gain: 1.8, flute: .09, strings: .022, pluck: .024, wood: .012, bass: .05,
  transpose: 0, minor: false, sparse: false, ...options });
export const CALM_MUSIC = {
  calm_river: mood('ริมน้ำนครที่ถูกลืมเลือน', 68, { cozy: true, piano: .067, mallet: .018, flute: .069, strings: .016, pluck: .013 }),
  calm_market: mood('ตลาดเช้านครที่ถูกลืมเลือน', 76, { cozy: true, piano: .062, mallet: .023, flute: .064, pluck: .021, wood: .016, strings: .014, bright: true }),
  calm_temple: mood('แสงสุวรรณเจดีย์', 60, { cozy: true, piano: .044, mallet: .007, pluck: .007, wood: .003, flute: .061, strings: .020, sparse: true }),
  calm_paddy: mood('ลมเหนือทุ่งข้าว', 72, { flute: .086, pluck: .027, wood: .017 }),
  calm_forest: mood('เงาไม้กลางไพร', 64, { minor: true, pluck: .018, strings: .024, wood: .007, flute: .078 }),
  calm_ruins: mood('เสียงกระซิบวัดร้าง', 58, { minor: true, transpose: -5, sparse: true, flute: .051, strings: .024, pluck: .008, wood: 0 }),
  calm_marsh: mood('หมอกเหนือบึง', 62, { minor: true, transpose: -2, sparse: true, flute: .062, strings: .026, pluck: .014, wood: .005 }),
  calm_night: mood('จันทร์เหนือนครที่ถูกลืมเลือน', 58, { cozy: true, piano: .045, mallet: .009, transpose: -5, sparse: true, flute: .047, strings: .016, pluck: .007, wood: .003 }),
  calm_battle: mood('ก้าวออกศึก', 104, { minor: true, bright: true, pulse: true, drums: .038, flute: .087, strings: .019, pluck: .036, wood: .023, bass: .065 }),
  calm_boss: mood('ศึกอสูรนครที่ถูกลืมเลือน', 120, { minor: true, transpose: -2, bright: true, pulse: true, boss: true, drums: .048, flute: .082, strings: .023, pluck: .042, wood: .027, bass: .07 }),
};

// Transform the score into a D-minor colour without random/out-of-key melody.
export function moodPitch(midi, track) {
  const pc = ((midi % 12) + 12) % 12;
  const darker = track.minor && [1, 6, 11].includes(pc) ? -1 : 0;
  return midi + darker + (track.transpose ?? 0);
}

export function combatMusicState(combat, position) {
  const inCombat = !!combat?.inCombat && combat.character?.alive !== false;
  const engaged = m => m?.alive && m.def?.boss && m.state === 'chase' && Math.hypot(m.x-position.x, m.z-position.z) <= 35;
  const boss = inCombat && (engaged(combat.target) || (combat.monsters ?? []).some(engaged));
  return { inCombat, boss: !!boss };
}

export function musicAt({ mapId = 'city', regionId = 'city', phase = 'day', inCombat = false, boss = false } = {}) {
  if (inCombat) return boss ? 'calm_boss' : 'calm_battle';
  // Loaded map wins over coordinates: expedition coordinates are outside city bands.
  const expedition = EXPEDITIONS.find(e => e.id === mapId);
  if (expedition) return expedition.theme === 'forest' ? 'calm_forest' : expedition.theme === 'klong' ? 'calm_marsh' : 'calm_ruins';
  if (mapId === 'ubosot') return 'calm_temple';
  if (mapId === 'wat_rang' || mapId === 'ruen_ho') return 'calm_ruins';
  if (mapId === 'klong') return 'calm_marsh';
  if (mapId === 'deep_forest' || mapId !== 'city' && mapId !== 'paddy') return 'calm_forest';
  if (phase === 'night') return 'calm_night';
  if (mapId === 'paddy') return 'calm_paddy';
  if (['market', 'merchants', 'smiths', 'fishmkt'].includes(regionId)) return 'calm_market';
  if (regionId === 'temple') return 'calm_temple';
  if (['training', 'halls'].includes(regionId)) return 'calm_paddy';
  return 'calm_river';
}
