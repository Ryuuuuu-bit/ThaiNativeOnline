import { createRng, hashString } from '../world/rng.js';

// Occupations are data: label, walking speed, how they dress and what they
// carry. Behaviour comes from schedules, never from occupation-specific code.
const SKIN = ['#c99a72', '#b9875f', '#d6a982', '#a97a55', '#c58f66'];
const HAIR = ['#2b2722', '#1f1c19', '#3a332b'];
const CLOTH = ['#a8432f', '#3d4a6b', '#5f7a4a', '#d4a443', '#6d4a6e', '#4f7a8c', '#c98a8a', '#d8c9a3', '#7a5a3a'];
const DARK = ['#4a3f33', '#3a3a48', '#5a4a3a', '#2f3a3f', '#6b4a3a'];

export const OCCUPATIONS = {
  villager: { label: 'ชาวบ้าน', speed: 1.5 },
  merchant: { label: 'พ่อค้า', speed: 1.45, top: ['#e3d6b0', '#a8432f', '#3d4a6b', '#d4a443'], sash: true },
  farmer: { label: 'ชาวนา', speed: 1.4, top: ['#2f3a55', '#34405c'], bottom: ['#2f3a55'], hat: 'ngob' },
  fisher: { label: 'ชาวประมง', speed: 1.45, top: [null, '#7f7a68', '#6f7f86'], hat: 'ngob' },
  blacksmith: { label: 'ช่างตีเหล็ก', speed: 1.4, top: [null], bottom: ['#3f3328'], hat: 'headband', props: ['hammer', 'apron'] },
  enhancer: { label: 'ช่างตีบวก', speed: 1.3, top: ['#5a2a22'], bottom: ['#2b2622'], sash: '#c9a35a', hat: 'headbandRed', props: ['hammer'] },
  herbalist: { label: 'หมอยา', speed: 1.3, top: ['#e3d8b8'], bottom: ['#6b5a45'], hair: 'bun' },
  occultist: { label: 'หมออาคม', speed: 1.2, top: ['#2b2622'], bottom: ['#2b2622'], sash: '#a8432f', hat: 'headbandRed' },
  boxing_master: { label: 'ครูมวย', speed: 1.5, top: [null], bottom: ['#a8432f'], hat: 'mongkol' },
  sword_master: { label: 'ครูดาบ', speed: 1.5, top: ['#3d4a6b'], sash: '#a8432f', props: ['sword'] },
  hunter: { label: 'นายพราน', speed: 1.6, top: ['#6b5338'], bottom: ['#4a3f33'], hat: 'cloth', props: ['bow', 'pack'] },
  shaman: { label: 'หมอผี', speed: 1.2, top: ['#e8e0cc'], bottom: ['#e8e0cc'], hair: 'bun', props: ['staff'] },
  bandit: { label: 'โจรป่า', speed: 1.6, top: ['#2b2622'], bottom: ['#2b2622'], hat: 'headbandRed', props: ['knife'] },
  guard: { label: 'ทหารเมือง', speed: 1.45, top: ['#a8432f'], bottom: ['#3a3229'], sash: '#c9a35a', hat: 'helmet', props: ['spear'] },
  dockworker: { label: 'คนงานท่าเรือ', speed: 1.5, top: [null], bottom: ['#5a4a3a'], hat: 'headband' },
  boatman: { label: 'คนพายเรือ', speed: 1.4, top: ['#6f7f86'], hat: 'ngob', props: ['paddle'] },
  monk: { label: 'พระ', speed: 1.1, robe: '#c9782c', hair: 'shaved' },
  child: { label: 'เด็ก', speed: 2.5, scale: .68, top: [null, '#d8c9a3', '#c98a8a'] },
  traveler: { label: 'ผู้เดินทาง', speed: 1.5, top: ['#8a7a5a'], hat: 'ngob', props: ['pack', 'staff'] },
};

// Deterministic appearance from occupation, gender and id.
export function makeLook(def) {
  const occ = OCCUPATIONS[def.occupation] ?? OCCUPATIONS.villager, rng = createRng(hashString(def.id));
  const female = def.gender === 'f';
  const pick = (list, fallback) => (list ? rng.pick(list) : fallback);
  const look = {
    skin: rng.pick(SKIN), hair: rng.pick(HAIR), hairStyle: occ.hair ?? (female ? 'bun' : 'short'),
    top: female && occ.top?.[0] === null ? rng.pick(CLOTH) : pick(occ.top, rng.chance(.55) ? null : rng.pick(CLOTH)),
    bottom: pick(occ.bottom, rng.pick(DARK)), sash: typeof occ.sash === 'string' ? occ.sash : rng.pick(CLOTH),
    skirt: null, robe: occ.robe ?? null, sleeves: false, hat: occ.hat ?? (rng.chance(.15) ? 'ngob' : null),
    props: [...(occ.props ?? []), ...(def.props ?? [])], scale: (occ.scale ?? 1) * rng.range(.95, 1.05) * (def.scale ?? 1),
  };
  if (female) { look.skirt = pick(occ.bottom, rng.pick(CLOTH.concat(DARK))); if (look.hat === 'headband' || look.hat === 'mongkol') look.hat = null; }
  if (look.robe) { look.top = look.robe; look.skirt = look.robe; look.sash = look.robe; }
  if (def.occupation === 'guard' || def.occupation === 'sword_master' || def.occupation === 'enhancer') look.sleeves = true;
  return Object.assign(look, def.look ?? {});
}
