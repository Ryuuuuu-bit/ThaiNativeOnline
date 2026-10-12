import { COMPACT_CITY, COMPACT_CITY_NODES, compactCityPoint } from '../world/compact-city.js';
import { hallSpots } from './halls.js';

// Already in compact world space. World and server contacts consume the same
// records; never run these or generated warp keeper schedules through the fallback.
const spot = (x, z, face = 0, link = 'center') => ({ x, z, face, link });
const poi = id => COMPACT_CITY.pois.find(p => p.id === id);
const atPoi = (id, face, link) => { const p = poi(id); return spot(p.x, p.z, face, link); };
export const COMPACT_CITY_SPOTS = {
  enhance_master: atPoi('forge', Math.PI / 2, 'enh_front'),
  enh_front: spot(-14, -17, -Math.PI / 2, 'bl1'),
  forge_smith: spot(-17, -13, Math.PI / 2, 'forge_aisle'),
  forge_aisle: spot(-15, -13, 0, 'forge_customer'),
  forge_customer: spot(-12, -13, -Math.PI / 2, 'bl1'),
  general_keeper: atPoi('general', Math.PI / 2, 'general_customer'),
  general_customer: spot(-14, 12, -Math.PI / 2, 'shops_m'),
  herb_keeper: atPoi('pharmacy', -Math.PI / 2, 'herb_customer'),
  herb_customer: spot(14, -17, Math.PI / 2, 'tr1'),
  occult_keeper: spot(-42, 17, Math.PI / 2, 'occult_customer'),
  occult_customer: spot(-39, 17, -Math.PI / 2, 'shops_s'),
  stash: atPoi('stash', -Math.PI / 2, 'shops_m'),
  pillar_pray: spot(0, -7, Math.PI, 'center'),
  pillar_pray2: spot(-2, -7, Math.PI, 'center'),
  center_bench: spot(-7, -5, Math.PI, 'center'),
  temple_pray: atPoi('abbot', Math.PI, 't1'),
  temple_pray2: spot(-55, -31, Math.PI, 't1'),
  temple_sweep: atPoi('monk', 0, 'tk'),
  temple_sala: spot(-43, -24, Math.PI, 'tg'),
  kuti_a: spot(-51, -6, Math.PI, 'tk'),
  kuti_b: spot(-54, -6, Math.PI, 'tk'),
  bodhi_seat: spot(-63, -31, 0, 'td'),
  dockA_land: spot(-20, 52, Math.PI, 'port_w'),
  dockA_end: spot(-20, 59, 0, 'dockA_land'),
  dockB_land: spot(30, 52, 0, 'port_e'),
  dockB_end: spot(30, 59, 0, 'dockB_land'),
  dockB_end2: spot(33, 59, 0, 'dockB_land'),
  pdock_land: spot(0, 52, 0, 'port_c'),
  pdock_end: atPoi('docks', 0, 'pdock_land'),
  fishdock_land: spot(-43, 52, 0, 'port_w2'),
  fishdock_end: spot(-43, 59, 0, 'fishdock_land'),
  warehouseA: spot(-28, 50, Math.PI, 'port_w'),
  warehouseB: spot(38, 50, Math.PI, 'port_e2'),
  sala_seat: spot(-3, 55, Math.PI / 2, 'port_c'),
  bank_seat: spot(-8, 57, 0, 'port_c'),
  kid_watch: spot(13, 57, 0, 'port_c'),
  trader_a: spot(-14, 52, Math.PI / 2, 'port_w'),
  trader_b: spot(-12, 52, -Math.PI / 2, 'port_w'),
  fv_net: spot(-54, 48, 0, 'fv_m'),
  fv_rack: spot(-50, 48, Math.PI, 'fv_e'),
  fv_dock: spot(-54, 59, 0, 'fv_m'),
  fv_boat: spot(-58, 54, .3, 'fv_m'),
  boatyard: spot(53, 55, Math.PI / 2, 'er_m'),
};

// Retain the complete market/fish anchor families, including scenery aliases
// referenced by route stops. These add no NPC or shop roles.
for (const [i, name] of ['weapons', 'armor', 'charms', 'fruit', 'rice', 'lanterns', 'pottery', 'veg', 'cloth', 'herbs', 'o1', 'o2', 'o3'].entries()) {
  const x = i < 7 ? -9 : 9, z = 4 + (i % 7) * 3;
  const id = `stall_${name}`;
  COMPACT_CITY_SPOTS[`${id}_c`] = spot(x, z, x < 0 ? -Math.PI / 2 : Math.PI / 2, 'mkt_s');
  COMPACT_CITY_SPOTS[`${id}_k`] = spot(x * 1.2, z + 1, 0, `${id}_c`);
  COMPACT_CITY_SPOTS[`${id}_s`] = spot(x * 1.2, z, 0, `${id}_k`);
  COMPACT_CITY_SPOTS[`${id}_v`] = spot(x * 1.4, z, x < 0 ? Math.PI / 2 : -Math.PI / 2, `${id}_s`);
}
for (const [name, x] of [['fishW', 17], ['fishE', 27]]) {
  COMPACT_CITY_SPOTS[`${name}_end`] = spot(x, 50, Math.PI, 'fishmkt');
  for (let i = 0; i < 3; i++) {
    COMPACT_CITY_SPOTS[`${name}_v${i}`] = spot(x + i * 1.5, 49, 0, `${name}_end`);
    COMPACT_CITY_SPOTS[`${name}_b${i}`] = spot(x + i * 1.5, 51, Math.PI, 'fishmkt');
  }
}
for (const s of hallSpots()) { const { id, ...value } = s; COMPACT_CITY_SPOTS[id] = value; }

// Legacy city junction aliases only: no import of global J (which also owns
// wilderness geometry). Keep home/route keys and link them to compact roads.
const legacyNodes = {
  fv_m: [-70,150], fv_e: [-64,147], er_m: [92,146], er_e: [112,142],
  sw_a: [-62,128], se_a: [70,128], sw_b: [-34,108], se_b: [36,108],
  w1: [-46,24], w2: [-62,20], e1: [46,30], e2: [66,26], e3: [92,30], e4: [112,24],
  br_s: [0,-1], br_n: [0,-19], wb_s: [-60,1], wb_n: [-60,-17], eb_s: [62,1], eb_n: [62,-17],
  rw1: [-20,-36], rw2: [-42,-32], rw3: [-66,-36], rn1: [-46,-56], rn2: [-40,-80],
  rx1: [-22,-60], rn5: [-66,-86], rn6: [-66,-58],
  wr_w1: [-32,-103], wr_w2: [-70,-103], wr_e1: [30,-104], wr_e2: [70,-104], wr_e3: [108,-102],
  te1: [16,-22], te2: [40,-19], te3: [90,-20], te4: [112,-24],
};
for (const [id, p] of Object.entries(legacyNodes)) {
  const q = compactCityPoint(...p); COMPACT_CITY_SPOTS[id] = spot(q.x, q.z);
}
for (const [id, p] of Object.entries(COMPACT_CITY_NODES)) COMPACT_CITY_SPOTS[id] = spot(...p, 0, null);
for (const [id, p] of Object.entries({ cs: [-52,-31], ce: [-40,-43], cn: [-52,-55], cw: [-64,-43],
  c_sw: [-64,-35], c_se: [-40,-31], c_ne: [-40,-55], c_nw: [-64,-55] })) COMPACT_CITY_SPOTS[id] = spot(...p, 0, 't1');

// Called once on the legacy-authored roster. String anchors resolve through
// COMPACT_CITY_SPOTS or main's mapped J. Outside visitors retain field literals.
const mappedDefinitions = new WeakSet();
export function compactCityNpc(def) {
  if (mappedDefinitions.has(def) || (def.map && def.map !== 'city') || def.warpService) return def;
  const at = value => !value || typeof value !== 'object' || value.link === 'gate_out'
    ? value : { ...value, ...compactCityPoint(value.x, value.z) };
  const schedule = Object.fromEntries(Object.entries(def.schedule ?? {}).map(([phase, activity]) => [phase,
    activity.do === 'stay' ? { ...activity, at: at(activity.at) }
      : activity.do === 'route' ? { ...activity, stops: activity.stops.map(s => typeof s === 'string' ? s : { ...s, at: at(s.at) }) }
        : activity,
  ]));
  const homeSpot = COMPACT_CITY_SPOTS[def.home?.near];
  // Gate guards are paddy visitors all day, not compact-city residents.
  const fieldGuard = def.id === 'guard_gate_w' || def.id === 'guard_gate_e';
  const fieldHome = def.schedule?.day?.at;
  const home = fieldGuard ? { ...def.home, near: { x: fieldHome.x, z: fieldHome.z } }
    : homeSpot ? { ...def.home, near: { x: homeSpot.x, z: homeSpot.z } } : def.home;
  const mapped = { ...def, map: fieldGuard ? 'paddy' : 'city', home, schedule };
  mappedDefinitions.add(mapped);
  return mapped;
}
